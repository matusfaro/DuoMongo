# DuoMongo 🇲🇳

A Duolingo-style app for learning **Mongolian** (Cyrillic script) as an English
speaker. Fully offline, single-user — all data stays on the device. Built with
React + Vite + Capacitor, runs in any browser for development and as a native
Android app.

## Features

- **Course**: 19 skills across 4 sections (Basics, Greetings, Family, Numbers,
  Food, Colors, Animals, Questions, Verbs, Time, Places, Adjectives,
  Pronouns & Cases, Weather, Body, Clothes, Past/Future tense, Travel Phrases)
  with ~195 vocabulary items, ~130 sentences, romanization, and grammar tips
  per skill.
- **Exercise types**: multiple choice (both directions), word-bank sentence
  translation (both directions), matching pairs, typed translation, and
  listening comprehension.
- **Crown levels**: each skill has 5 levels × 3 lessons; higher levels serve
  harder exercise types. All skills are open from the start.
- **Spaced repetition**: every word/sentence is tracked with an SM-2-style
  scheduler; the Practice tab reviews due or weakest items.
- **Gamification**: XP with a configurable daily goal, streak with streak
  freezes, gems, hearts (optional), combo bonuses, 16 achievements.
- **Stats**: weekly XP chart, 12-week activity heatmap, accuracy, time spent,
  words learned, best streak.
- **Audio**: bundled real-Mongolian clips (mn-MN neural voice) for every
  word and sentence, generated at build time; fully offline at runtime.
- **Reminders**: daily lesson notification at a configurable time plus an
  evening streak-saver nudge (Capacitor local notifications).

## Development

```sh
npm install
npm run dev        # test in a browser
npm run build      # type-check + production bundle in dist/
```

## Android

```sh
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Note: `android/gradle.properties` pins `org.gradle.java.home` to a local
OpenJDK 21 (AGP's jlink transform fails on GraalVM/newer JDKs) — adjust the
path for your machine.

All progress is stored in `localStorage` under `duomongo-state-v1`; the
"Danger zone" in the Profile tab resets it.
