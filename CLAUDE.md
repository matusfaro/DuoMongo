# DuoMongo

Duolingo-style app for learning Mongolian (Cyrillic) as an English speaker.
Fully offline, single-user, no backend — all data lives on the device. React 19
+ Vite + TypeScript + Capacitor; runs in the browser for development and as a
native Android app.

# Git (CRITICAL)

ALWAYS commit and push after completing a change — do not wait to be asked.
Verify first (`npm run build` + `npm run lint`), then commit and push.

# Android Deploy (CRITICAL)

After committing a change, ALWAYS build the updated APK and push it to the
connected Android device:

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

If no device is connected (`adb devices` empty), say so instead of failing
silently. The device may appear twice over wireless debugging (duplicate
`_adb-tls-connect` entries) — if `adb install` fails with "more than one
device/emulator", pick one entry with `adb -s <serial> install ...`.

# User Data Compatibility (CRITICAL)

We MUST retain existing deployed device progress (e.g. the user's Android
device). Any change to persisted state — the `AppState` shape, the
`duomongo-state-v1` localStorage key, progress/SRS data formats — must be
either:

- **Backwards compatible** with data already stored on deployed devices, or
- **Auto-upgradable** via a migration that runs on load and preserves all
  existing progress.

Never rename/remove stored fields, change the storage key, or alter
serialization without a migration path. `load()` in `src/lib/store.ts`
shallow-merges saved state over `defaultState()` — new top-level fields with
defaults are safe; anything else needs explicit migration. Losing user
progress is unacceptable.

## Commands

```sh
npm run dev        # dev server in browser
npm run build      # tsc -b type-check + production bundle to dist/
npm run lint       # oxlint
```

Android (requires a build first):

```sh
npm run build && npx cap sync android
cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

`android/gradle.properties` pins `org.gradle.java.home` to a local OpenJDK 21
(AGP's jlink transform fails on GraalVM/newer JDKs) — machine-specific path.

There are no automated tests; verify changes with `npm run build` (type-check)
and `npm run lint`.

## Architecture

- `src/App.tsx` — root component, tab navigation between screens.
- `src/screens/` — one component per tab/screen: `PathScreen` (skill tree),
  `LessonScreen` (runs a lesson session), `PracticeScreen` (SRS review),
  `StoriesScreen`, `DictionaryScreen`, `StatsScreen`, `ProfileScreen`.
- `src/components/exercises.tsx` — all 12 exercise-type components.
- `src/lib/store.ts` — the single global store: `AppState` persisted to
  localStorage under `duomongo-state-v1`, exposed via `useSyncExternalStore`.
- `src/lib/srs.ts` — SM-2-style spaced-repetition scheduler; every vocab word
  and sentence has an SRS entry. Skill rings on the path show `skillStrength`
  (combined item strength), while crowns track lessons completed.
  There is deliberately no hearts/lives mechanic — do not add one.
- `src/lib/exgen.ts` — generates the exercise sequence for a lesson from
  course data (exercise types vary by crown level).
- `src/lib/achievements.ts`, `src/lib/notifications.ts`, `src/lib/audio.ts` —
  achievements, daily/streak-saver local notifications, audio playback.
- `src/data/course.ts` (+ `course1/2/3.ts`) — the course content: 25 skills ×
  5 crown levels × 3 lessons, vocab/sentences/replies with romanization.
  `src/data/stories.ts`, `src/data/minpairs.ts` — stories and minimal pairs.
- `src/types.ts` — shared types, including the persisted `AppState`.

## Audio pipeline (CRITICAL — exact voice and build order)

Every Mongolian text has a pre-generated mp3 bundled in `public/audio/`,
keyed by md5-hash filenames, mapped by `src/data/audio-manifest.json`, read by
`src/lib/audio.ts`. All clips are **edge-tts, voice `mn-MN-YesuiNeural`,
rate `-10%`** — never use any other voice/rate, or new clips won't match the
rest of the course.

After adding or editing ANY Mongolian text (course, stories, replies), run
from the repo root:

```sh
npx tsx scripts/dump-texts.mts                            # refresh scripts/texts.json
uvx --from edge-tts --with edge-tts python scripts/gen-audio.py  # gen missing clips + rebuild manifest
npm run build                                             # MUST come after the two steps above
npx cap sync android && cd android && ./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

**Order matters**: `npm run build` bundles the manifest into the JS and copies
`public/audio/` into `dist/`. If you build before regenerating audio (or forget
to rebuild after), the APK ships a stale manifest and any missing text silently
falls back to device TTS — which reads Mongolian Cyrillic with a **Russian**
voice and sounds ridiculous. This happened once; don't repeat it. Sanity check
before syncing: `ls public/audio | wc -l` must equal `ls dist/audio | wc -l`.
