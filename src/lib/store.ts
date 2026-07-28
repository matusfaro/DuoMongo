import { useSyncExternalStore } from 'react';
import type { AppState, SkillProgress } from '../types';

const KEY = 'duomongo-state-v1';

function defaultState(): AppState {
  return {
    version: 1,
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
    },
  };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as AppState;
    return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...parsed.settings } };
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

/** Toggle the practice flag on an item. Flagging resets its SRS card so it comes up immediately. */
export function toggleFlag(key: string) {
  setState((s) => {
    const flagged = { ...s.flagged };
    if (flagged[key]) {
      delete flagged[key];
      return { ...s, flagged };
    }
    flagged[key] = Date.now();
    const card = s.srs[key];
    const srs = {
      ...s.srs,
      [key]: {
        ease: Math.max(1.3, (card?.ease ?? 2.5) - 0.3),
        intervalDays: 0,
        due: Date.now(),
        reps: 0,
        lapses: card?.lapses ?? 0,
      },
    };
    return { ...s, flagged, srs };
  });
}

export function resetAllProgress() {
  state = defaultState();
  persist();
  listeners.forEach((l) => l());
}
