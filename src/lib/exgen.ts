import type { AppState, BankExercise, ChoiceExercise, Exercise, MatchExercise, ReplyPair, Sentence, ShadowExercise, Skill, TypeExercise, VocabItem } from '../types';
import { allSkills, allVocab, sentenceByKey, skillById, vocabByKey } from '../data/course';
import { MIN_PAIRS } from '../data/minpairs';

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

/** All accepted English translations of an item, lowercased. */
function acceptedEn(v: VocabItem): Set<string> {
  return new Set([v.en, ...(v.alt ?? [])].map((s) => s.toLowerCase()));
}

/** True if the two items could translate each other (shared meaning) — never valid as mutual distractors. */
function meaningsOverlap(a: VocabItem, b: VocabItem): boolean {
  if (a.mn === b.mn) return true;
  const ae = acceptedEn(a);
  for (const e of acceptedEn(b)) if (ae.has(e)) return true;
  return false;
}

function vocabDistractors(skill: Skill, item: VocabItem, field: 'mn' | 'en', n: number): string[] {
  const local = skill.vocab.filter((v) => v.id !== item.id);
  const global = allVocab;
  const pool = [...pick(local, n), ...pick(global, n * 2)];
  const seen = new Set<string>([item[field]]);
  const out: string[] = [];
  for (const p of pool) {
    // exclude any candidate whose option text would also be a correct answer
    if (meaningsOverlap(p, item)) continue;
    const val = p[field];
    if (!seen.has(val)) {
      seen.add(val);
      out.push(val);
      if (out.length >= n) break;
    }
  }
  return out;
}

