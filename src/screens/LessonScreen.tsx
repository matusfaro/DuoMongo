import { useMemo, useRef, useState } from 'react';
import type { BankExercise, ChoiceExercise, Exercise, MatchExercise, TypeExercise } from '../types';
import { BankEx, bankAnswerText, checkBank, ChoiceEx, checkType, MatchEx, TypeEx } from '../components/exercises';
import { playComplete, playCorrect, playWrong, speak } from '../lib/audio';
import { getState, loseHeart, useAppState } from '../lib/store';
import { reviewItem } from '../lib/srs';

export interface LessonResult {
  xp: number;
  correct: number;
  total: number;
  perfect: boolean;
  durationMs: number;
  outOfHearts: boolean;
}

interface Props {
  exercises: Exercise[];
  title: string;
  isPractice: boolean;
  onFinish: (r: LessonResult) => void;
  onQuit: () => void;
}

type Feedback = { kind: 'correct' | 'wrong'; correctAnswer?: string } | null;

export function LessonScreen({ exercises: initial, title, isPractice, onFinish, onQuit }: Props) {
  const app = useAppState();
  const startTime = useRef(Date.now());
  const [queue, setQueue] = useState<Exercise[]>(initial);
  const [idx, setIdx] = useState(0);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [ready, setReady] = useState(false);
  const totalRef = useRef({ answers: 0, correct: 0, firstTryTotal: initial.length, mistakes: 0 });
  const [combo, setCombo] = useState(0);

  // per-exercise answer state
  const [selected, setSelected] = useState<number | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [typed, setTyped] = useState('');

  const ex = queue[idx];
  const progress = idx / queue.length;
  const soundOn = app.settings.soundEnabled;

  const resetAnswerState = () => {
    setSelected(null);
    setChosen([]);
    setTyped('');
    setReady(false);
    setFeedback(null);
  };

  const finish = (outOfHearts: boolean) => {
    const t = totalRef.current;
    const perfect = t.mistakes === 0 && !outOfHearts;
    const base = isPractice ? 10 : 10;
    const xp = outOfHearts ? 0 : base + (perfect ? 5 : 0) + Math.min(5, Math.floor(t.correct / 5));
    if (!outOfHearts && soundOn) playComplete();
    onFinish({
      xp,
      correct: t.correct,
      total: t.answers,
      perfect,
      durationMs: Date.now() - startTime.current,
      outOfHearts,
    });
  };

  const advance = (wasCorrect: boolean, current: Exercise) => {
    if (!wasCorrect) {
      // re-queue missed exercise at the end (Duolingo-style)
      setQueue((q) => [...q, current]);
    }
    if (idx + 1 >= queue.length + (wasCorrect ? 0 : 1)) {
      finish(false);
      return;
    }
    setIdx((i) => i + 1);
    resetAnswerState();
  };

  const submit = () => {
    if (!ex || feedback) return;
    let correct = false;
    let correctAnswer = '';
    if (ex.type === 'choice-mn-en' || ex.type === 'choice-en-mn' || ex.type === 'listen-choice') {
      const c = ex as ChoiceExercise;
      correct = selected === c.correctIndex;
      correctAnswer = c.options[c.correctIndex];
    } else if (ex.type === 'bank-mn-en' || ex.type === 'bank-en-mn') {
      const b = ex as BankExercise;
      correct = checkBank(b, chosen);
      correctAnswer = b.answerTokens.join(' ');
    } else if (ex.type === 'type-mn-en') {
      const t = ex as TypeExercise;
      correct = checkType(t, typed);
      correctAnswer = t.display;
    }
    totalRef.current.answers += 1;
    if (correct) {
      totalRef.current.correct += 1;
      setCombo((c) => c + 1);
      if (soundOn) playCorrect();
    } else {
      totalRef.current.mistakes += 1;
      setCombo(0);
      if (soundOn) playWrong();
      loseHeart();
    }
    if (ex.itemKey.startsWith('w:') || ex.itemKey.startsWith('s:')) reviewItem(ex.itemKey, correct);
    setFeedback({ kind: correct ? 'correct' : 'wrong', correctAnswer });
    // speak the Mongolian on correct answers for reinforcement
    if (correct && 'speak' in ex && ex.speak && ex.type !== 'listen-choice') speak(ex.speak);

    if (!correct && getState().settings.heartsEnabled && getState().hearts <= 0) {
      setTimeout(() => finish(true), 1200);
    }
  };

  const continueNext = () => {
    if (!feedback || !ex) return;
    advance(feedback.kind === 'correct', ex);
  };

  const matchDone = () => {
    totalRef.current.answers += 1;
    totalRef.current.correct += 1;
    if (soundOn) playCorrect();
    if (idx + 1 >= queue.length) {
      finish(false);
    } else {
      setIdx((i) => i + 1);
      resetAnswerState();
    }
  };

  const matchMistake = () => {
    totalRef.current.mistakes += 1;
    if (soundOn) playWrong();
  };

  const hearts = useMemo(() => {
    if (!app.settings.heartsEnabled) return null;
    return (
      <span className="lesson-hearts">
        ❤️ <b>{app.hearts}</b>
      </span>
    );
  }, [app.hearts, app.settings.heartsEnabled]);

  if (!ex) return null;

  return (
    <div className="lesson">
      <div className="lesson-top">
        <button className="quit-btn" onClick={onQuit} aria-label="Quit lesson">
          ✕
        </button>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${Math.max(3, progress * 100)}%` }} />
        </div>
        {hearts}
      </div>
      <div className="lesson-title-row">
        <span className="lesson-name">{title}</span>
        {combo >= 3 && <span className="combo">🔥 {combo} in a row</span>}
      </div>

      <div className="lesson-body">
        {(ex.type === 'choice-mn-en' || ex.type === 'choice-en-mn' || ex.type === 'listen-choice') && (
          <ChoiceEx ex={ex as ChoiceExercise} showRo={app.settings.showRomanization} locked={!!feedback} onAnswerChange={setReady} selected={selected} setSelected={setSelected} />
        )}
        {(ex.type === 'bank-mn-en' || ex.type === 'bank-en-mn') && (
          <BankEx ex={ex as BankExercise} showRo={app.settings.showRomanization} locked={!!feedback} onAnswerChange={setReady} chosen={chosen} setChosen={setChosen} />
        )}
        {ex.type === 'type-mn-en' && (
          <TypeEx ex={ex as TypeExercise} showRo={app.settings.showRomanization} locked={!!feedback} onAnswerChange={setReady} text={typed} setText={setTyped} />
        )}
        {ex.type === 'match' && <MatchEx ex={ex as MatchExercise} onComplete={matchDone} onMistake={matchMistake} />}
      </div>

      {ex.type !== 'match' && (
        <div className={`lesson-footer ${feedback ? (feedback.kind === 'correct' ? 'fb-correct' : 'fb-wrong') : ''}`}>
          {feedback ? (
            <div className="feedback">
              <div className="feedback-text">
                {feedback.kind === 'correct' ? (
                  <>
                    <span className="fb-icon">✓</span>
                    <div>
                      <b>{['Nice!', 'Excellent!', 'Correct!', 'Сайн байна!'][Math.floor(Math.random() * 4)]}</b>
                      {(ex.type === 'bank-mn-en' || ex.type === 'bank-en-mn') && <div className="fb-answer">{bankAnswerText(ex as BankExercise, chosen)}</div>}
                    </div>
                  </>
                ) : (
                  <>
                    <span className="fb-icon">✗</span>
                    <div>
                      <b>Correct answer:</b>
                      <div className="fb-answer">{feedback.correctAnswer}</div>
                    </div>
                  </>
                )}
              </div>
              <button className={`btn-big ${feedback.kind === 'correct' ? 'btn-green' : 'btn-red'}`} onClick={continueNext}>
                CONTINUE
              </button>
            </div>
          ) : (
            <button className="btn-big btn-green" disabled={!ready} onClick={submit}>
              CHECK
            </button>
          )}
        </div>
      )}
    </div>
  );
}
