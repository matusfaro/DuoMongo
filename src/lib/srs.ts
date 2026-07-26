import type { AppState, SrsCard } from '../types';
import { setState } from './store';

// Simplified SM-2 spaced repetition over item keys ("w:skill:word" / "s:skill:sentence")

const DAY = 24 * 60 * 60 * 1000;

function newCard(): SrsCard {
  return { ease: 2.5, intervalDays: 0, due: Date.now(), reps: 0, lapses: 0 };
}

export function reviewItem(key: string, correct: boolean) {
  setState((s) => {
    const card = { ...(s.srs[key] ?? newCard()) };
    if (correct) {
      card.reps += 1;
      if (card.reps === 1) card.intervalDays = 1;
      else if (card.reps === 2) card.intervalDays = 3;
      else card.intervalDays = Math.round(card.intervalDays * card.ease);
      card.ease = Math.min(3.0, card.ease + 0.05);
    } else {
      card.lapses += 1;
      card.reps = Math.max(0, card.reps - 1);
      card.intervalDays = 0;
      card.ease = Math.max(1.3, card.ease - 0.2);
    }
    card.due = Date.now() + Math.max(0.5, card.intervalDays) * DAY * (correct ? 1 : 0.02);
    return { ...s, srs: { ...s.srs, [key]: card } };
  });
}

/** Items due for review, weakest (most overdue relative to interval) first. */
export function dueItems(s: AppState, limit: number): string[] {
  const now = Date.now();
  return Object.entries(s.srs)
    .filter(([, c]) => c.due <= now)
    .sort((a, b) => {
      const overdueA = (now - a[1].due) / Math.max(1, a[1].intervalDays);
      const overdueB = (now - b[1].due) / Math.max(1, b[1].intervalDays);
      return overdueB - overdueA;
    })
    .map(([k]) => k)
    .slice(0, limit);
}

/** Weakest learned items regardless of due date (for practice when nothing is due). */
export function weakestItems(s: AppState, limit: number): string[] {
  return Object.entries(s.srs)
    .sort((a, b) => a[1].ease - b[1].ease || a[1].due - b[1].due)
    .map(([k]) => k)
    .slice(0, limit);
}

export function wordsLearnedCount(s: AppState): number {
  return Object.keys(s.srs).filter((k) => k.startsWith('w:')).length;
}

export function dueCount(s: AppState): number {
  const now = Date.now();
  return Object.values(s.srs).filter((c) => c.due <= now).length;
}
