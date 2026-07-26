import type { AppState } from '../types';
import { setState } from './store';
import { wordsLearnedCount } from './srs';
import { allSkills, CROWN_LEVELS } from '../data/course';

export interface AchievementDef {
  id: string;
  icon: string;
  title: string;
  desc: string;
  check: (s: AppState) => boolean;
  progress: (s: AppState) => { cur: number; max: number };
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'first-lesson', icon: '🐣', title: 'First Steps', desc: 'Complete your first lesson', check: (s) => s.lessonsCompleted >= 1, progress: (s) => ({ cur: Math.min(1, s.lessonsCompleted), max: 1 }) },
  { id: 'lessons-10', icon: '📚', title: 'Bookworm', desc: 'Complete 10 lessons', check: (s) => s.lessonsCompleted >= 10, progress: (s) => ({ cur: Math.min(10, s.lessonsCompleted), max: 10 }) },
  { id: 'lessons-50', icon: '🎓', title: 'Scholar', desc: 'Complete 50 lessons', check: (s) => s.lessonsCompleted >= 50, progress: (s) => ({ cur: Math.min(50, s.lessonsCompleted), max: 50 }) },
  { id: 'streak-3', icon: '🔥', title: 'Kindling', desc: 'Reach a 3-day streak', check: (s) => s.streak >= 3, progress: (s) => ({ cur: Math.min(3, s.streak), max: 3 }) },
  { id: 'streak-7', icon: '🚀', title: 'Wildfire', desc: 'Reach a 7-day streak', check: (s) => s.streak >= 7, progress: (s) => ({ cur: Math.min(7, s.streak), max: 7 }) },
  { id: 'streak-30', icon: '🌋', title: 'Inferno', desc: 'Reach a 30-day streak', check: (s) => s.streak >= 30, progress: (s) => ({ cur: Math.min(30, s.streak), max: 30 }) },
  { id: 'xp-100', icon: '⭐', title: 'Rising Star', desc: 'Earn 100 XP', check: (s) => s.xp >= 100, progress: (s) => ({ cur: Math.min(100, s.xp), max: 100 }) },
  { id: 'xp-1000', icon: '🌟', title: 'Superstar', desc: 'Earn 1000 XP', check: (s) => s.xp >= 1000, progress: (s) => ({ cur: Math.min(1000, s.xp), max: 1000 }) },
  { id: 'words-25', icon: '💬', title: 'Wordsmith', desc: 'Learn 25 words', check: (s) => wordsLearnedCount(s) >= 25, progress: (s) => ({ cur: Math.min(25, wordsLearnedCount(s)), max: 25 }) },
  { id: 'words-100', icon: '🗣️', title: 'Polyglot', desc: 'Learn 100 words', check: (s) => wordsLearnedCount(s) >= 100, progress: (s) => ({ cur: Math.min(100, wordsLearnedCount(s)), max: 100 }) },
  { id: 'perfect-1', icon: '💯', title: 'Flawless', desc: 'Finish a lesson with no mistakes', check: (s) => s.perfectLessons >= 1, progress: (s) => ({ cur: Math.min(1, s.perfectLessons), max: 1 }) },
  { id: 'perfect-10', icon: '👑', title: 'Perfectionist', desc: 'Finish 10 perfect lessons', check: (s) => s.perfectLessons >= 10, progress: (s) => ({ cur: Math.min(10, s.perfectLessons), max: 10 }) },
  { id: 'practice-5', icon: '🧠', title: 'Sharp Mind', desc: 'Complete 5 practice sessions', check: (s) => s.practiceSessions >= 5, progress: (s) => ({ cur: Math.min(5, s.practiceSessions), max: 5 }) },
  { id: 'crown-first', icon: '🏵️', title: 'Crowned', desc: 'Earn your first crown', check: (s) => Object.values(s.skills).some((sk) => sk.crowns >= 1), progress: (s) => ({ cur: Object.values(s.skills).some((sk) => sk.crowns >= 1) ? 1 : 0, max: 1 }) },
  { id: 'skill-master', icon: '🏆', title: 'Skill Master', desc: 'Fully master a skill (5 crowns)', check: (s) => Object.values(s.skills).some((sk) => sk.crowns >= CROWN_LEVELS), progress: (s) => ({ cur: Math.max(0, ...Object.values(s.skills).map((sk) => sk.crowns), 0), max: CROWN_LEVELS }) },
  { id: 'course-complete', icon: '🇲🇳', title: 'Steppe Legend', desc: 'Master every skill in the course', check: (s) => allSkills.every((sk) => (s.skills[sk.id]?.crowns ?? 0) >= CROWN_LEVELS), progress: (s) => ({ cur: allSkills.filter((sk) => (s.skills[sk.id]?.crowns ?? 0) >= CROWN_LEVELS).length, max: allSkills.length }) },
];

/** Check all achievements; returns newly earned ones. */
export function checkAchievements(s: AppState): AchievementDef[] {
  const newly = ACHIEVEMENTS.filter((a) => !s.achievements[a.id] && a.check(s));
  if (newly.length > 0) {
    setState((st) => ({
      ...st,
      achievements: { ...st.achievements, ...Object.fromEntries(newly.map((a) => [a.id, Date.now()])) },
      gems: st.gems + newly.length * 20,
    }));
  }
  return newly;
}
