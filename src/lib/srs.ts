import { createEmptyCard, fsrs, generatorParameters, type Card, type FSRS } from 'ts-fsrs';
import type { AppState, Grade, Skill, SrsCard } from '../types';
import { setState } from './store';

// FSRS spaced repetition over item keys ("w:skill:word" / "s:skill:sentence").
// Persisted cards are plain numbers (SrsCard); ts-fsrs Card objects exist only
// inside this module.

const DAY = 24 * 60 * 60 * 1000;

/** Review history cap — ~10k tuples ≈ 400KB of localStorage. */
const REVIEW_LOG_MAX = 10000;

// ---- scheduler (memoized on weights + retention) ----

let cachedScheduler: FSRS | null = null;
let cachedKey = '';

function getScheduler(s: AppState): FSRS {
  const key = `${s.settings.targetRetention}|${s.fsrsWeights?.join(',') ?? ''}`;
  if (!cachedScheduler || key !== cachedKey) {
    cachedScheduler = fsrs(
      generatorParameters({
        request_retention: s.settings.targetRetention,
        w: s.fsrsWeights ?? undefined,
        enable_fuzz: true,
      })
    );
    cachedKey = key;
  }
  return cachedScheduler;
}

// ---- SrsCard <-> ts-fsrs Card conversion ----

function toFsrsCard(c: SrsCard): Card {
  return {
    due: new Date(c.due),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: 0, // recomputed by ts-fsrs from last_review at review time
    scheduled_days: Math.max(0, Math.round((c.due - c.last) / DAY)),
    learning_steps: c.learningSteps,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last > 0 ? new Date(c.last) : undefined,
  };
}

function fromFsrsCard(c: Card): SrsCard {
  return {
    due: c.due.getTime(),
    last: c.last_review ? c.last_review.getTime() : 0,
    stability: c.stability,
    difficulty: c.difficulty,
    reps: c.reps,
    lapses: c.lapses,
    learningSteps: c.learning_steps,
    state: c.state as SrsCard['state'],
  };
}

function newCard(now: number): SrsCard {
  return fromFsrsCard(createEmptyCard(new Date(now)));
}

// ---- grading ----

/**
 * Derive an FSRS grade from what we can observe: correctness, how hard the
 * exercise type is, and how long the answer took.
 */
export function gradeFromSignals(correct: boolean, exType: string, latencyMs: number): Grade {
  if (!correct) return 1; // Again
  const hardType = exType === 'type-mn-en' || exType.startsWith('bank-');
  if (latencyMs > 12000) return 2; // Hard — correct but a struggle
  if (hardType && latencyMs < 5000) return 4; // Easy — fast recall on a production exercise
  return 3; // Good
}

/** Grade an item and reschedule it with FSRS; logs the review for the optimizer. */
export function reviewItem(key: string, grade: Grade) {
  setState((s) => {
    const now = Date.now();
    const f = getScheduler(s);
    const prev = s.srs[key] ?? newCard(now);
    const { card } = f.next(toFsrsCard(prev), new Date(now), grade);
    // answering a flagged item correctly clears the flag (its SRS schedule takes over)
    let flagged = s.flagged;
    if (grade >= 2 && flagged[key]) {
      flagged = { ...flagged };
      delete flagged[key];
    }
    let reviewLog = [...s.reviewLog, [key, now, grade] as const as [string, number, Grade]];
    if (reviewLog.length > REVIEW_LOG_MAX) reviewLog = reviewLog.slice(reviewLog.length - REVIEW_LOG_MAX);
    return { ...s, srs: { ...s.srs, [key]: fromFsrsCard(card) }, flagged, reviewLog };
  });
}

/** Probability (0..1) the item is still recallable right now. */
export function retrievabilityOf(s: AppState, card: SrsCard, now = Date.now()): number {
  if (card.state === 0 || card.last === 0) return 0;
  return getScheduler(s).get_retrievability(toFsrsCard(card), new Date(now), false);
}

/** Items due for review, lowest retrievability (most forgotten) first. */
export function dueItems(s: AppState, limit: number): string[] {
  const now = Date.now();
  return Object.entries(s.srs)
    .filter(([, c]) => c.due <= now)
    .map(([k, c]) => [k, retrievabilityOf(s, c, now)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k)
    .slice(0, limit);
}

/** Weakest learned items regardless of due date (for practice when nothing is due). */
export function weakestItems(s: AppState, limit: number): string[] {
  const now = Date.now();
  return Object.entries(s.srs)
    .map(([k, c]) => [k, retrievabilityOf(s, c, now)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([k]) => k)
    .slice(0, limit);
}

/** 0 = due/weak, 1 = fresh, 2 = good, 3 = strong. */
export function strengthOf(card: SrsCard | undefined): number {
  if (!card || card.due <= Date.now()) return 0;
  const scheduledDays = (card.due - card.last) / DAY;
  return scheduledDays >= 7 ? 3 : scheduledDays >= 3 ? 2 : 1;
}

/** A skill counts as gold once its combined word strength reaches this fraction. */
export const GOLD_STRENGTH = 0.9;

/** 0..1 — combined SRS strength of every word and sentence in the skill. */
export function skillStrength(s: AppState, skill: Skill): number {
  const keys = [
    ...skill.vocab.map((v) => `w:${skill.id}:${v.id}`),
    ...skill.sentences.map((se) => `s:${skill.id}:${se.id}`),
  ];
  if (keys.length === 0) return 0;
  const total = keys.reduce((sum, k) => sum + strengthOf(s.srs[k]), 0);
  return total / (keys.length * 3);
}

/** Manually mark an item as known: stable card, not due for a week, flag cleared. */
export function markKnown(key: string) {
  setState((s) => {
    const now = Date.now();
    const flagged = { ...s.flagged };
    delete flagged[key];
    const prev = s.srs[key];
    return {
      ...s,
      flagged,
      srs: {
        ...s.srs,
        [key]: {
          due: now + 7 * DAY,
          last: now,
          stability: 7,
          difficulty: 3,
          reps: Math.max(3, prev?.reps ?? 0),
          lapses: prev?.lapses ?? 0,
          learningSteps: 0,
          state: 2, // Review
        },
      },
    };
  });
}

export function wordsLearnedCount(s: AppState): number {
  return Object.keys(s.srs).filter((k) => k.startsWith('w:')).length;
}

export function dueCount(s: AppState): number {
  const now = Date.now();
  return Object.values(s.srs).filter((c) => c.due <= now).length;
}
