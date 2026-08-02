import { useEffect, useRef, useState } from 'react';
import { buyStreakFreeze, resetAllProgress, setState, todayKey, useAppState } from '../lib/store';
import { cancelReminders, ensureNotificationPermission, scheduleDailyReminder } from '../lib/notifications';
import { MIN_REVIEWS_TO_OPTIMIZE } from '../lib/optimizer';
import type { OptimizerResponse } from '../workers/optimizer.worker';

type OptState = { running: boolean; fraction: number; message: string | null };

export function ProfileScreen() {
  const app = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const [opt, setOpt] = useState<OptState>({ running: false, fraction: 0, message: null });
  const workerRef = useRef<Worker | null>(null);
  const s = app.settings;

  useEffect(() => () => workerRef.current?.terminate(), []);

  const runOptimizer = () => {
    if (opt.running) return;
    setOpt({ running: true, fraction: 0, message: null });
    const worker = new Worker(new URL('../workers/optimizer.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current = worker;
    worker.onmessage = (e: MessageEvent<OptimizerResponse>) => {
      const msg = e.data;
      if (msg.type === 'progress') {
        setOpt((o) => ({ ...o, fraction: msg.fraction }));
      } else if (msg.type === 'done') {
        setState((st) => ({ ...st, fsrsWeights: msg.weights }));
        const gain = msg.lossBefore > 0 ? Math.max(0, (1 - msg.lossAfter / msg.lossBefore) * 100) : 0;
        setOpt({ running: false, fraction: 1, message: `Tuned to your memory from ${msg.samples} reviews (${gain.toFixed(1)}% better fit).` });
        worker.terminate();
      } else {
        setOpt({ running: false, fraction: 0, message: msg.message });
        worker.terminate();
      }
    };
    worker.postMessage({ log: app.reviewLog });
  };

  const update = (patch: Partial<typeof s>) => setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));

  const onReminderChange = async (enabled: boolean, time: string) => {
    update({ reminderEnabled: enabled, reminderTime: time });
    if (enabled) {
      const ok = await ensureNotificationPermission();
      const met = (app.xpByDay[todayKey()] ?? 0) >= app.settings.dailyGoal;
      if (ok) await scheduleDailyReminder(time, app.streak, met);
    } else {
      await cancelReminders();
    }
  };

  return (
    <div className="profile-screen">
      <div className="profile-header">
        <div className="avatar">🇲🇳</div>
        <input
          className="name-input"
          value={s.name}
          onChange={(e) => update({ name: e.target.value })}
          aria-label="Your name"
        />
        <div className="joined">Learning Mongolian since {new Date(app.createdAt).toLocaleDateString()}</div>
      </div>

      <div className="settings-card">
        <h3>💎 Shop · {app.gems} gems</h3>
        <div className="shop-item">
          <div>
            <b>Streak freeze</b>
            <span>{app.streakFreezes}/2 equipped · protects a missed day · 200 gems</span>
          </div>
          <button className="btn-small" disabled={app.streakFreezes >= 2 || app.gems < 200} onClick={() => buyStreakFreeze(200)}>
            BUY
          </button>
        </div>
      </div>

      <div className="settings-card">
        <h3>⚙️ Settings</h3>
        <label className="setting-row">
          <span>Daily goal</span>
          <select value={s.dailyGoal} onChange={(e) => update({ dailyGoal: Number(e.target.value) })}>
            <option value={10}>Casual · 10 XP</option>
            <option value={20}>Regular · 20 XP</option>
            <option value={30}>Serious · 30 XP</option>
            <option value={50}>Intense · 50 XP</option>
          </select>
        </label>
        <label className="setting-row">
          <span>Daily reminder</span>
          <input type="checkbox" checked={s.reminderEnabled} onChange={(e) => void onReminderChange(e.target.checked, s.reminderTime)} />
        </label>
        {s.reminderEnabled && (
          <label className="setting-row">
            <span>Reminder time</span>
            <input type="time" value={s.reminderTime} onChange={(e) => void onReminderChange(true, e.target.value)} />
          </label>
        )}
        <label className="setting-row">
          <span>Sound effects</span>
          <input type="checkbox" checked={s.soundEnabled} onChange={(e) => update({ soundEnabled: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span>Show romanization</span>
          <input type="checkbox" checked={s.showRomanization} onChange={(e) => update({ showRomanization: e.target.checked })} />
        </label>
      </div>

      <div className="settings-card">
        <h3>🧠 Review scheduling</h3>
        <label className="setting-row">
          <span>Target retention</span>
          <select value={s.targetRetention} onChange={(e) => update({ targetRetention: Number(e.target.value) })}>
            <option value={0.8}>Relaxed · 80%</option>
            <option value={0.85}>Light · 85%</option>
            <option value={0.9}>Balanced · 90%</option>
            <option value={0.95}>Thorough · 95%</option>
          </select>
        </label>
        <div className="shop-item">
          <div>
            <b>Personalize scheduling</b>
            <span>
              {app.fsrsWeights ? 'Using weights tuned to your memory. ' : ''}
              {app.reviewLog.length < MIN_REVIEWS_TO_OPTIMIZE
                ? `Needs ${MIN_REVIEWS_TO_OPTIMIZE} logged reviews — ${app.reviewLog.length} so far.`
                : `Fits the scheduler to your ${app.reviewLog.length} logged reviews.`}
            </span>
          </div>
          <button
            className="btn-small"
            disabled={opt.running || app.reviewLog.length < MIN_REVIEWS_TO_OPTIMIZE}
            onClick={runOptimizer}
          >
            {opt.running ? `${Math.round(opt.fraction * 100)}%` : 'OPTIMIZE'}
          </button>
        </div>
        {opt.message && <div className="joined">{opt.message}</div>}
        {app.fsrsWeights && !opt.running && (
          <div className="shop-item">
            <div>
              <b>Reset to default weights</b>
              <span>Go back to the stock FSRS scheduler.</span>
            </div>
            <button className="btn-small" onClick={() => setState((st) => ({ ...st, fsrsWeights: null }))}>
              RESET
            </button>
          </div>
        )}
      </div>

      <div className="settings-card danger-zone">
        <h3>Danger zone</h3>
        {confirmReset ? (
          <div className="reset-confirm">
            <span>Really erase all progress?</span>
            <button className="btn-small btn-danger" onClick={() => { resetAllProgress(); setConfirmReset(false); }}>
              YES, ERASE
            </button>
            <button className="btn-small" onClick={() => setConfirmReset(false)}>
              CANCEL
            </button>
          </div>
        ) : (
          <button className="btn-small btn-danger" onClick={() => setConfirmReset(true)}>
            RESET ALL PROGRESS
          </button>
        )}
      </div>

      <div className="about">
        DuoMongo · offline Mongolian course for English speakers.
        <br />
        All data stays on this device.
      </div>
    </div>
  );
}
