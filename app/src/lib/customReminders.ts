// Your own reminders, like "Add today's expenses" every night at 9:00. Each one repeats on the weekdays you pick.
// They reach the lock screen through the same server as bill reminders (lib/reminders.ts), and when their time
// comes they also appear in the in-app notification center (lib/schedule.ts). Tapping one opens New expense.
import type { CustomReminder, Data } from './types';
import { addDays } from './dates';
import { weekdayOf } from './derive';
import { tr } from './i18n';

export const ALL_WEEK = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [0, 1, 2, 3, 4];
export const WEEKEND = [5, 6];
export const remindersOf = (d: Data): CustomReminder[] => d.reminders ?? [];

/** The suggested first reminder. */
// Saved in the app's language (it's your own text from then on, and you can edit it).
export const nightly = (id: string): CustomReminder => ({ id, title: tr("Add today's expenses"), body: tr('Open Pockets and log what you spent today.'), time: '21:00', days: ALL_WEEK, on: true });

/** "HH:MM" on that day, as a timestamp in this phone's time zone. */
export const timeOn = (iso: string, hhmm: string) => {
  const [y, m, d] = iso.split('-').map(Number), [h, min] = hhmm.split(':').map(Number);
  return new Date(y, m - 1, d, h || 0, min || 0, 0).getTime();
};
/** Whether the reminder repeats on that day. */
export const remindsOn = (r: CustomReminder, iso: string) => r.on && r.days.includes(weekdayOf(iso));

/** The next time it will ring (from `now`), within two weeks; null when it's off or has no days. */
export function nextRing(r: CustomReminder, today: string, now = Date.now()): number | null {
  for (let k = 0; k <= 14; k++) {
    const day = addDays(today, k);
    if (remindsOn(r, day) && timeOn(day, r.time) > now) return timeOn(day, r.time);
  }
  return null;
}

/** Lock-screen notifications for the next `days` days (the phone re-sends them whenever the app opens). */
export function customLockReminders(d: Data, today: string, days = 14, now = Date.now()) {
  const out: { at: number; title: string; body: string; url: string; tag: string }[] = [];
  for (const r of remindersOf(d)) for (let k = 0; k <= days; k++) {
    const day = addDays(today, k), at = timeOn(day, r.time);
    if (remindsOn(r, day) && at > now) out.push({ at, title: r.title, body: r.body, url: '#add', tag: `rem:${r.id}:${day}` });
  }
  return out;
}

/** Reminders whose time today has already come (for the in-app notification center). */
export const ringingToday = (d: Data, today: string, now = Date.now()) =>
  remindersOf(d).filter(r => remindsOn(r, today) && timeOn(today, r.time) <= now);
