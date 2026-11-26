// Streak and achievements. Everything is worked out from the data; only the days marked "I spent nothing" and the
// date each achievement was first earned are saved (Data.zeroDays, Data.trophies).
import type { Data } from './types';
import { addDays, ctxAt, daysInMonth, iso, monthKey, prevMonthKey, weekStart } from './dates';
import { myAccounts, myExpenses, periodAt, pocketStats, weekdayOf } from './derive';
import { monthSummary } from './plan';

/** Days with at least one expense dated that day. */
export const spendDays = (d: Data) => new Set(d.expenses.map(e => e.date));
/** Logged on its own day: the day it was saved is the day it's dated. Expenses added later don't keep the streak. */
const onTime = (e: Data['expenses'][number]) => iso(new Date(e.ts)) === e.date;
/** A day counts for the streak when an expense was logged that same day, or it was marked "I spent nothing today". */
export function sealedDays(d: Data): Set<string> {
  const s = new Set(d.expenses.filter(onTime).map(e => e.date));
  (d.zeroDays ?? []).forEach(x => s.add(x));
  return s;
}
/** Days that have expenses, but all of them were logged on a later day: they're shown in red and break the streak. */
export function lateDays(d: Data): Set<string> {
  const ok = sealedDays(d);
  return new Set(d.expenses.filter(e => !ok.has(e.date)).map(e => e.date));
}

/** Days in a row up to today. Today not sealed yet doesn't break it: the run up to yesterday still counts until the day ends. */
export function currentStreak(d: Data, today: string): number {
  const s = sealedDays(d);
  let day = s.has(today) ? today : addDays(today, -1), n = 0;
  while (s.has(day)) { n++; day = addDays(day, -1); }
  return n;
}

