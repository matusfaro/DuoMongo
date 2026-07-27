import { useEffect, useState } from 'react';
import type { Exercise, Skill } from './types';
import { CROWN_LEVELS, LESSONS_PER_LEVEL } from './data/course';
import { advanceSkill, getSkillProgress, getState, recordSession, refreshHearts, todayKey, useAppState } from './lib/store';
import { generateLesson, generatePractice } from './lib/exgen';
import { dueItems, weakestItems } from './lib/srs';
import { checkAchievements, type AchievementDef } from './lib/achievements';
import { ensureNotificationPermission, scheduleDailyReminder } from './lib/notifications';
import { LessonScreen, type LessonResult } from './screens/LessonScreen';
import { PathScreen } from './screens/PathScreen';
import { PracticeScreen } from './screens/PracticeScreen';
import { StatsScreen } from './screens/StatsScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { StoriesScreen } from './screens/StoriesScreen';
import { DictionaryScreen } from './screens/DictionaryScreen';

type Tab = 'learn' | 'practice' | 'dict' | 'stats' | 'profile';

interface ActiveLesson {
  exercises: Exercise[];
  title: string;
  isPractice: boolean;
  skillId?: string;
}

interface ResultView {
  result: LessonResult;
  newAchievements: AchievementDef[];
}

