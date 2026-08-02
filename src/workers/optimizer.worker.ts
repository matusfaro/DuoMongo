import { optimizeWeights } from '../lib/optimizer';
import type { ReviewLogEntry } from '../types';

// Web Worker wrapper so weight fitting never janks the UI thread.

export interface OptimizerRequest {
  log: ReviewLogEntry[];
}

export type OptimizerResponse =
  | { type: 'progress'; fraction: number; loss: number }
  | { type: 'done'; weights: number[]; lossBefore: number; lossAfter: number; samples: number }
  | { type: 'error'; message: string };

self.onmessage = (e: MessageEvent<OptimizerRequest>) => {
  try {
    let lastPost = 0;
    const result = optimizeWeights(e.data.log, (fraction, loss) => {
      const now = Date.now();
      if (now - lastPost > 200 || fraction >= 1) {
        lastPost = now;
        self.postMessage({ type: 'progress', fraction, loss } satisfies OptimizerResponse);
      }
    });
    if (!result) {
      self.postMessage({
        type: 'error',
        message: 'Not enough multi-day review history to fit weights yet.',
      } satisfies OptimizerResponse);
      return;
    }
    self.postMessage({ type: 'done', ...result } satisfies OptimizerResponse);
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) } satisfies OptimizerResponse);
  }
};
