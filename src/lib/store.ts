import { useSyncExternalStore } from 'react';
import type { AppState, LegacySrsCard, SkillProgress, SrsCard } from '../types';

const KEY = 'duomongo-state-v1';
const DAY = 24 * 60 * 60 * 1000;

function defaultState(): AppState {
  return {
    version: 2,
    createdAt: Date.now(),
    xp: 0,
    gems: 100,
    streak: 0,
    longestStreak: 0,
    lastActiveDay: null,
    streakFreezes: 1,
    xpByDay: {},
    skills: {},
    srs: {},
    achievements: {},
    lessonsCompleted: 0,
    perfectLessons: 0,
    practiceSessions: 0,
    storiesDone: {},
    flagged: {},
    reviewLog: [],
    fsrsWeights: null,
    totalAnswers: 0,
    correctAnswers: 0,
    timeSpentMs: 0,
    settings: {
      name: 'Learner',
      dailyGoal: 20,
      reminderEnabled: true,
      reminderTime: '19:00',
      soundEnabled: true,
      showRomanization: true,
      targetRetention: 0.9,
    },
  };
}

/** v1 (SM-2 {ease, intervalDays, ...}) -> v2 (FSRS {stability, difficulty, ...}) card conversion. */
function migrateSrsCard(old: LegacySrsCard): SrsCard {
  const clamp = (lo: number, hi: number, v: number) => Math.min(hi, Math.max(lo, v));
  return {
    due: old.due, // preserved exactly — no review-queue flood on upgrade
    last: old.due - old.intervalDays * DAY,
    stability: Math.max(0.2, old.intervalDays),
    difficulty: clamp(1, 10, 1 + ((3.0 - old.ease) / (3.0 - 1.3)) * 9),
    reps: old.reps,
    lapses: old.lapses,
    learningSteps: 0,
    state: old.reps > 0 ? 2 : 1, // Review : Learning
  };
}

function migrate(s: AppState): AppState {
  if (s.version >= 2) return s;
  const srs: Record<string, SrsCard> = {};
  for (const [key, card] of Object.entries(s.srs)) {
    // old cards have `ease`; anything already FSRS-shaped passes through
    srs[key] = 'ease' in card ? migrateSrsCard(card as unknown as LegacySrsCard) : card;
  }
  return { ...s, version: 2, srs };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    const merged = { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...parsed.settings } };
    // saved state predates the new settings/version fields -> shallow merge gave
    // it version 2 defaults; trust the persisted version when one was stored
    merged.version = typeof parsed.version === 'number' ? parsed.version : 1;
    return migrate(merged);
  } catch {
    return defaultState();
  }
}

let state: AppState = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable; keep going in-memory
  }
}

export function getState(): AppState {
  return state;
}

export function setState(updater: (s: AppState) => AppState) {
  state = updater(state);
  persist();
  listeners.forEach((l) => l());
}

export function useAppState(): AppState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state
  );
}

// ---- helpers ----

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function dayKeyOffset(offset: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + offset);
  return todayKey(d);
}

export function buyStreakFreeze(costGems: number): boolean {
  let ok = false;
  setState((s) => {
    if (s.gems < costGems || s.streakFreezes >= 2) return s;
    ok = true;
    return { ...s, gems: s.gems - costGems, streakFreezes: s.streakFreezes + 1 };
  });
  return ok;
}

/** Record activity today: updates streak (consuming freezes for a 1-day gap), XP tallies. */
export function recordSession(xpGained: number, opts: { perfect: boolean; isPractice: boolean; answers: number; correct: number; durationMs: number }) {
  setState((s) => {
    const today = todayKey();
    const yesterday = dayKeyOffset(-1);
    const dayBefore = dayKeyOffset(-2);
    let streak = s.streak;
    let freezes = s.streakFreezes;
    if (s.lastActiveDay === today) {
      // already counted today
    } else if (s.lastActiveDay === yesterday) {
      streak += 1;
    } else if (s.lastActiveDay === dayBefore && freezes > 0) {
      freezes -= 1; // streak freeze saved the missed day
      streak += 1;
    } else {
      streak = 1;
    }
    const xpByDay = { ...s.xpByDay, [today]: (s.xpByDay[today] ?? 0) + xpGained };
    return {
      ...s,
      xp: s.xp + xpGained,
      gems: s.gems + (opts.perfect ? 10 : 5),
      streak,
      longestStreak: Math.max(s.longestStreak, streak),
      streakFreezes: freezes,
      lastActiveDay: today,
      xpByDay,
      lessonsCompleted: s.lessonsCompleted + (opts.isPractice ? 0 : 1),
      practiceSessions: s.practiceSessions + (opts.isPractice ? 1 : 0),
      perfectLessons: s.perfectLessons + (opts.perfect ? 1 : 0),
      totalAnswers: s.totalAnswers + opts.answers,
      correctAnswers: s.correctAnswers + opts.correct,
      timeSpentMs: s.timeSpentMs + opts.durationMs,
    };
  });
}

export function getSkillProgress(s: AppState, skillId: string): SkillProgress {
  return s.skills[skillId] ?? { crowns: 0, lessonsDone: 0 };
}

export function advanceSkill(skillId: string, lessonsPerLevel: number, maxCrowns: number) {
  setState((s) => {
    const cur = getSkillProgress(s, skillId);
    if (cur.crowns >= maxCrowns) return s;
    let { crowns, lessonsDone } = cur;
    lessonsDone += 1;
    if (lessonsDone >= lessonsPerLevel) {
      crowns += 1;
      lessonsDone = 0;
    }
    return { ...s, skills: { ...s.skills, [skillId]: { crowns, lessonsDone } } };
  });
}

/** Toggle the practice flag on an item. Flagging makes it due now so it surfaces immediately. */
export function toggleFlag(key: string) {
  setState((s) => {
    const now = Date.now();
    const flagged = { ...s.flagged };
    if (flagged[key]) {
      delete flagged[key];
      return { ...s, flagged };
    }
    flagged[key] = now;
    const card = s.srs[key];
    // Make it due immediately but keep its FSRS memory state intact — if the
    // learner really forgot it, the next grade will lapse it properly.
    const srs: typeof s.srs = {
      ...s.srs,
      [key]: card
        ? { ...card, due: now }
        : { due: now, last: 0, stability: 0, difficulty: 0, reps: 0, lapses: 0, learningSteps: 0, state: 0 },
    };
    return { ...s, flagged, srs };
  });
}

export function resetAllProgress() {
  state = defaultState();
  persist();
  listeners.forEach((l) => l());
}
