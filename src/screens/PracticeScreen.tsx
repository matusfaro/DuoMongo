import { useAppState } from '../lib/store';
import { dueCount, wordsLearnedCount } from '../lib/srs';
import { vocabByKey } from '../data/course';

interface Props {
  onStartPractice: () => void;
}

export function PracticeScreen({ onStartPractice }: Props) {
  const app = useAppState();
  const due = dueCount(app);
  const learned = wordsLearnedCount(app);

  const wordRows = Object.entries(app.srs)
    .filter(([k]) => k.startsWith('w:'))
    .map(([k, card]) => ({ entry: vocabByKey.get(k), card }))
    .filter((r) => r.entry)
    .sort((a, b) => a.card.ease - b.card.ease);

  const now = Date.now();

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

      {wordRows.length > 0 && (
        <div className="word-list">
          <h3>Your words ({learned})</h3>
          {wordRows.map(({ entry, card }) => {
            const v = entry!.item;
            const strength = card.due > now ? (card.intervalDays >= 7 ? 3 : card.intervalDays >= 3 ? 2 : 1) : 0;
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
