// Core domain types for DuoMongo

export interface VocabItem {
  id: string;
  mn: string; // Mongolian (Cyrillic)
  ro: string; // romanization
  en: string; // primary English translation
  alt?: string[]; // accepted alternate English answers
}

export interface Sentence {
  id: string;
  mn: string;
  ro: string;
  en: string;
  altEn?: string[];
}

export interface Skill {
  id: string;
  title: string;
  icon: string; // emoji
  vocab: VocabItem[];
  sentences: Sentence[];
  tips?: string; // short grammar/culture notes (markdown-lite: **bold**, newlines)
}

export interface Section {
  id: string;
  title: string;
  color: string;
  skills: Skill[];
}

// ---- Exercises ----

export type ExerciseType =
  | 'choice-mn-en' // read Mongolian, pick English
  | 'choice-en-mn' // read English, pick Mongolian
  | 'bank-mn-en' // translate Mongolian sentence via English word bank
  | 'bank-en-mn' // translate English sentence via Mongolian word bank
  | 'match' // match pairs
  | 'type-mn-en' // type English translation
  | 'listen-choice'; // hear Mongolian, pick meaning

export interface ChoiceExercise {
  type: 'choice-mn-en' | 'choice-en-mn' | 'listen-choice';
  prompt: string; // shown text (or spoken for listen)
  promptRo?: string;
  speak?: string; // Mongolian text to speak
  options: string[];
  correctIndex: number;
  newWordId?: string; // if introducing a new word, show teaching header
  itemKey: string; // SRS key
}

export interface BankExercise {
  type: 'bank-mn-en' | 'bank-en-mn';
  prompt: string;
  promptRo?: string;
  speak?: string;
  answerTokens: string[];
  bankTokens: string[]; // answer tokens + distractors, shuffled
  acceptedAnswers: string[]; // normalized full-string alternates
  itemKey: string;
}

export interface MatchExercise {
  type: 'match';
  pairs: { left: string; right: string }[]; // left = Mongolian, right = English
  itemKey: string;
}

export interface TypeExercise {
  type: 'type-mn-en';
  prompt: string;
  promptRo?: string;
  speak?: string;
  acceptedAnswers: string[]; // normalized
  display: string; // canonical answer to display
  itemKey: string;
}

export type Exercise = ChoiceExercise | BankExercise | MatchExercise | TypeExercise;

// ---- Progress / persistence ----

export interface SrsCard {
  ease: number;
  intervalDays: number;
  due: number; // epoch ms
  reps: number;
  lapses: number;
}

export interface SkillProgress {
  crowns: number; // 0..5
  lessonsDone: number; // within current crown level
}

export interface Settings {
  name: string;
  dailyGoal: number; // XP
  reminderEnabled: boolean;
  reminderTime: string; // 'HH:MM'
  soundEnabled: boolean;
  heartsEnabled: boolean;
  showRomanization: boolean;
}

export interface AppState {
  version: number;
  createdAt: number;
  xp: number;
  gems: number;
  hearts: number;
  heartsUpdatedAt: number;
  streak: number;
  longestStreak: number;
  lastActiveDay: string | null; // YYYY-MM-DD
  streakFreezes: number;
  xpByDay: Record<string, number>;
  skills: Record<string, SkillProgress>;
  srs: Record<string, SrsCard>;
  achievements: Record<string, number>; // id -> epoch ms earned
  lessonsCompleted: number;
  perfectLessons: number;
  practiceSessions: number;
  totalAnswers: number;
  correctAnswers: number;
  timeSpentMs: number;
  settings: Settings;
}
