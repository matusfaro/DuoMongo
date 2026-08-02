import { CLAMP_PARAMETERS, createEmptyCard, default_w, fsrs, generatorParameters, type Grade as TsGrade } from 'ts-fsrs';
import type { Grade, ReviewLogEntry } from '../types';

// On-device FSRS weight fitting: replay the review history through ts-fsrs
// with candidate weights, score predicted retrievability against actual recall
// (binary cross-entropy), and minimize with Adam over numeric gradients.
// Small data (≤10k reviews), so numeric gradients are plenty fast in a worker.

const DAY = 24 * 60 * 60 * 1000;

/** FSRS's own guidance: personalized weights need a few hundred reviews. */
export const MIN_REVIEWS_TO_OPTIMIZE = 400;

interface Sequence {
  ts: number[];
  grade: Grade[];
}

function toSequences(log: ReviewLogEntry[]): Sequence[] {
  const byKey = new Map<string, Sequence>();
  for (const [key, ts, grade] of log) {
    let seq = byKey.get(key);
    if (!seq) byKey.set(key, (seq = { ts: [], grade: [] }));
    seq.ts.push(ts);
    seq.grade.push(grade);
  }
  const seqs = [...byKey.values()];
  for (const s of seqs) {
    // log is appended chronologically, but be safe
    const order = s.ts.map((_, i) => i).sort((a, b) => s.ts[a] - s.ts[b]);
    s.ts = order.map((i) => s.ts[i]);
    s.grade = order.map((i) => s.grade[i]);
  }
  return seqs;
}

/**
 * Mean binary cross-entropy of recall predictions over the whole history.
 * Same-day repeats are replayed (they evolve the card) but excluded from the
 * loss — sub-day retrievability carries almost no signal about the weights.
 */
function loss(seqs: Sequence[], w: number[]): number {
  const f = fsrs(generatorParameters({ w, enable_fuzz: false }));
  let sum = 0;
  let n = 0;
  for (const seq of seqs) {
    let card = createEmptyCard(new Date(seq.ts[0]));
    for (let i = 0; i < seq.ts.length; i++) {
      const when = new Date(seq.ts[i]);
      if (i > 0 && seq.ts[i] - seq.ts[i - 1] >= DAY / 2) {
        const p = Math.min(1 - 1e-6, Math.max(1e-6, f.get_retrievability(card, when, false)));
        const recalled = seq.grade[i] > 1;
        sum -= recalled ? Math.log(p) : Math.log(1 - p);
        n += 1;
      }
      card = f.next(card, when, seq.grade[i] as TsGrade).card;
    }
  }
  return n === 0 ? Number.POSITIVE_INFINITY : sum / n;
}

export interface OptimizeResult {
  weights: number[];
  lossBefore: number;
  lossAfter: number;
  samples: number;
}

/**
 * Fit the 21 FSRS-6 weights to the review log. Returns null if the history
 * carries too little signal (no multi-day gaps to predict on).
 */
export function optimizeWeights(
  log: ReviewLogEntry[],
  onProgress?: (fractionDone: number, currentLoss: number) => void,
  maxIters = 120
): OptimizeResult | null {
  const seqs = toSequences(log);
  const bounds = CLAMP_PARAMETERS(default_w[20]) as [number, number][];
  const clampW = (w: number[]) => w.map((v, i) => Math.min(bounds[i][1], Math.max(bounds[i][0], v)));

  let w = clampW([...default_w]);
  const lossBefore = loss(seqs, w);
  if (!Number.isFinite(lossBefore)) return null;

  // Adam with central-difference gradients, step sizes scaled per-parameter
  const m = new Array<number>(w.length).fill(0);
  const v = new Array<number>(w.length).fill(0);
  const b1 = 0.9;
  const b2 = 0.999;
  const scale = bounds.map(([lo, hi]) => hi - lo);
  let best = { w: [...w], loss: lossBefore };
  let sinceImprove = 0;

  for (let iter = 1; iter <= maxIters; iter++) {
    const grad = w.map((wi, i) => {
      const eps = Math.max(1e-4, scale[i] * 5e-4);
      const up = [...w];
      const dn = [...w];
      up[i] = Math.min(bounds[i][1], wi + eps);
      dn[i] = Math.max(bounds[i][0], wi - eps);
      const denom = up[i] - dn[i];
      return denom > 0 ? (loss(seqs, up) - loss(seqs, dn)) / denom : 0;
    });
    w = clampW(
      w.map((wi, i) => {
        m[i] = b1 * m[i] + (1 - b1) * grad[i];
        v[i] = b2 * v[i] + (1 - b2) * grad[i] * grad[i];
        const mh = m[i] / (1 - Math.pow(b1, iter));
        const vh = v[i] / (1 - Math.pow(b2, iter));
        return wi - ((0.05 * scale[i]) / 21) * (mh / (Math.sqrt(vh) + 1e-8));
      })
    );
    const l = loss(seqs, w);
    if (l < best.loss - 1e-6) {
      best = { w: [...w], loss: l };
      sinceImprove = 0;
    } else if (++sinceImprove >= 15) {
      onProgress?.(1, best.loss);
      break;
    }
    onProgress?.(iter / maxIters, best.loss);
  }

  const samples = log.length;
  return { weights: best.w.map((x) => Math.round(x * 10000) / 10000), lossBefore, lossAfter: best.loss, samples };
}
