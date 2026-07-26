import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const DAILY_ID = 1001;
const STREAK_ID = 1002;

const isNative = Capacitor.isNativePlatform();

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

/** Schedule (or reschedule) the daily reminder plus an evening streak-danger nudge. */
export async function scheduleDailyReminder(time: string, streak: number) {
  if (!isNative) return;
  try {
    const [hour, minute] = time.split(':').map(Number);
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }, { id: STREAK_ID }] });
    await LocalNotifications.schedule({
      notifications: [
        {
          id: DAILY_ID,
          title: 'Монгол хэл сурцгаая! 🇲🇳',
          body: 'Time for your daily Mongolian lesson. Keep it up!',
          schedule: { on: { hour, minute }, allowWhileIdle: true },
          smallIcon: 'ic_stat_icon_config_sample',
        },
        {
          id: STREAK_ID,
          title: streak > 0 ? `Don't lose your ${streak}-day streak! 🔥` : 'Your streak is waiting 🔥',
          body: 'A quick 3-minute lesson keeps the streak alive.',
          schedule: { on: { hour: 21, minute: 30 }, allowWhileIdle: true },
          smallIcon: 'ic_stat_icon_config_sample',
        },
      ],
    });
  } catch {
    // notifications unavailable; not fatal
  }
}

export async function cancelReminders() {
  if (!isNative) return;
  try {
    await LocalNotifications.cancel({ notifications: [{ id: DAILY_ID }, { id: STREAK_ID }] });
  } catch {
    // ignore
  }
}
