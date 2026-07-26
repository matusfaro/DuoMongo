import type { AppState, BankExercise, ChoiceExercise, Exercise, MatchExercise, Sentence, Skill, TypeExercise, VocabItem } from '../types';
import { allSkills, allVocab, sentenceByKey, skillById, vocabByKey } from '../data/course';

// ---- utils ----

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}

export function normalizeAnswer(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'’"«»\-—()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(s: string): string[] {
  return s.replace(/[.,!?;:«»]/g, '').split(/\s+/).filter(Boolean);
}

// ---- distractor pools ----

function vocabDistractors(skill: Skill, item: VocabItem, field: 'mn' | 'en', n: number): string[] {
  const local = skill.vocab.filter((v) => v.id !== item.id);
  const global = allVocab.filter((v) => v.en !== item.en && v.mn !== item.mn);
  const pool = [...pick(local, n), ...pick(global, n * 2)];
  const seen = new Set<string>([item[field]]);
  const out: string[] = [];
  for (const p of pool) {
    const val = p[field];
    if (!seen.has(val)) {
      seen.add(val);
      out.push(val);
      if (out.length >= n) break;
    }
  }
  return out;
}

function bankDistractorTokens(lang: 'mn' | 'en', answerTokens: string[], n: number): string[] {
  const pool = shuffle(allVocab)
    .map((v) => (lang === 'mn' ? v.mn : v.en))
    .flatMap((s) => tokenize(s))
    .filter((t) => !answerTokens.some((a) => a.toLowerCase() === t.toLowerCase()));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of pool) {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(t);
      if (out.length >= n) break;
    }
  }
  return out;
}

// ---- exercise builders ----

function choiceFromVocab(skill: Skill, item: VocabItem, dir: 'mn-en' | 'en-mn', isNew: boolean): ChoiceExercise {
  const key = `w:${skill.id}:${item.id}`;
  if (dir === 'mn-en') {
    const options = shuffle([item.en, ...vocabDistractors(skill, item, 'en', 3)]);
    return {
      type: 'choice-mn-en',
      prompt: item.mn,
      promptRo: item.ro,
      speak: item.mn,
      options,
      correctIndex: options.indexOf(item.en),
      newWordId: isNew ? item.id : undefined,
      itemKey: key,
    };
  }
  const options = shuffle([item.mn, ...vocabDistractors(skill, item, 'mn', 3)]);
  return {
    type: 'choice-en-mn',
    prompt: item.en,
    options,
    correctIndex: options.indexOf(item.mn),
    newWordId: isNew ? item.id : undefined,
    itemKey: key,
  };
}

function listenChoice(skill: Skill, item: VocabItem): ChoiceExercise {
  const options = shuffle([item.en, ...vocabDistractors(skill, item, 'en', 3)]);
  return {
    type: 'listen-choice',
    prompt: item.mn,
    promptRo: item.ro,
    speak: item.mn,
    options,
    correctIndex: options.indexOf(item.en),
    itemKey: `w:${skill.id}:${item.id}`,
  };
}

function bankFromSentence(skill: Skill, sent: Sentence, dir: 'mn-en' | 'en-mn'): BankExercise {
  const key = `s:${skill.id}:${sent.id}`;
  if (dir === 'mn-en') {
    const answerTokens = tokenize(sent.en);
    return {
      type: 'bank-mn-en',
      prompt: sent.mn,
      promptRo: sent.ro,
      speak: sent.mn,
      answerTokens,
      bankTokens: shuffle([...answerTokens, ...bankDistractorTokens('en', answerTokens, Math.min(4, answerTokens.length + 2))]),
      acceptedAnswers: [sent.en, ...(sent.altEn ?? [])].map(normalizeAnswer),
      itemKey: key,
    };
  }
  const answerTokens = tokenize(sent.mn);
  return {
    type: 'bank-en-mn',
    prompt: sent.en,
    answerTokens,
    bankTokens: shuffle([...answerTokens, ...bankDistractorTokens('mn', answerTokens, Math.min(4, answerTokens.length + 2))]),
    acceptedAnswers: [normalizeAnswer(sent.mn)],
    itemKey: key,
  };
}

function typeFromSentence(skill: Skill, sent: Sentence): TypeExercise {
  return {
    type: 'type-mn-en',
    prompt: sent.mn,
    promptRo: sent.ro,
    speak: sent.mn,
    acceptedAnswers: [sent.en, ...(sent.altEn ?? [])].map(normalizeAnswer),
    display: sent.en,
    itemKey: `s:${skill.id}:${sent.id}`,
  };
}