export default function App() {
  const app = useAppState();
  const [tab, setTab] = useState<Tab>('learn');
  const [storiesOpen, setStoriesOpen] = useState(false);
  const [lesson, setLesson] = useState<ActiveLesson | null>(null);
  const [resultView, setResultView] = useState<ResultView | null>(null);
  const [noHearts, setNoHearts] = useState(false);

  useEffect(() => {
    refreshHearts();
    const iv = setInterval(refreshHearts, 60_000);
    // (re)schedule reminders on launch
    if (getState().settings.reminderEnabled) {
      void ensureNotificationPermission().then((ok) => {
        if (ok) void scheduleDailyReminder(getState().settings.reminderTime, getState().streak);
      });
    }
    return () => clearInterval(iv);
  }, []);

  const startLesson = (skill: Skill) => {
    refreshHearts();
    const st = getState();
    if (st.settings.heartsEnabled && st.hearts <= 0) {
      setNoHearts(true);
      return;
    }
    const prog = getSkillProgress(st, skill.id);
    const mastered = prog.crowns >= CROWN_LEVELS;
    const exercises = mastered
      ? generateLesson(st, skill.id, CROWN_LEVELS - 1, Math.floor(Math.random() * 10))
      : generateLesson(st, skill.id, prog.crowns, prog.lessonsDone);
    setLesson({ exercises, title: skill.title, isPractice: mastered, skillId: mastered ? undefined : skill.id });
  };

  const startPractice = () => {
    refreshHearts();
    const st = getState();
    if (st.settings.heartsEnabled && st.hearts <= 0) {
      setNoHearts(true);
      return;
    }
    let keys = dueItems(st, 12);
    if (keys.length < 6) keys = [...new Set([...keys, ...weakestItems(st, 12)])].slice(0, 12);
    const exercises = generatePractice(keys);
    if (exercises.length === 0) return;
    setLesson({ exercises, title: 'Practice', isPractice: true });
  };

  const finishLesson = (r: LessonResult) => {
    const l = lesson;
    setLesson(null);
    if (!l) return;
    if (r.outOfHearts) {
      setNoHearts(true);
      return;
    }
    recordSession(r.xp, {
      perfect: r.perfect,
      isPractice: l.isPractice,
      answers: r.total,
      correct: r.correct,
      durationMs: r.durationMs,
    });
    if (l.skillId) advanceSkill(l.skillId, LESSONS_PER_LEVEL, CROWN_LEVELS);
    const newAchievements = checkAchievements(getState());
    // refresh streak-danger notification with the new streak
    if (getState().settings.reminderEnabled) {
      void scheduleDailyReminder(getState().settings.reminderTime, getState().streak);
    }
    setResultView({ result: r, newAchievements });
  };

  const todayXp = app.xpByDay[todayKey()] ?? 0;
  const goalMet = todayXp >= app.settings.dailyGoal;

  if (lesson) {
    return (
      <LessonScreen
        exercises={lesson.exercises}
        title={lesson.title}
        isPractice={lesson.isPractice}
        onFinish={finishLesson}
        onQuit={() => setLesson(null)}
      />
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="topbar-flag">🇲🇳</span>
        <span className={`topbar-stat ${app.streak > 0 && app.lastActiveDay === todayKey() ? 'lit' : ''}`} title="Streak">
          🔥 {app.streak}
        </span>
        <span className="topbar-stat" title="Gems">
          💎 {app.gems}
        </span>
        {app.settings.heartsEnabled && (
          <span className="topbar-stat" title="Hearts">
            ❤️ {app.hearts}
          </span>
        )}
        <span className={`topbar-goal ${goalMet ? 'met' : ''}`} title="Daily goal">
          ⚡ {todayXp}/{app.settings.dailyGoal}
        </span>
      </header>

      <main className="content">
        {tab === 'learn' &&
          (storiesOpen ? (
            <StoriesScreen onBack={() => setStoriesOpen(false)} />
          ) : (
            <PathScreen onStartLesson={startLesson} onOpenStories={() => setStoriesOpen(true)} />
          ))}
        {tab === 'practice' && <PracticeScreen onStartPractice={startPractice} />}
        {tab === 'dict' && <DictionaryScreen />}
        {tab === 'stats' && <StatsScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </main>

      <nav className="bottom-nav">
        {(
          [
            ['learn', '🏠', 'Learn'],
            ['practice', '🧠', 'Practice'],
            ['dict', '📖', 'Words'],
            ['stats', '📊', 'Stats'],
            ['profile', '👤', 'Profile'],
          ] as [Tab, string, string][]
        ).map(([t, icon, label]) => (
          <button key={t} className={`nav-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            <span className="nav-icon">{icon}</span>
            <span className="nav-label">{label}</span>
          </button>
        ))}
      </nav>

      {resultView && (
        <div className="modal-backdrop">
          <div className="modal result-modal">
            <div className="result-emoji">{resultView.result.perfect ? '🏆' : '🎉'}</div>
            <h3>{resultView.result.perfect ? 'Perfect lesson!' : 'Lesson complete!'}</h3>
            <div className="result-stats">
              <div className="result-stat xp">
                <b>+{resultView.result.xp}</b>
                <span>XP</span>
              </div>
              <div className="result-stat acc">
                <b>{resultView.result.total > 0 ? Math.round((100 * resultView.result.correct) / resultView.result.total) : 0}%</b>
                <span>accuracy</span>
              </div>
              <div className="result-stat time">
                <b>{Math.max(1, Math.round(resultView.result.durationMs / 60000))}m</b>
                <span>time</span>
              </div>
            </div>
            {goalMet && <div className="result-goal">⚡ Daily goal reached!</div>}
            {resultView.newAchievements.map((a) => (
              <div key={a.id} className="result-achievement">
                {a.icon} Achievement unlocked: <b>{a.title}</b> (+20 💎)
              </div>
            ))}
            <button className="btn-big btn-green" onClick={() => setResultView(null)}>
              CONTINUE
            </button>
          </div>
        </div>
      )}

      {noHearts && (
        <div className="modal-backdrop" onClick={() => setNoHearts(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">💔</div>
            <h3>You're out of hearts!</h3>
            <p className="modal-sub">
              Hearts refill over time (1 every 30 min), or refill instantly in the shop. You can also turn hearts off in
              settings.
            </p>
            <button className="btn-big btn-green" onClick={() => setNoHearts(false)}>
              GOT IT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
