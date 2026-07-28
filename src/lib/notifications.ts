import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const DAILY_ID_BASE = 1100; // 1100..1106 — rolling week of daily reminders
const STREAK_ID_BASE = 1200; // 1200..1206 — evening streak nudges
const LEGACY_IDS = [1001, 1002];

const isNative = Capacitor.isNativePlatform();

function allIds(): { id: number }[] {
  return [
    ...LEGACY_IDS.map((id) => ({ id })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: DAILY_ID_BASE + i })),
    ...Array.from({ length: 7 }, (_, i) => ({ id: STREAK_ID_BASE + i })),
  ];
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (isNative) {
    try {
      let status = await LocalNotifications.checkPermissions();
      if (status.display !== 'granted') {
        status = await LocalNotifications.requestPermissions();
      }
      return status.display === 'granted';
    } catch {
      return false;
    }
  }
  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      const p = await Notification.requestPermission();
      return p === 'granted';
    }
  }
  return false;
}

/**
 * Schedule a rolling week of one-shot reminders (daily lesson + evening streak
 * nudge). Today's are skipped when the daily goal is already met — call this
 * again after every session so hitting the goal silences today's reminders.
 */
export async function scheduleDailyReminder(time: string, streak: number, goalMetToday: boolean) {
  if (!isNative) return;
  try {
    const [hour, minute] = time.split(':').map(Number);
    await LocalNotifications.cancel({ notifications: allIds() });
    const now = new Date();
    const notifications = [];
    for (let i = 0; i < 7; i++) {
      const daily = new Date(now);
      daily.setDate(daily.getDate() + i);
      daily.setHours(hour, minute, 0, 0);
      const skipToday = i === 0 && goalMetToday;
      if (!skipToday && daily.getTime() > Date.now()) {
        notifications.push({
          id: DAILY_ID_BASE + i,
          title: 'Монгол хэл сурцгаая! 🇲🇳',
          body: 'Time for your daily Mongolian lesson. Keep it up!',
          schedule: { at: daily, allowWhileIdle: true },
        });
      }
      const nudge = new Date(now);
      nudge.setDate(nudge.getDate() + i);
      nudge.setHours(21, 30, 0, 0);
      if (!skipToday && nudge.getTime() > Date.now()) {
        notifications.push({
          id: STREAK_ID_BASE + i,
          title: streak > 0 ? `Don't lose your ${streak}-day streak! 🔥` : 'Your streak is waiting 🔥',
          body: 'A quick 3-minute lesson keeps the streak alive.',
          schedule: { at: nudge, allowWhileIdle: true },
        });
      }
    }
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
  } catch {
    // notifications unavailable; not fatal
  }
}

export async function cancelReminders() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: allIds() });
  } catch {
    // ignore
  }
}
