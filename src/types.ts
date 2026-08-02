// Core domain types for DuoMongo

export interface VocabItem {
  id: string;
  mn: string; // Mongolian (Cyrillic)
  ro: string; // romanization
  en: string; // primary English translation
  alt?: string[]; // accepted alternate English answers
  emoji?: string; // picture-card emoji for concrete nouns
}

/** A conversational prompt with its natural reply (for "pick the reply" exercises). */
export interface ReplyPair {
  id: string;
  qMn: string;
  qRo: string;
  qEn: string;
  aMn: string;
  aRo: string;
  aEn: string;
  wrong: string[]; // implausible replies (Mongolian)
}

export interface StoryLine {
  sp: string; // speaker name ('' = narrator)
  mn: string;
  ro: string;
  en: string;
}

export interface StoryQuestion {
  q: string; // English comprehension question
  options: string[];
  correct: number;
}

export interface Story {
  id: string;
  title: string;
  titleEn: string;
  icon: string;
  xp: number;
  lines: StoryLine[];
  questions: StoryQuestion[];
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
  replies?: ReplyPair[];
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
  | 'bank-listen-mn' // hear Mongolian, assemble it from Mongolian tiles (dictation)
  | 'match' // match pairs
  | 'type-mn-en' // type English translation
  | 'listen-choice' // hear Mongolian, pick meaning
  | 'cloze' // fill in the blank
  | 'reply' // pick the natural reply
  | 'minpair' // hear a word, pick between lookalikes
  | 'picture' // pick the matching emoji
  | 'speak-shadow'; // record yourself and compare with the native clip

export interface ChoiceExercise {
  type: 'choice-mn-en' | 'choice-en-mn' | 'listen-choice' | 'cloze' | 'reply' | 'minpair' | 'picture';
  prompt: string; // shown text (or spoken for listen)
  promptRo?: string;
  sub?: string; // secondary context line (e.g. English translation for cloze)
  speak?: string; // Mongolian text to speak
  options: string[];
  correctIndex: number;
  bigOptions?: boolean; // render options large (emoji cards)
  newWordId?: string; // if introducing a new word, show teaching header
  itemKey: string; // SRS key
}

export interface BankExercise {
  type: 'bank-mn-en' | 'bank-en-mn' | 'bank-listen-mn';
  prompt: string;
  promptRo?: string;
  speak?: string;
  answerTokens: string[];
  bankTokens: string[]; // answer tokens + distractors, shuffled
  acceptedAnswers: string[]; // normalized full-string alternates
  itemKey: string;
}

export interface ShadowExercise {
  type: 'speak-shadow';
  prompt: string; // Mongolian to say
  promptRo?: string;
  sub?: string; // English meaning
  speak: string;
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

export type Exercise = ChoiceExercise | BankExercise | MatchExercise | TypeExercise | ShadowExercise;

// ---- Progress / persistence ----

/** FSRS memory card (plain numbers for JSON persistence; converted to ts-fsrs Card at the srs.ts boundary). */
export interface SrsCard {
  due: number; // epoch ms
  last: number; // epoch ms of last review (0 = never reviewed)
  stability: number; // FSRS S, days
  difficulty: number; // FSRS D, 1..10
  reps: number;
  lapses: number;
  learningSteps: number; // position within (re)learning steps
  state: 0 | 1 | 2 | 3; // ts-fsrs State: New / Learning / Review / Relearning
}

/** Pre-FSRS card shape (SM-2), still present in persisted states with version < 2. */
export interface LegacySrsCard {
  ease: number;
  intervalDays: number;
  due: number;
  reps: number;
  lapses: number;
}

/** FSRS rating: 1 Again · 2 Hard · 3 Good · 4 Easy. */
export type Grade = 1 | 2 | 3 | 4;

/** Compact review-history tuple for the on-device weight optimizer. */
export type ReviewLogEntry = [key: string, ts: number, grade: Grade];

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
  showRomanization: boolean;
  targetRetention: number; // FSRS desired recall probability at review time (0.8..0.95)
}

export interface AppState {
  version: number;
  createdAt: number;
  xp: number;
  gems: number;
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
  storiesDone: Record<string, number>; // story id -> completions
  flagged: Record<string, number>; // item key -> flagged-at timestamp (wants extra practice)
  reviewLog: ReviewLogEntry[]; // capped history for fitting FSRS weights
  fsrsWeights: number[] | null; // personalized FSRS-6 weights; null = ts-fsrs defaults
  totalAnswers: number;
  correctAnswers: number;
  timeSpentMs: number;
  settings: Settings;
}