/** The longest run of sealed days ever (up to today: future-dated expenses don't count). */
export function bestStreak(d: Data, today: string): number {
  const days = [...sealedDays(d)].filter(x => x <= today).sort();
  let best = 0, run = 0, prev = '';
  for (const x of days) { run = prev && addDays(prev, 1) === x ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return best;
}

/** Marks or unmarks a day as "I spent nothing". */
export const toggleZero = (d: Data, day: string): Partial<Data> => {
  const z = d.zeroDays ?? [];
  return { zeroDays: z.includes(day) ? z.filter(x => x !== day) : [...z, day].sort() };
};

/** True when every pocket period that ended inside [a, b] finished at $0 or better, and something was spent in it. */
export function cleanRange(d: Data, a: string, b: string): boolean {
  if (!d.pockets.length || !myExpenses(d).some(e => e.date >= a && e.date <= b)) return false;
  let checked = 0;
  for (const p of d.pockets) {
    // Every period of the pocket whose last day is inside [a, b], newest first.
    let end = periodAt(p, b)[1];
    if (end > b) end = addDays(periodAt(p, b)[0], -1);
    for (let guard = 0; end >= a && guard < 40; guard++) {
      const [start] = periodAt(p, end);
      if ((pocketStats(d, p.id, ctxAt(end))?.left ?? 0) < -0.005) return false;
      checked++;
      end = addDays(start, -1);
    }
  }
  return checked > 0;
}

/** The last Mon–Sun week, quincena and month that have fully ended before today. */
const lastWeek = (today: string): [string, string] => { const ws = addDays(weekStart(today), -7); return [ws, addDays(ws, 6)]; };
function lastHalf(today: string): [string, string] {
  const m = monthKey(today);
  if (Number(today.slice(8)) > 15) return [m + '-01', m + '-15'];
  const pm = prevMonthKey(m);
  return [pm + '-16', `${pm}-${daysInMonth(pm)}`];
}

/** Average spending per month over the last 3 finished months that had spending (0 if none). */
function monthlySpend(d: Data, today: string): number {
  const totals: number[] = [];
  let m = prevMonthKey(monthKey(today));
  for (let i = 0; i < 3; i++, m = prevMonthKey(m)) {
    const t = myExpenses(d).filter(e => monthKey(e.date) === m).reduce((a, e) => a + e.amt, 0);
    if (t > 0) totals.push(t);
  }
  return totals.length ? totals.reduce((a, x) => a + x, 0) / totals.length : 0;
}
const cushion = (d: Data, today: string, months: number) => {
  const spend = monthlySpend(d, today);
  const saved = myAccounts(d).filter(a => a.type === 'savings').reduce((a, x) => a + x.bal, 0);
  return spend > 0 && saved >= spend * months;
};

/** A weekend (Saturday and Sunday) both marked "I spent nothing" with no expense on either day. */
function zeroWeekend(d: Data): boolean {
  const z = new Set(d.zeroDays ?? []), spent = spendDays(d);
  return [...z].some(x => weekdayOf(x) === 5 && z.has(addDays(x, 1)) && !spent.has(x) && !spent.has(addDays(x, 1)));
}

export type Group = 'streak' | 'start' | 'control' | 'saving' | 'hidden';
export interface Achievement { id: string; group: Group; name: string; desc: string; /** Short text on the badge. */ mark: string; hidden?: boolean; earned: (d: Data, today: string) => boolean; /** Progress 0–1 for the ones still locked. */ progress?: (d: Data, today: string) => number }

const streakGoal = (n: number) => ({ earned: (d: Data, t: string) => bestStreak(d, t) >= n, progress: (d: Data, t: string) => Math.min(1, currentStreak(d, t) / n) });

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'streak7', group: 'streak', name: 'One week', desc: '7 days in a row up to date', mark: '7', ...streakGoal(7) },
  { id: 'streak30', group: 'streak', name: 'A whole month', desc: '30 days in a row up to date', mark: '30', ...streakGoal(30) },
  { id: 'streak100', group: 'streak', name: 'One hundred days', desc: '100 days in a row up to date', mark: '100', ...streakGoal(100) },
  { id: 'pocket', group: 'start', name: 'First pocket', desc: 'You created your first pocket', mark: '1', earned: d => d.pockets.length > 0 },
  { id: 'plan', group: 'start', name: 'Full plan', desc: 'Your pockets add up to all your monthly income', mark: '%',
    earned: (d, t) => { const s = monthSummary(d, ctxAt(t)); return d.pockets.length > 0 && s.income > 0 && Math.abs(s.planGap) <= s.income * 0.01; } },
  { id: 'accounts', group: 'start', name: 'All in place', desc: 'You added at least 2 accounts', mark: '2', earned: d => myAccounts(d).length >= 2 },
  { id: 'autopilot', group: 'start', name: 'Autopilot', desc: 'You scheduled your first payment or income', mark: '↻', earned: d => d.bills.length > 0 },
  { id: 'week', group: 'control', name: 'Clean week', desc: 'A week with no pocket in the red', mark: 'W', earned: (d, t) => { const [a, b] = lastWeek(t); return cleanRange(d, a, b); } },
  { id: 'half', group: 'control', name: 'Spotless quincena', desc: 'A quincena with no pocket in the red', mark: '15', earned: (d, t) => { const [a, b] = lastHalf(t); return cleanRange(d, a, b); } },
  { id: 'invest', group: 'saving', name: 'First investment', desc: 'You opened your first CDT, fund or stock', mark: '$',
    earned: d => !!(d.investments.cdts?.length || d.investments.funds?.length || d.investments.trades.length) },
  { id: 'cushion1', group: 'saving', name: '1-month cushion', desc: 'Your savings cover a month of spending', mark: '1M', earned: (d, t) => cushion(d, t, 1) },
  { id: 'cushion3', group: 'saving', name: '3-month cushion', desc: 'Your savings cover 3 months of spending', mark: '3M', earned: (d, t) => cushion(d, t, 3) },
  { id: 'weekend', group: 'hidden', hidden: true, name: 'Zero weekend', desc: 'Saturday and Sunday with nothing spent', mark: '0', earned: d => zeroWeekend(d) },
  { id: 'december', group: 'hidden', hidden: true, name: 'December under control', desc: 'December with no pocket in the red', mark: '12',
    // The last December that has fully ended.
    earned: (d, t) => { const y = Number(t.slice(0, 4)) - 1; return cleanRange(d, `${y}-12-01`, `${y}-12-31`); } }
];

/** Achievements earned now that aren't saved yet. */
export const newlyEarned = (d: Data, today: string) => ACHIEVEMENTS.filter(a => !d.trophies?.[a.id] && a.earned(d, today));
