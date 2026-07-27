import type { Section, Skill, VocabItem, Sentence } from '../types';
import { section1, section2 } from './course1';
import { section3, section4 } from './course2';
import { section5 } from './course3';

export const sections: Section[] = [section1, section2, section3, section4, section5];

export const allSkills: Skill[] = sections.flatMap((s) => s.skills);

export const skillById = new Map<string, Skill>(allSkills.map((s) => [s.id, s]));

export const sectionOfSkill = new Map<string, Section>(
  sections.flatMap((sec) => sec.skills.map((sk) => [sk.id, sec] as [string, Section]))
);

export const allVocab: VocabItem[] = allSkills.flatMap((s) => s.vocab);
export const vocabByKey = new Map<string, { item: VocabItem; skillId: string }>();
for (const sk of allSkills) for (const v of sk.vocab) vocabByKey.set(`w:${sk.id}:${v.id}`, { item: v, skillId: sk.id });

export const sentenceByKey = new Map<string, { item: Sentence; skillId: string }>();
for (const sk of allSkills) for (const s of sk.sentences) sentenceByKey.set(`s:${sk.id}:${s.id}`, { item: s, skillId: sk.id });

// Ordered list of skills for unlock logic
export const skillOrder: string[] = allSkills.map((s) => s.id);

export const CROWN_LEVELS = 5;
export const LESSONS_PER_LEVEL = 3;
