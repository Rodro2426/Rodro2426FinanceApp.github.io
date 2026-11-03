// All dates are local calendar days as 'YYYY-MM-DD'.
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d, 12); };
export const todayISO = () => iso(new Date());
export const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const monthKey = (s: string) => s.slice(0, 7);
export const prevMonthKey = (m: string) => { const d = parse(m + '-01'); d.setMonth(d.getMonth() - 1); return iso(d).slice(0, 7); };
export const daysInMonth = (m: string) => { const d = parse(m + '-01'); return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); };
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/** Monday of the week containing `s`. */
export const weekStart = (s: string) => { const d = parse(s); const wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return iso(d); };
export const inRange = (s: string, a: string, b: string) => s >= a && s <= b;

export const fmtDay = (s: string, opts: Intl.DateTimeFormatOptions) => parse(s).toLocaleDateString('en-US', opts);
export const shortDate = (s: string) => fmtDay(s, { month: 'short', day: 'numeric' });
export const monthName = (m: string) => fmtDay(m + '-15', { month: 'long' });
export const monthLabel = (m: string) => (m === 'all' ? 'All months' : fmtDay(m + '-15', { month: 'long', year: 'numeric' }));

/** "Today", a weekday for the last 6 days, otherwise "Oct 31". */
export function relDay(s: string, today: string) {
  const diff = daysBetween(s, today);
  if (diff === 0) return 'Today';
  if (diff > 0 && diff < 7) return fmtDay(s, { weekday: 'short' });
  return shortDate(s);
}

export interface Ctx {
  today: string; month: string; weekStart: string; weekEnd: string; lastWeekStart: string; lastWeekEnd: string;
  weekNo: number; weeks: number; daysLeft: number;
}
export function makeCtx(weeks: number, today = todayISO()): Ctx {
  const ws = weekStart(today), we = addDays(ws, 6);
  // Week N = count of Mondays in this month up to this week's Monday (week 1 if it started last month).
  const firstMon = weekStart(addDays(today.slice(0, 8) + '01', 6));
  const weekNo = ws < firstMon ? 1 : Math.min(weeks, Math.floor(daysBetween(firstMon, ws) / 7) + 1);
  return {
    today, month: monthKey(today), weekStart: ws, weekEnd: we, lastWeekStart: addDays(ws, -7), lastWeekEnd: addDays(ws, -1),
    weekNo, weeks, daysLeft: daysBetween(today, we)
  };
}
