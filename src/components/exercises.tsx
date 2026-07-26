import { useEffect, useMemo, useState } from 'react';
import type { BankExercise, ChoiceExercise, MatchExercise, TypeExercise } from '../types';
import { speak } from '../lib/audio';
import { normalizeAnswer } from '../lib/exgen';

export interface ExerciseProps<T> {
  ex: T;
  showRo: boolean;
  locked: boolean; // answer submitted, freeze input
  onAnswerChange: (ready: boolean) => void;
}

// ---- Choice (multiple choice, incl. listening) ----

export function ChoiceEx({ ex, showRo, locked, onAnswerChange, selected, setSelected }: ExerciseProps<ChoiceExercise> & { selected: number | null; setSelected: (i: number) => void }) {
  const isListen = ex.type === 'listen-choice';
  useEffect(() => {
    if (isListen && ex.speak) speak(ex.speak);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ex]);
  return (
    <div className="ex">
      <h2 className="ex-title">
        {ex.type === 'choice-mn-en' && 'What does this mean?'}
        {ex.type === 'choice-en-mn' && 'Select the Mongolian word'}
        {isListen && 'What do you hear?'}
      </h2>
      {isListen ? (
        <button className="listen-big" onClick={() => ex.speak && speak(ex.speak)} aria-label="Play audio">
          🔊
        </button>
      ) : (
        <div className="prompt-row">
          {ex.speak && (
            <button className="speaker" onClick={() => speak(ex.speak!)} aria-label="Play audio">
              🔊
            </button>
          )}
          <div>
            <div className="prompt-main">{ex.prompt}</div>
            {showRo && ex.promptRo && <div className="prompt-ro">{ex.promptRo}</div>}
          </div>
        </div>
      )}
      <div className="options">
        {ex.options.map((opt, i) => (
          <button
            key={i}
            className={`option ${selected === i ? 'selected' : ''}`}
            disabled={locked}
            onClick={() => {
              setSelected(i);
              onAnswerChange(true);
            }}
          >
            <span className="option-num">{i + 1}</span> {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Word bank ----

export function BankEx({ ex, showRo, locked, onAnswerChange, chosen, setChosen }: ExerciseProps<BankExercise> & { chosen: number[]; setChosen: (c: number[]) => void }) {
  return (
    <div className="ex">
      <h2 className="ex-title">Translate this sentence</h2>
      <div className="prompt-row">
        {ex.speak && (
          <button className="speaker" onClick={() => speak(ex.speak!)} aria-label="Play audio">
            🔊
          </button>
        )}
        <div>
          <div className="prompt-main">{ex.prompt}</div>
          {showRo && ex.promptRo && <div className="prompt-ro">{ex.promptRo}</div>}
        </div>
      </div>
      <div className="bank-answer">
        {chosen.length === 0 && <span className="bank-placeholder">Tap the words below</span>}
        {chosen.map((tokenIdx, pos) => (
          <button
            key={pos}
            className="token chosen"
            disabled={locked}
            onClick={() => {
              const next = chosen.filter((_, p) => p !== pos);
              setChosen(next);
              onAnswerChange(next.length > 0);
            }}
          >
            {ex.bankTokens[tokenIdx]}
          </button>
        ))}
      </div>
      <div className="bank-pool">
        {ex.bankTokens.map((tok, i) => {
          const used = chosen.includes(i);
          return (
            <button
              key={i}
              className={`token ${used ? 'used' : ''}`}
              disabled={locked || used}
              onClick={() => {
                const next = [...chosen, i];
                setChosen(next);
                onAnswerChange(true);
              }}
            >
              {tok}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function bankAnswerText(ex: BankExercise, chosen: number[]): string {
  return chosen.map((i) => ex.bankTokens[i]).join(' ');
}

export function checkBank(ex: BankExercise, chosen: number[]): boolean {
  return ex.acceptedAnswers.includes(normalizeAnswer(bankAnswerText(ex, chosen)));
}

// ---- Matching pairs ----

export function MatchEx({ ex, onComplete, onMistake }: { ex: MatchExercise; onComplete: () => void; onMistake: () => void }) {
  const left = useMemo(() => ex.pairs.map((p, i) => ({ text: p.left, i })).sort(() => Math.random() - 0.5), [ex]);
  const right = useMemo(() => ex.pairs.map((p, i) => ({ text: p.right, i })).sort(() => Math.random() - 0.5), [ex]);
  const [selLeft, setSelLeft] = useState<number | null>(null);
  const [selRight, setSelRight] = useState<number | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [shake, setShake] = useState<string | null>(null);

  useEffect(() => {
    if (selLeft !== null && selRight !== null) {
      if (selLeft === selRight) {
        const next = new Set(done);
        next.add(selLeft);
        setDone(next);
        setSelLeft(null);
        setSelRight(null);
        if (next.size === ex.pairs.length) setTimeout(onComplete, 350);
      } else {
        setShake(`${selLeft}-${selRight}`);
        onMistake();
        setTimeout(() => {
          setShake(null);
          setSelLeft(null);
          setSelRight(null);
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selLeft, selRight]);

  return (
    <div className="ex">
      <h2 className="ex-title">Tap the matching pairs</h2>
      <div className="match-grid">
        <div className="match-col">
          {left.map(({ text, i }) => (
            <button
              key={i}
              className={`match-btn ${done.has(i) ? 'done' : ''} ${selLeft === i ? 'selected' : ''} ${shake?.startsWith(`${i}-`) ? 'shake' : ''}`}
              disabled={done.has(i)}
              onClick={() => {
                speak(text);
                setSelLeft(i);
              }}
            >
              {text}
            </button>
          ))}
        </div>
        <div className="match-col">
          {right.map(({ text, i }) => (
            <button
              key={i}
              className={`match-btn ${done.has(i) ? 'done' : ''} ${selRight === i ? 'selected' : ''} ${shake?.endsWith(`-${i}`) ? 'shake' : ''}`}
              disabled={done.has(i)}
              onClick={() => setSelRight(i)}
            >
              {text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---- Type answer ----

export function TypeEx({ ex, showRo, locked, onAnswerChange, text, setText }: ExerciseProps<TypeExercise> & { text: string; setText: (t: string) => void }) {
  return (
    <div className="ex">
      <h2 className="ex-title">Type the English translation</h2>
      <div className="prompt-row">
        {ex.speak && (
          <button className="speaker" onClick={() => speak(ex.speak!)} aria-label="Play audio">
            🔊
          </button>
        )}
        <div>
          <div className="prompt-main">{ex.prompt}</div>
          {showRo && ex.promptRo && <div className="prompt-ro">{ex.promptRo}</div>}
        </div>
      </div>
      <textarea
        className="type-input"
        value={text}
        disabled={locked}
        placeholder="Type in English"
        autoCapitalize="off"
        autoCorrect="off"
        onChange={(e) => {
          setText(e.target.value);
          onAnswerChange(e.target.value.trim().length > 0);
        }}
      />
    </div>
  );
}

export function checkType(ex: TypeExercise, text: string): boolean {
  return ex.acceptedAnswers.includes(normalizeAnswer(text));
}
