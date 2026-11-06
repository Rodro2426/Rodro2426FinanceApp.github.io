// The reminders a phone hands to the notification server, so they arrive even when Pockets is closed:
// the same "due tomorrow" messages as the in-app notifications, at 9:00 the day before.
import type { Data } from './types';
import { addDays, monthKey, todayISO } from './dates';
import { billAmount, dueDate, isAuto, isCardPay, isIncome, notMine, parseShortDate } from './schedule';
import { fmt } from './derive';

export interface Reminder { at: number; title: string; body: string; url: string; tag: string }
/** A time of day (local) on this date. */
const at = (iso: string, h: number) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d, h, 0, 0).getTime(); };
const nineAm = (iso: string) => at(iso, 9);

export function upcomingReminders(d: Data, today = todayISO(), days = 35): Reminder[] {
  const out: Reminder[] = [];
  const now = Date.now();
  const acct = (id?: string) => d.accounts.find(a => a.id === id)?.name ?? 'your account';
  for (let k = 1; k <= days; k++) {
    const due = addDays(today, k), remind = nineAm(addDays(due, -1)), m = monthKey(due);
    if (remind < now) continue;
    for (const b of d.bills) {
      if (dueDate(b, m) !== due || b.paidMonths.includes(m) || (b.skipMonths || []).includes(m) || (b.start && due < b.start)) continue;
      const auto = isAuto(b, d);
      const r = isCardPay(b) ? { title: `${acct(b.toCard)} payment tomorrow`, body: b.payMode === 'fixed' ? `${fmt(b.amt)} from ${acct(b.acct)}.` : `The full balance, from ${acct(b.acct)}.` }
        : isIncome(b) ? { title: `${b.name} arrives tomorrow`, body: `+${billAmount(b)}${auto ? ` to ${acct(b.acct)}` : ''}.` }
        : notMine(b) ? { title: `${b.name} is due tomorrow`, body: `${billAmount(b)}, paid by someone else.` }
        : { title: `${b.name} is due tomorrow`, body: `${billAmount(b)}${auto ? ` will be paid automatically from ${acct(b.acct)}` : '. Remember to pay it'}.` };
      out.push({ at: remind, ...r, url: '#calendar', tag: `soon:${b.id}:${due}` });
    }
    for (const a of d.accounts) {
      if (a.type !== 'card' || a.bal <= 0 || parseShortDate(a.due, due) !== due) continue;
      out.push({ at: remind, title: `${a.name} payment is due tomorrow`, body: `You owe ${fmt(a.bal)}.`, url: '#accounts', tag: `card:${a.id}:${due}` });
    }
  }
  // On the day itself, at 8:00: every scheduled event in the calendar (what arrives, what's charged, what to pay).
  for (let k = 0; k <= days; k++) {
    const day = addDays(today, k), when = at(day, 8), m = monthKey(day);
    if (when < now) continue;
    for (const b of d.bills) {
      if (dueDate(b, m) !== day || b.paidMonths.includes(m) || (b.skipMonths || []).includes(m) || (b.start && day < b.start)) continue;
      const auto = isAuto(b, d);
      const r = isCardPay(b) ? { title: `${acct(b.toCard)} payment is today`, body: b.payMode === 'fixed' ? `${fmt(b.amt)}${auto ? ` from ${acct(b.acct)}` : '. Remember to pay it'}.` : `The full balance${auto ? `, from ${acct(b.acct)}` : '. Remember to pay it'}.` }
        : isIncome(b) ? { title: `💰 ${b.name} arrives today`, body: `+${billAmount(b)}${b.acct ? ` to ${acct(b.acct)}` : ''}.` }
        : notMine(b) ? { title: `${b.name} is due today`, body: `${billAmount(b)}, paid by someone else.` }
        : auto ? { title: `${b.name} is charged today`, body: `−${billAmount(b)} from ${acct(b.acct)}.` }
        : { title: `${b.name} is due today`, body: `${billAmount(b)}. Remember to pay it.` };
      out.push({ at: when, ...r, url: '#calendar', tag: `day:${b.id}:${day}` });
    }
    for (const a of d.accounts) {
      if (a.type !== 'card' || a.bal <= 0 || parseShortDate(a.due, day) !== day) continue;
      out.push({ at: when, title: `${a.name} payment is due today`, body: `You owe ${fmt(a.bal)}.`, url: '#accounts', tag: `card0:${a.id}:${day}` });
    }
  }
  // Monthly backup reminder on the chosen day, at 9:00 (only when there's something to back up).
  if (d.settings.backupReminder !== false && (d.expenses.length || d.accounts.length)) {
    const day = Math.min(28, Math.max(1, d.settings.backupDay || 1));
    for (let k = 0; k < 2; k++) {
      const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + k);
      const iso = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (nineAm(iso) > now && (!d.settings.lastBackup || d.settings.lastBackup < iso)) { out.push({ at: nineAm(iso), title: 'Time for your monthly backup', body: 'Open Pockets and tap Back up now.', url: '#backup', tag: `backup:${iso.slice(0, 7)}` }); break; }
    }
  }
  return out.sort((a, b) => a.at - b.at).slice(0, 60);
}