/** Filter a vocab list so no two entries share a translation (keeps match pairs unambiguous). */
function unambiguousSubset(items: VocabItem[]): VocabItem[] {
  const out: VocabItem[] = [];
  for (const v of items) {
    if (out.some((o) => meaningsOverlap(o, v))) continue;
    out.push(v);
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

/** Dictation: hear the Mongolian sentence, assemble it from Mongolian tiles. */
function dictationFromSentence(skill: Skill, sent: Sentence): BankExercise {
  const answerTokens = tokenize(sent.mn);
  return {
    type: 'bank-listen-mn',
    prompt: sent.mn,
    promptRo: sent.ro,
    speak: sent.mn,
    answerTokens,
    bankTokens: shuffle([...answerTokens, ...bankDistractorTokens('mn', answerTokens, Math.min(4, answerTokens.length + 2))]),
    acceptedAnswers: [normalizeAnswer(sent.mn)],
    itemKey: `s:${skill.id}:${sent.id}`,
  };
}

/** Cloze: fill the blanked word in a Mongolian sentence (English shown for context). */
function clozeFromSentence(skill: Skill, sent: Sentence): ChoiceExercise | null {
  const tokens = tokenize(sent.mn);
  const candidates = tokens.map((t, i) => ({ t, i })).filter(({ t }) => t.length >= 2);
  if (candidates.length === 0) return null;
  const target = candidates[Math.floor(Math.random() * candidates.length)];
  const blanked = tokens.map((t, i) => (i === target.i ? '_____' : t)).join(' ');
  // distractors: same-language tokens from the global pool, not present in this sentence
  const lowerTokens = new Set(tokens.map((t) => t.toLowerCase()));
  const distractors = shuffle(allVocab.map((v) => v.mn))
    .flatMap((s) => tokenize(s))
    .filter((t) => !lowerTokens.has(t.toLowerCase()))
    .filter((t, i, arr) => arr.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i)
    .slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle([target.t, ...distractors]);
  return {
    type: 'cloze',
    prompt: blanked,
    sub: `"${sent.en}"`,
    speak: sent.mn, // spoken after answering — would give the answer away up front
    options,
    correctIndex: options.indexOf(target.t),
    itemKey: `s:${skill.id}:${sent.id}`,
  };
}

/** Pick the natural reply to a conversational prompt. */
function replyExercise(skill: Skill, pair: ReplyPair): ChoiceExercise {
  const options = shuffle([pair.aMn, ...pair.wrong]);
  return {
    type: 'reply',
    prompt: pair.qMn,
    promptRo: pair.qRo,
    sub: `"${pair.qEn}"`,
    speak: pair.qMn,
    options,
    correctIndex: options.indexOf(pair.aMn),
    itemKey: `r:${skill.id}:${pair.id}`,
  };
}

/** Minimal pair: hear one word, pick which of the lookalikes it was. */
function minpairExercise(skill: Skill, pair: [string, string]): ChoiceExercise {
  const target = pair[Math.floor(Math.random() * 2)];
  const options = shuffle([...pair]);
  const entry = [...vocabByKey.entries()].find(([, v]) => v.item.mn === target);
  return {
    type: 'minpair',
    prompt: target,
    speak: target,
    options,
    correctIndex: options.indexOf(target),
    itemKey: entry ? entry[0] : `w:${skill.id}:minpair`,
  };
}

/** Picture card: word (with audio) → pick the matching emoji. */
function pictureFromVocab(skill: Skill, item: VocabItem, isNew: boolean): ChoiceExercise | null {
  if (!item.emoji) return null;
  const pool = shuffle(allVocab.filter((v) => v.emoji && v.emoji !== item.emoji && !meaningsOverlap(v, item)));
  const distractors = [...new Set(pool.map((v) => v.emoji!))].slice(0, 3);
  if (distractors.length < 3) return null;
  const options = shuffle([item.emoji, ...distractors]);
  return {
    type: 'picture',
    prompt: item.mn,
    promptRo: item.ro,
    speak: item.mn,
    options,
    correctIndex: options.indexOf(item.emoji),
    bigOptions: true,
    newWordId: isNew ? item.id : undefined,
    itemKey: `w:${skill.id}:${item.id}`,
  };
}

/** Shadowing: hear the native clip, record yourself, self-grade. */
function shadowFromSentence(skill: Skill, sent: Sentence): ShadowExercise {
  return {
    type: 'speak-shadow',
    prompt: sent.mn,
    promptRo: sent.ro,
    sub: `"${sent.en}"`,
    speak: sent.mn,
    itemKey: `s:${skill.id}:${sent.id}`,
  };
}

/** Minimal pairs relevant to a skill (a pair member belongs to the skill's vocab). */
function skillMinPairs(skill: Skill): [string, string][] {
  const mns = new Set(skill.vocab.map((v) => v.mn));
  return MIN_PAIRS.filter(([a, b]) => mns.has(a) || mns.has(b));
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
      // introduce with a picture card when the word has one, else classic choice
      const pic = Math.random() < 0.5 ? pictureFromVocab(skill, v, isNew) : null;
      exercises.push(pic ?? choiceFromVocab(skill, v, 'mn-en', isNew));
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
      const r = Math.random();
      const cloze = r < 0.25 ? clozeFromSentence(skill, s) : null;
      exercises.push(cloze ?? bankFromSentence(skill, s, r < 0.6 ? 'mn-en' : 'en-mn'));
    } else if (crownLevel <= 3) {
      const r = Math.random();
      if (r < 0.2) {
        exercises.push(dictationFromSentence(skill, s));
      } else if (r < 0.4) {
        exercises.push(clozeFromSentence(skill, s) ?? bankFromSentence(skill, s, 'en-mn'));
      } else {
        exercises.push(bankFromSentence(skill, s, r < 0.7 ? 'mn-en' : 'en-mn'));
      }
    } else {
      const r = Math.random();
      if (r < 0.3) exercises.push(typeFromSentence(skill, s));
      else if (r < 0.5) exercises.push(dictationFromSentence(skill, s));
      else if (r < 0.65) exercises.push(shadowFromSentence(skill, s));
      else exercises.push(bankFromSentence(skill, s, 'en-mn'));
    }
  }

  // conversational replies from crown 1 up
  if (crownLevel >= 1 && skill.replies?.length) {
    for (const pair of pick(skill.replies, Math.min(2, skill.replies.length))) {
      exercises.push(replyExercise(skill, pair));
    }
  }

  // ear training from crown 1 up when the skill has sound-alike words
  if (crownLevel >= 1) {
    const pairs = skillMinPairs(skill);
    if (pairs.length > 0) {
      for (const pair of pick(pairs, Math.min(2, pairs.length))) {
        exercises.push(minpairExercise(skill, pair));
      }
    }
  }

  // One matching exercise per lesson if enough vocab
  const matchable = unambiguousSubset(shuffle(skill.vocab));
  if (matchable.length >= 4) {
    exercises.splice(Math.min(4, exercises.length), 0, matchFromVocab(skill, matchable.slice(0, 5)));
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
      if (r < 0.3) exercises.push(bankFromSentence(skill, entry.item, 'mn-en'));
      else if (r < 0.55) exercises.push(bankFromSentence(skill, entry.item, 'en-mn'));
      else if (r < 0.7) exercises.push(dictationFromSentence(skill, entry.item));
      else if (r < 0.85) exercises.push(clozeFromSentence(skill, entry.item) ?? typeFromSentence(skill, entry.item));
      else exercises.push(typeFromSentence(skill, entry.item));
    }
  }

  // sprinkle in ear training during practice
  for (const pair of pick(MIN_PAIRS, 2)) {
    exercises.push(minpairExercise(allSkills[0], pair));
  }

  const cleanPool = unambiguousSubset(matchPool);
  if (cleanPool.length >= 3) {
    const skill = skillById.get(matchSkillId) ?? allSkills[0];
    exercises.push(matchFromVocab(skill, cleanPool.slice(0, 5)));
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