function matchFromVocab(skill: Skill, items: VocabItem[]): MatchExercise {
  return {
    type: 'match',
    pairs: items.map((v) => ({ left: v.mn, right: v.en })),
    itemKey: `m:${skill.id}`,
  };
}

// ---- lesson generation ----

/**
 * Generate a lesson for a skill at a given crown level (0-based) and lesson index.
 * Higher crown levels shift toward harder exercise types.
 */
export function generateLesson(state: AppState, skillId: string, crownLevel: number, lessonIndex: number): Exercise[] {
  const skill = skillById.get(skillId);
  if (!skill) return [];
  const known = new Set(Object.keys(state.srs));

  // Rotate vocab/sentence subsets by lesson index for variety and coverage
  const vocabCount = Math.min(6, skill.vocab.length);
  const start = (lessonIndex * 4) % skill.vocab.length;
  const rotated = [...skill.vocab.slice(start), ...skill.vocab.slice(0, start)];
  const vocab = rotated.slice(0, vocabCount);
  const sentences = pick(skill.sentences, Math.min(5, skill.sentences.length));

  const exercises: Exercise[] = [];

  for (const v of vocab) {
    const isNew = !known.has(`w:${skill.id}:${v.id}`);
    if (isNew || crownLevel === 0) {
      exercises.push(choiceFromVocab(skill, v, 'mn-en', isNew));
      if (exercises.length % 3 === 0) exercises.push(choiceFromVocab(skill, v, 'en-mn', false));
    } else if (crownLevel <= 2) {
      exercises.push(choiceFromVocab(skill, v, Math.random() < 0.5 ? 'mn-en' : 'en-mn', false));
    } else {
      exercises.push(Math.random() < 0.4 ? listenChoice(skill, v) : choiceFromVocab(skill, v, 'en-mn', false));
    }
  }

  for (const s of sentences) {
    if (crownLevel === 0) {
      exercises.push(bankFromSentence(skill, s, 'mn-en'));
    } else if (crownLevel === 1) {
      exercises.push(bankFromSentence(skill, s, Math.random() < 0.6 ? 'mn-en' : 'en-mn'));
    } else if (crownLevel <= 3) {
      exercises.push(bankFromSentence(skill, s, Math.random() < 0.4 ? 'mn-en' : 'en-mn'));
    } else {
      exercises.push(Math.random() < 0.5 ? typeFromSentence(skill, s) : bankFromSentence(skill, s, 'en-mn'));
    }
  }

  // One matching exercise per lesson if enough vocab
  if (skill.vocab.length >= 4) {
    exercises.splice(Math.min(4, exercises.length), 0, matchFromVocab(skill, pick(skill.vocab, Math.min(5, skill.vocab.length))));
  }

  return shuffle(exercises).slice(0, 14);
}

/** Generate a practice session from SRS item keys (mixed skills). */
export function generatePractice(itemKeys: string[]): Exercise[] {
  const exercises: Exercise[] = [];
  const matchPool: VocabItem[] = [];
  let matchSkillId = '';

  for (const key of itemKeys) {
    if (key.startsWith('w:')) {
      const entry = vocabByKey.get(key);
      if (!entry) continue;
      const skill = skillById.get(entry.skillId);
      if (!skill) continue;
      const r = Math.random();
      if (r < 0.35) exercises.push(choiceFromVocab(skill, entry.item, 'mn-en', false));
      else if (r < 0.7) exercises.push(choiceFromVocab(skill, entry.item, 'en-mn', false));
      else {
        matchPool.push(entry.item);
        matchSkillId = entry.skillId;
      }
    } else if (key.startsWith('s:')) {
      const entry = sentenceByKey.get(key);
      if (!entry) continue;
      const skill = skillById.get(entry.skillId);
      if (!skill) continue;
      const r = Math.random();
      if (r < 0.45) exercises.push(bankFromSentence(skill, entry.item, 'mn-en'));
      else if (r < 0.8) exercises.push(bankFromSentence(skill, entry.item, 'en-mn'));
      else exercises.push(typeFromSentence(skill, entry.item));
    }
  }

  if (matchPool.length >= 3) {
    const skill = skillById.get(matchSkillId) ?? allSkills[0];
    exercises.push(matchFromVocab(skill, matchPool.slice(0, 5)));
  } else if (matchPool.length > 0) {
    for (const item of matchPool) {
      const entry = [...vocabByKey.entries()].find(([, v]) => v.item.id === item.id);
      if (entry) {
        const skill = skillById.get(entry[1].skillId);
        if (skill) exercises.push(choiceFromVocab(skill, item, 'mn-en', false));
      }
    }
  }

  return shuffle(exercises).slice(0, 12);
}
