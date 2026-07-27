import { useEffect, useMemo, useRef, useState } from 'react';
import type { BankExercise, ChoiceExercise, Exercise, MatchExercise, ShadowExercise, TypeExercise } from '../types';
import { BankEx, bankAnswerText, checkBank, ChoiceEx, checkType, MatchEx, ShadowEx, TypeEx } from '../components/exercises';
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

  // Hear the Mongolian right away — except where it would reveal the answer
  // (cloze speaks the full sentence, en→mn asks you to produce the Mongolian).
  useEffect(() => {
    if (!ex) return;
    const autoSpeakTypes = new Set(['choice-mn-en', 'listen-choice', 'minpair', 'reply', 'picture', 'bank-mn-en', 'bank-listen-mn', 'type-mn-en', 'speak-shadow']);
    if (autoSpeakTypes.has(ex.type) && 'speak' in ex && ex.speak) speak(ex.speak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, queue]);

  const advTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (advTimer.current) {
      clearTimeout(advTimer.current);
      advTimer.current = null;
    }
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

  const isChoiceType = (t: string) =>
    t === 'choice-mn-en' || t === 'choice-en-mn' || t === 'listen-choice' || t === 'cloze' || t === 'reply' || t === 'minpair' || t === 'picture';
  const isBankType = (t: string) => t === 'bank-mn-en' || t === 'bank-en-mn' || t === 'bank-listen-mn';

  const submit = (choiceIndex?: number) => {
    if (!ex || feedback) return;
    let correct = false;
    let correctAnswer = '';
    if (isChoiceType(ex.type)) {
      const c = ex as ChoiceExercise;
      const picked = choiceIndex ?? selected;
      correct = picked === c.correctIndex;
      correctAnswer = c.options[c.correctIndex];
    } else if (isBankType(ex.type)) {
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

    if (correct) {
      // auto-advance quickly — no CONTINUE tap needed when right
      advTimer.current = setTimeout(() => advance(true, ex), 400);
    } else if (getState().settings.heartsEnabled && getState().hearts <= 0) {
      setTimeout(() => finish(true), 1200);
    }
  };

  const continueNext = () => {
    if (!feedback || !ex) return;
    advance(feedback.kind === 'correct', ex);
  };

  // self-graded shadowing: honesty-based, never costs a heart
  const gradeShadow = (good: boolean) => {
    if (!ex) return;
    totalRef.current.answers += 1;
    if (good) {
      totalRef.current.correct += 1;
      if (soundOn) playCorrect();
    } else {
      if (soundOn) playWrong();
    }
    if (ex.itemKey.startsWith('s:')) reviewItem(ex.itemKey, good);
    advance(good, ex);
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
        {isChoiceType(ex.type) && (
          <ChoiceEx
            ex={ex as ChoiceExercise}
            showRo={app.settings.showRomanization}
            locked={!!feedback}
            selected={selected}
            onPick={(i) => {
              setSelected(i);
              submit(i); // one tap: picking an option checks it immediately
            }}
          />
        )}
        {isBankType(ex.type) && (
          <BankEx ex={ex as BankExercise} showRo={app.settings.showRomanization} locked={!!feedback} onAnswerChange={setReady} chosen={chosen} setChosen={setChosen} />
        )}
        {ex.type === 'type-mn-en' && (
          <TypeEx ex={ex as TypeExercise} showRo={app.settings.showRomanization} locked={!!feedback} onAnswerChange={setReady} text={typed} setText={setTyped} onEnter={() => submit()} />
        )}
        {ex.type === 'match' && <MatchEx ex={ex as MatchExercise} onComplete={matchDone} onMistake={matchMistake} />}
        {ex.type === 'speak-shadow' && <ShadowEx ex={ex as ShadowExercise} showRo={app.settings.showRomanization} onGrade={gradeShadow} />}
      </div>

      {ex.type !== 'match' && ex.type !== 'speak-shadow' && (
        <div
          className={`lesson-footer ${feedback ? (feedback.kind === 'correct' ? 'fb-correct' : 'fb-wrong') : ''}`}
          onClick={feedback?.kind === 'correct' ? continueNext : undefined}
        >
          {feedback ? (
            <div className="feedback">
              <div className="feedback-text">
                {feedback.kind === 'correct' ? (
                  <>
                    <span className="fb-icon">✓</span>
                    <div>
                      <b>{['Nice!', 'Excellent!', 'Correct!', 'Сайн байна!'][Math.floor(Math.random() * 4)]}</b>
                      {isBankType(ex.type) && <div className="fb-answer">{bankAnswerText(ex as BankExercise, chosen)}</div>}
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
              {feedback.kind === 'wrong' && (
                <button className="btn-big btn-red" onClick={continueNext}>
                  CONTINUE
                </button>
              )}
            </div>
          ) : isChoiceType(ex.type) ? (
            <div className="tap-hint">Tap an answer</div>
          ) : (
            <button className="btn-big btn-green" disabled={!ready} onClick={() => submit()}>
              CHECK
            </button>
          )}
        </div>
      )}
    </div>
  );
}
