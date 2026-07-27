import { useEffect, useState } from 'react';
import { stories } from '../data/stories';
import type { Story } from '../types';
import { playComplete, playCorrect, playWrong, speak } from '../lib/audio';
import { getState, recordSession, setState, useAppState } from '../lib/store';
import { checkAchievements } from '../lib/achievements';

export function StoriesScreen({ onBack }: { onBack: () => void }) {
  const app = useAppState();
  const [active, setActive] = useState<Story | null>(null);

  if (active) {
    return (
      <StoryPlayer
        story={active}
        soundOn={app.settings.soundEnabled}
        showRo={app.settings.showRomanization}
        onDone={() => setActive(null)}
      />
    );
  }

  return (
    <div className="stories-screen">
      <div className="stories-header">
        <button className="quit-btn stories-back" onClick={onBack} aria-label="Back">
          ←
        </button>
        <h2>📚 Stories</h2>
        <p>Short dialogues in Mongolian — listen, read, and answer questions.</p>
      </div>
      {stories.map((st) => {
        const done = app.storiesDone[st.id] ?? 0;
        return (
          <button key={st.id} className={`story-card ${done > 0 ? 'done' : ''}`} onClick={() => setActive(st)}>
            <span className="story-icon">{st.icon}</span>
            <span className="story-titles">
              <b>{st.title}</b>
              <span>{st.titleEn}</span>
            </span>
            <span className="story-meta">{done > 0 ? `✓ ×${done}` : `+${st.xp} XP`}</span>
          </button>
        );
      })}
    </div>
  );
}

function StoryPlayer({ story, soundOn, showRo, onDone }: { story: Story; soundOn: boolean; showRo: boolean; onDone: () => void }) {
  const [lineCount, setLineCount] = useState(1);
  const [showEn, setShowEn] = useState<Set<number>>(new Set());
  const [qIdx, setQIdx] = useState(-1); // -1 = still reading
  const [qAnswer, setQAnswer] = useState<number | null>(null);
  const [qCorrect, setQCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const linesDone = lineCount >= story.lines.length;

  useEffect(() => {
    const line = story.lines[lineCount - 1];
    if (line) speak(line.mn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lineCount]);

  const answerQuestion = (i: number) => {
    if (qAnswer !== null) return;
    setQAnswer(i);
    const right = i === story.questions[qIdx].correct;
    if (right) setQCorrect((c) => c + 1);
    if (soundOn) (right ? playCorrect : playWrong)();
    setTimeout(() => {
      setQAnswer(null);
      if (qIdx + 1 < story.questions.length) {
        setQIdx(qIdx + 1);
      } else {
        // complete
        setFinished(true);
        if (soundOn) playComplete();
        recordSession(story.xp, { perfect: false, isPractice: true, answers: story.questions.length, correct: qCorrect + (right ? 1 : 0), durationMs: 0 });
        setState((s) => ({ ...s, storiesDone: { ...s.storiesDone, [story.id]: (s.storiesDone[story.id] ?? 0) + 1 } }));
        checkAchievements(getState());
      }
    }, 1100);
  };

  if (finished) {
    return (
      <div className="story-player">
        <div className="story-finish">
          <div className="result-emoji">🎉</div>
          <h3>{story.title} — done!</h3>
          <p>
            {qCorrect}/{story.questions.length} questions right · +{story.xp} XP
          </p>
          <button className="btn-big btn-green" onClick={onDone}>
            CONTINUE
          </button>
        </div>
      </div>
    );
  }

  if (qIdx >= 0) {
    const q = story.questions[qIdx];
    return (
      <div className="story-player">
        <div className="story-top">
          <button className="quit-btn" onClick={onDone}>
            ✕
          </button>
          <b>
            Question {qIdx + 1}/{story.questions.length}
          </b>
        </div>
        <div className="lesson-body">
          <h2 className="ex-title">{q.q}</h2>
          <div className="options">
            {q.options.map((opt, i) => (
              <button
                key={i}
                className={`option ${qAnswer === i ? (i === q.correct ? 'opt-right' : 'opt-wrong') : ''} ${qAnswer !== null && i === q.correct ? 'opt-right' : ''}`}
                onClick={() => answerQuestion(i)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="story-player">
      <div className="story-top">
        <button className="quit-btn" onClick={onDone}>
          ✕
        </button>
        <b>
          {story.icon} {story.title}
        </b>
      </div>
      <div className="story-lines">
        {story.lines.slice(0, lineCount).map((line, i) => (
          <div key={i} className={`story-line ${line.sp === '' ? 'narrator' : line.sp === 'Бат' ? 'left' : 'right'}`}>
            {line.sp && <div className="story-speaker">{line.sp}</div>}
            <button
              className="story-bubble"
              onClick={() => {
                speak(line.mn);
                const next = new Set(showEn);
                if (next.has(i)) next.delete(i);
                else next.add(i);
                setShowEn(next);
              }}
            >
              <span className="story-mn">{line.mn}</span>
              {showRo && <span className="story-ro">{line.ro}</span>}
              {showEn.has(i) && <span className="story-en">{line.en}</span>}
            </button>
          </div>
        ))}
        <div className="story-hint">Tap a bubble to replay it and show the translation</div>
      </div>
      <div className="lesson-footer">
        {linesDone ? (
          <button className="btn-big btn-green" onClick={() => setQIdx(0)}>
            ANSWER QUESTIONS
          </button>
        ) : (
          <button className="btn-big btn-blue" onClick={() => setLineCount((c) => c + 1)}>
            CONTINUE
          </button>
        )}
      </div>
    </div>
  );
}
