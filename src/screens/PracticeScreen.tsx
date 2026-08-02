import { toggleFlag, useAppState } from '../lib/store';
import { dueCount, retrievabilityOf, strengthOf, wordsLearnedCount } from '../lib/srs';
import { sentenceByKey, vocabByKey } from '../data/course';
import { speak } from '../lib/audio';

interface Props {
  onStartPractice: () => void;
}

export function PracticeScreen({ onStartPractice }: Props) {
  const app = useAppState();
  const due = dueCount(app);
  const learned = wordsLearnedCount(app);

  const now = Date.now();
  const wordRows = Object.entries(app.srs)
    .filter(([k]) => k.startsWith('w:'))
    .map(([k, card]) => ({ entry: vocabByKey.get(k), card, r: retrievabilityOf(app, card, now) }))
    .filter((r) => r.entry)
    .sort((a, b) => a.r - b.r); // most-forgotten first

  return (
    <div className="practice-screen">
      <div className="practice-hero">
        <div className="practice-hero-icon">🧠</div>
        <h2>Practice</h2>
        <p>
          {learned === 0
            ? 'Complete a lesson first — then your weakest words show up here for review.'
            : due > 0
              ? `${due} item${due === 1 ? '' : 's'} due for review. Reviewing at the right time locks words into long-term memory.`
              : 'Nothing due right now — a practice session will review your weakest words.'}
        </p>
        <button className="btn-big btn-blue" disabled={learned === 0} onClick={onStartPractice}>
          {due > 0 ? `REVIEW ${Math.min(due, 12)} ITEMS +10 XP` : 'PRACTICE WEAK WORDS +10 XP'}
        </button>
      </div>

      {Object.keys(app.flagged).length > 0 && (
        <div className="word-list flagged-list">
          <h3>🚩 Special attention ({Object.keys(app.flagged).length})</h3>
          <p className="flagged-note">These come first in every practice session. A flag clears itself once you answer the item correctly — or remove it here.</p>
          {Object.keys(app.flagged).map((key) => {
            const v = vocabByKey.get(key)?.item;
            const s = sentenceByKey.get(key)?.item;
            const mn = v?.mn ?? s?.mn;
            const ro = v?.ro ?? s?.ro;
            const en = v?.en ?? s?.en;
            if (!mn) return null;
            return (
              <div key={key} className="word-row">
                <div onClick={() => speak(mn)}>
                  <div className="word-mn">🔊 {mn}</div>
                  <div className="word-en">
                    {app.settings.showRomanization ? `${ro} · ` : ''}
                    {en}
                  </div>
                </div>
                <button className="btn-small btn-danger" onClick={() => toggleFlag(key)}>
                  REMOVE
                </button>
              </div>
            );
          })}
        </div>
      )}

      {wordRows.length > 0 && (
        <div className="word-list">
          <h3>Your words ({learned})</h3>
          {wordRows.map(({ entry, card }) => {
            const v = entry!.item;
            const strength = strengthOf(card);
            return (
              <div key={v.id + entry!.skillId} className="word-row">
                <div>
                  <div className="word-mn">{v.mn}</div>
                  <div className="word-en">
                    {app.settings.showRomanization ? `${v.ro} · ` : ''}
                    {v.en}
                  </div>
                </div>
                <div className="strength" title={['due for review', 'still fresh', 'good', 'strong'][strength]}>
                  {Array.from({ length: 4 }, (_, i) => (
                    <span key={i} className={`strength-bar ${i <= strength ? 'on' : ''} ${strength === 0 ? 'due' : ''}`} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
