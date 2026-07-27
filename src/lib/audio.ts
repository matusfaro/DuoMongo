// Text-to-speech for Mongolian, plus UI sound effects.
// Native platforms use the OS speech engine (Android WebView has no Web Speech
// API); browsers use speechSynthesis. Both prefer a Mongolian voice and fall
// back to Russian, which shares Cyrillic phonetics.

import { Capacitor } from '@capacitor/core';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

const isNative = Capacitor.isNativePlatform();

let nativeLang: string | null = null;

async function pickNativeLang(): Promise<string> {
  if (nativeLang) return nativeLang;
  try {
    const { languages } = await TextToSpeech.getSupportedLanguages();
    const lower = languages.map((l) => l.toLowerCase());
    if (lower.some((l) => l.startsWith('mn'))) nativeLang = languages[lower.findIndex((l) => l.startsWith('mn'))];
    else if (lower.some((l) => l.startsWith('ru'))) nativeLang = languages[lower.findIndex((l) => l.startsWith('ru'))];
    else nativeLang = 'ru-RU';
  } catch {
    nativeLang = 'ru-RU';
  }
  return nativeLang;
}

let mnVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

function findVoice() {
  if (typeof speechSynthesis === 'undefined') return;
  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) return;
  voicesLoaded = true;
  mnVoice =
    voices.find((v) => v.lang.toLowerCase().startsWith('mn')) ??
    voices.find((v) => v.name.toLowerCase().includes('mongol')) ??
    null;
}

if (typeof speechSynthesis !== 'undefined') {
  findVoice();
  speechSynthesis.onvoiceschanged = findVoice;
}

export function hasMongolianVoice(): boolean {
  if (!voicesLoaded) findVoice();
  return mnVoice !== null;
}

/** Speak Mongolian text. Falls back to a Russian voice (shared Cyrillic phonetics) if no mn voice. */
export function speak(text: string) {
  if (isNative) {
    void (async () => {
      try {
        const lang = await pickNativeLang();
        await TextToSpeech.stop().catch(() => {});
        await TextToSpeech.speak({ text, lang, rate: 0.85, pitch: 1.0, volume: 1.0 });
      } catch {
        // no speech engine available; stay silent
      }
    })();
    return;
  }
  if (typeof speechSynthesis === 'undefined') return;
  if (!voicesLoaded) findVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  if (mnVoice) {
    u.voice = mnVoice;
    u.lang = mnVoice.lang;
  } else {
    const ru = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith('ru'));
    if (ru) {
      u.voice = ru;
      u.lang = ru.lang;
    } else {
      u.lang = 'mn-MN';
    }
  }
  u.rate = 0.85;
  speechSynthesis.speak(u);
}

// ---- simple synth sound effects ----

let ctx: AudioContext | null = null;

function audioCtx(): AudioContext | null {
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, startAt: number, dur: number, type: OscillatorType = 'sine', gain = 0.15) {
  const ac = audioCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, ac.currentTime + startAt);
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + startAt + dur);
  osc.connect(g).connect(ac.destination);
  osc.start(ac.currentTime + startAt);
  osc.stop(ac.currentTime + startAt + dur);
}

export function playCorrect() {
  tone(660, 0, 0.12, 'sine', 0.12);
  tone(880, 0.1, 0.2, 'sine', 0.12);
}

export function playWrong() {
  tone(220, 0, 0.25, 'square', 0.06);
  tone(180, 0.15, 0.3, 'square', 0.06);
}

export function playComplete() {
  tone(523, 0, 0.15, 'sine', 0.12);
  tone(659, 0.12, 0.15, 'sine', 0.12);
  tone(784, 0.24, 0.15, 'sine', 0.12);
  tone(1047, 0.36, 0.35, 'sine', 0.14);
}
