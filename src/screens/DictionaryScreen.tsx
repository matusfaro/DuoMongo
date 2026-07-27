import { useMemo, useState } from 'react';
import { sections } from '../data/course';
import { speak } from '../lib/audio';
import { useAppState } from '../lib/store';

export function DictionaryScreen() {
  const app = useAppState();
  const [query, setQuery] = useState('');
  const [showSentences, setShowSentences] = useState(false);

  const q = query.trim().toLowerCase();

  const groups = useMemo(() => {
    return sections.flatMap((sec) =>
      sec.skills
        .map((sk) => {
          const vocab = sk.vocab.filter(
            (v) =>
              !q ||
              v.mn.toLowerCase().includes(q) ||
              v.ro.toLowerCase().includes(q) ||
              v.en.toLowerCase().includes(q) ||
              (v.alt ?? []).some((a) => a.toLowerCase().includes(q))
          );
          const sentences = showSentences
            ? sk.sentences.filter(
                (s) => !q || s.mn.toLowerCase().includes(q) || s.ro.toLowerCase().includes(q) || s.en.toLowerCase().includes(q)
              )
            : [];
          return { skill: sk, vocab, sentences };
        })
        .filter((g) => g.vocab.length > 0 || g.sentences.length > 0)
    );
  }, [q, showSentences]);

  const total = groups.reduce((n, g) => n + g.vocab.length + g.sentences.length, 0);

  return (
    <div className="dict-screen">
      <div className="dict-search-row">
        <input
          className="dict-search"
          type="search"
          placeholder="Search Mongolian or English…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <label className="dict-toggle">
        <input type="checkbox" checked={showSentences} onChange={(e) => setShowSentences(e.target.checked)} />
        <span>Include sentences</span>
      </label>
      <div className="dict-count">{total} entries</div>
      {groups.map(({ skill, vocab, sentences }) => (
        <div key={skill.id} className="dict-group">
          <h3>
            {skill.icon} {skill.title}
          </h3>
          {vocab.map((v) => (
            <div key={v.id} className="dict-row" onClick={() => speak(v.mn)}>
              <button className="dict-speaker" aria-label={`Play ${v.mn}`}>
                🔊
              </button>
              <div className="dict-words">
                <b>
                  {v.emoji ? `${v.emoji} ` : ''}
                  {v.mn}
                </b>
                <span>
                  {app.settings.showRomanization ? `${v.ro} · ` : ''}
                  {v.en}
                  {v.alt && v.alt.length > 0 ? ` (${v.alt.join(', ')})` : ''}
                </span>
              </div>
            </div>
          ))}
          {sentences.map((s) => (
            <div key={s.id} className="dict-row sentence" onClick={() => speak(s.mn)}>
              <button className="dict-speaker" aria-label={`Play ${s.mn}`}>
                🔊
              </button>
              <div className="dict-words">
                <b>{s.mn}</b>
                <span>
                  {app.settings.showRomanization ? `${s.ro} · ` : ''}
                  {s.en}
                </span>
              </div>
            </div>
          ))}
        </div>
      ))}
      {total === 0 && <div className="dict-empty">Nothing found for “{query}”</div>}
    </div>
  );
}
