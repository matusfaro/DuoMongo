import { useEffect, useMemo, useRef, useState } from 'react';
import type { BankExercise, ChoiceExercise, MatchExercise, ShadowExercise, TypeExercise } from '../types';
import { speak } from '../lib/audio';
import { normalizeAnswer } from '../lib/exgen';

export interface ExerciseProps<T> {
  ex: T;
  showRo: boolean;
  locked: boolean; // answer submitted, freeze input
  onAnswerChange: (ready: boolean) => void;
}

// ---- Choice (multiple choice, incl. listening) ----

const CHOICE_TITLES: Record<string, string> = {
  'choice-mn-en': 'What does this mean?',
  'choice-en-mn': 'Select the Mongolian word',
  'listen-choice': 'What do you hear?',
  cloze: 'Fill in the blank',
  reply: 'Pick the best reply',
  minpair: 'Which word do you hear?',
  picture: 'Select the matching picture',
};

export function ChoiceEx({ ex, showRo, locked, selected, onPick }: { ex: ChoiceExercise; showRo: boolean; locked: boolean; selected: number | null; onPick: (i: number) => void }) {
  const audioOnly = ex.type === 'listen-choice' || ex.type === 'minpair';
  return (
    <div className="ex">
      <h2 className="ex-title">{CHOICE_TITLES[ex.type]}</h2>
      {audioOnly ? (
        <button className="listen-big" onClick={() => ex.speak && speak(ex.speak)} aria-label="Play audio">
          🔊
        </button>
      ) : (
        <div className="prompt-row">
          {ex.speak && ex.type !== 'cloze' && (
            <button className="speaker" onClick={() => speak(ex.speak!)} aria-label="Play audio">
              🔊
            </button>
          )}
          <div>
            <div className="prompt-main">{ex.prompt}</div>
            {showRo && ex.promptRo && <div className="prompt-ro">{ex.promptRo}</div>}
            {ex.sub && <div className="prompt-sub">{ex.sub}</div>}
          </div>
        </div>
      )}
      <div className={ex.bigOptions ? 'options options-grid' : 'options'}>
        {ex.options.map((opt, i) => (
          <button
            key={i}
            className={`option ${ex.bigOptions ? 'option-big' : ''} ${selected === i ? 'selected' : ''}`}
            disabled={locked}
            onClick={() => onPick(i)}
          >
            {!ex.bigOptions && <span className="option-num">{i + 1}</span>} {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---- Shadowing (record & compare) ----

export function ShadowEx({ ex, showRo, onGrade }: { ex: ShadowExercise; showRo: boolean; onGrade: (good: boolean) => void }) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'review' | 'nomic'>('idle');
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const urlRef = useRef<string | null>(null);
  const playerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(
    () => () => {
      recRef.current?.stream.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = URL.createObjectURL(blob);
        setPhase('review');
      };
      recRef.current = rec;
      rec.start();
      setPhase('recording');
    } catch {
      setPhase('nomic');
    }
  };

  const stopRecording = () => recRef.current?.stop();

  const playMine = () => {
    if (!urlRef.current) return;
    playerRef.current?.pause();
    playerRef.current = new Audio(urlRef.current);
    void playerRef.current.play();
  };

  return (
    <div className="ex">
      <h2 className="ex-title">Say it out loud</h2>
      <div className="prompt-row">
        <button className="speaker" onClick={() => speak(ex.speak)} aria-label="Play audio">
          🔊
        </button>
        <div>
          <div className="prompt-main">{ex.prompt}</div>
          {showRo && ex.promptRo && <div className="prompt-ro">{ex.promptRo}</div>}
          {ex.sub && <div className="prompt-sub">{ex.sub}</div>}
        </div>
      </div>

      {phase === 'nomic' ? (
        <div className="shadow-box">
          <p className="shadow-hint">Microphone unavailable. Say it out loud anyway, then continue.</p>
          <button className="btn-big btn-green" onClick={() => onGrade(true)}>
            CONTINUE
          </button>
        </div>
      ) : (
        <div className="shadow-box">
          {phase === 'idle' && (
            <>
              <p className="shadow-hint">Listen, then record yourself saying it.</p>
              <button className="record-btn" onClick={() => void startRecording()}>
                🎙️ RECORD
              </button>
            </>
          )}
          {phase === 'recording' && (
            <>
              <p className="shadow-hint recording-dot">● Recording…</p>
              <button className="record-btn recording" onClick={stopRecording}>
                ⏹ STOP
              </button>
            </>
          )}
          {phase === 'review' && (
            <>
              <div className="shadow-compare">
                <button className="btn-small" onClick={() => speak(ex.speak)}>
                  🔊 NATIVE
                </button>
                <button className="btn-small" onClick={playMine}>
                  ▶️ ME
                </button>
                <button className="btn-small" onClick={() => void startRecording()}>
                  🎙️ REDO
                </button>
              </div>
              <p className="shadow-hint">How close were you?</p>
              <div className="shadow-grade">
                <button className="btn-big btn-red" onClick={() => onGrade(false)}>
                  TRY AGAIN LATER
                </button>
                <button className="btn-big btn-green" onClick={() => onGrade(true)}>
                  SOUNDED GOOD
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Word bank ----

export function BankEx({ ex, showRo, locked, onAnswerChange, chosen, setChosen }: ExerciseProps<BankExercise> & { chosen: number[]; setChosen: (c: number[]) => void }) {
  const isDictation = ex.type === 'bank-listen-mn';
  return (
    <div className="ex">
      <h2 className="ex-title">{isDictation ? 'Type what you hear' : 'Translate this sentence'}</h2>
      {isDictation ? (
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

export function TypeEx({ ex, showRo, locked, onAnswerChange, text, setText, onEnter }: ExerciseProps<TypeExercise> & { text: string; setText: (t: string) => void; onEnter: () => void }) {
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
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (text.trim().length > 0) onEnter();
          }
        }}
      />
    </div>
  );
}

export function checkType(ex: TypeExercise, text: string): boolean {
  return ex.acceptedAnswers.includes(normalizeAnswer(text));
}
