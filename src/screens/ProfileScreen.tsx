import { useState } from 'react';
import { buyStreakFreeze, MAX_HEARTS, refillHearts, resetAllProgress, setState, todayKey, useAppState } from '../lib/store';
import { cancelReminders, ensureNotificationPermission, scheduleDailyReminder } from '../lib/notifications';

export function ProfileScreen() {
  const app = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);
  const s = app.settings;

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
            <b>Refill hearts</b>
            <span>
              {app.hearts}/{MAX_HEARTS} hearts · 350 gems
            </span>
          </div>
          <button
            className="btn-small"
            disabled={app.hearts >= MAX_HEARTS || app.gems < 350 || !s.heartsEnabled}
            onClick={() => refillHearts(350)}
          >
            REFILL
          </button>
        </div>
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
          <span>Hearts (mistake limit)</span>
          <input type="checkbox" checked={s.heartsEnabled} onChange={(e) => update({ heartsEnabled: e.target.checked })} />
        </label>
        <label className="setting-row">
          <span>Show romanization</span>
          <input type="checkbox" checked={s.showRomanization} onChange={(e) => update({ showRomanization: e.target.checked })} />
        </label>
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
