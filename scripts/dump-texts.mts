// Dump all unique Mongolian texts from the course to scripts/texts.json
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { allSkills } from '../src/data/course';
import { stories } from '../src/data/stories';

const texts = new Set<string>();
for (const sk of allSkills) {
  for (const v of sk.vocab) texts.add(v.mn);
  for (const s of sk.sentences) texts.add(s.mn);
  for (const r of sk.replies ?? []) {
    texts.add(r.qMn);
    texts.add(r.aMn);
  }
}
for (const st of stories) for (const line of st.lines) texts.add(line.mn);

const entries = [...texts].map((t) => ({
  text: t,
  file: createHash('md5').update(t).digest('hex').slice(0, 12) + '.mp3',
}));

writeFileSync('scripts/texts.json', JSON.stringify(entries, null, 1));
console.log(`dumped ${entries.length} unique texts`);
