import { getLang } from './i18n';
import type { Account, Data, Expense, Income, Move } from './types';
import { POCKET_CAT } from './constants';
import { addDays, daysBetween, fmtDay, inRange, makeCtx, monthKey, parse, type Ctx } from './dates';
import { getData } from './store';
import { STARS, moneyHidden } from './privacy';
import { unitsFor, weekShares } from './split';

export const num = (s: unknown) => { const n = parseFloat(String(s ?? '').replace(',', '.')); return isFinite(n) ? n : 0; };
export const isCOP = () => getData().settings.currency === 'COP';
export const curSymbol = () => (isCOP() ? '$' : getData().settings.currency);
export function fmt(n: number, sign?: boolean) {
  const cop = isCOP();
  if (moneyHidden()) return (n < 0 ? '−' : sign && n > 0 ? '+' : '') + curSymbol() + STARS;
  const s = curSymbol() + Math.abs(n).toLocaleString(cop ? 'es-CO' : 'en-US', { minimumFractionDigits: cop ? 0 : 2, maximumFractionDigits: cop ? 0 : 2 });
  return n < 0 ? '−' + s : sign && n > 0 ? '+' + s : s;
}
export const roundAmt = (n: number) => (isCOP() ? Math.round(n) : Math.round(n * 100) / 100);
export const pctOf = (a: number, b: number) => (b > 0 ? Math.max(0, Math.min(100, (a / b) * 100)) : 0).toFixed(1) + '%';
export const uid = (p: string) => p + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

/** "US$20,00 at TRM $4.123" for converted dollar amounts. */
export const fxText = (o?: { amt: number; rate: number; official: boolean }) => (o ? moneyHidden() ? `US$${STARS}` : `US$${o.amt.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} at ${o.official ? 'TRM ' : '≈'}${fmt(o.rate)}` : undefined);
export const ctxOf = (d: Data) => makeCtx(d.settings.weeks);
export const catOf = (e: Expense): [string, string] => (e.cat ? [e.cat, e.sub || ''] : POCKET_CAT[e.p] || ['Other', 'Other']);
export const byDateDesc = (x: { date: string; ts: number }, y: { date: string; ts: number }) => (y.date > x.date ? 1 : y.date < x.date ? -1 : y.ts - x.ts);
export const sortedExpenses = (d: Data) => [...d.expenses].sort(byDateDesc);
/** Your own accounts and cards (not ones marked "This isn't mine"). */
export const myAccounts = (d: Data) => d.accounts.filter(a => !a.notMine);
/** Expenses that count as your spending: not the ones paid with someone else's account or card. */
export function myExpenses(d: Data) {
  const off = new Set(d.accounts.filter(a => a.notMine).map(a => a.id));
  return off.size ? d.expenses.filter(e => !off.has(e.a)) : d.expenses;
}
export const weekExpenses = (d: Data, c: Ctx) => myExpenses(d).filter(e => inRange(e.date, c.weekStart, c.weekEnd));
export const monthExpenses = (d: Data, c: Ctx) => myExpenses(d).filter(e => monthKey(e.date) === c.month);

export interface PocketStats {
  id: string; name: string; hue: number; weekly: number; mIn: number; mOut: number; spent: number; budget: number; left: number;
  /** What came in from the previous periods (0 when carry over is off); already part of `budget`. */
  carry: number;
  initial: string; photoBg: string; emoji: string; photo: string | null;
  /** 'week' or 'half' (every 15 days), and the first and last day of the current period. */
  period: 'week' | 'half'; from: string; to: string;
}

/* ---------------- Periods: a week, or half a month ---------------- */
type PocketLike = { period?: 'week' | 'half'; weeklyStr?: string; start?: { from: string; amt: number } } | undefined;
export const isHalf = (p: PocketLike) => p?.period === 'half';
/** The quincena a day is in: 1st–15th or 16th–last day. */
export function halfOf(iso: string): [string, string] {
  const m = iso.slice(0, 7);
  return Number(iso.slice(8, 10)) <= 15 ? [m + '-01', m + '-15'] : [m + '-16', `${m}-${String(new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate()).padStart(2, '0')}`];
}
/** The context for one pocket: for a 15-day pocket "the week" becomes its current quincena. */
export function pocketCtx(p: PocketLike, c: Ctx): Ctx {
  if (!isHalf(p)) return c;
  const [a, b] = halfOf(c.today);
  return { ...c, weekStart: a, weekEnd: b, daysLeft: daysBetween(c.today, b) };
}
/** First and last day of the period that contains `iso`. */
export const periodAt = (p: PocketLike, iso: string): [string, string] => (isHalf(p) ? halfOf(iso) : [weekStartOf(iso), addDays(weekStartOf(iso), 6)]);
const weekStartOf = (iso: string) => addDays(iso, -((parse(iso).getDay() + 6) % 7));
/** Periods in a month: 2 quincenas, or the plan's weeks. */
export const periodsInMonth = (p: PocketLike, weeks: number) => (isHalf(p) ? 2 : weeks);
/** The budget a pocket plans for a whole month (a smaller first period counts too). */
export function monthPlanOf(p: PocketLike, c: Ctx): number {
  const amt = num(p?.weeklyStr);
  const cut = p?.start && monthKey(p.start.from) === c.month ? amt - p.start.amt : 0;
  return amt * periodsInMonth(p, c.weeks) - cut;
}
/** Whether a move was made in the period that starts on `start` (a week's Monday, or a quincena's first day). */
function moveAtStart(m: Move, p: PocketLike, start: string): boolean {
  if (m.month) return false;
  if (!isHalf(p)) return m.week === start;
  const [a, b] = halfOf(start);
  return inRange(m.day ?? addDays(m.week, 6), a, b);
}
/** Whether a pocket-to-pocket move counts in this pocket's current period. */
export function moveInPeriod(m: Move, p: PocketLike, c: Ctx): boolean {
  return moveAtStart(m, p, isHalf(p) ? halfOf(c.today)[0] : c.weekStart);
}
const prevStart = (p: PocketLike, s: string) => (isHalf(p) ? halfOf(addDays(s, -1))[0] : addDays(s, -7));
const nextStart = (p: PocketLike, s: string) => (isHalf(p) ? addDays(halfOf(s)[1], 1) : addDays(s, 7));

/** A period's budget without any carry, and what was spent in it (moves in/out, spread income, and "next" moves arriving from the period before). */
function periodParts(d: Data, p: Data['pockets'][number], c: Ctx) {
  const pc = pocketCtx(p, c), id = p.id;
  const amount = num(p.weeklyStr);
  const weekly = p.start && p.start.from === pc.weekStart ? p.start.amt : amount;
  const moves = d.moves.filter(m => moveInPeriod(m, p, c));
  const before = prevStart(p, pc.weekStart);
  const arriving = d.moves.filter(m => m.next && m.to === id && moveAtStart(m, p, before)).reduce((a, m) => a + m.amt, 0);
  const mIn = moves.filter(m => m.to === id && !m.next).reduce((a, m) => a + m.amt, 0) + arriving + spreadThisPeriod(d, id, pc);
  const mOut = moves.filter(m => m.from === id).reduce((a, m) => a + m.amt, 0);
  const spent = weekExpenses(d, pc).filter(e => e.p === id).reduce((a, e) => a + e.amt, 0);
  return { pc, weekly, mIn, mOut, spent };
}

const carryMemo = new WeakMap<Data, Map<string, number>>();
/** What carries into the period starting on `start`: the running balance (budget without carry − spent) of every period since carry over was turned on. */
function carryInto(d: Data, p: Data['pockets'][number], start: string): number {
  if (!p.carry) return 0;
  const first = periodAt(p, p.carry)[0];
  if (start <= first) return 0;
  let memo = carryMemo.get(d);
  if (!memo) carryMemo.set(d, (memo = new Map()));
  const key = (s: string) => `${p.id}|${p.carry}|${s}`;
  const todo: string[] = [];
  let q = start, guard = 0;
  while (q > first && !memo.has(key(q)) && guard++ < 5000) { todo.push(q); q = prevStart(p, q); }
  if (q <= first) memo.set(key(first), 0);
  let acc = memo.get(key(q)) ?? 0;
  while (todo.length) {
    // q is the earlier period; add its balance to get the carry into the next one.
    const s = periodParts(d, p, makeCtx(d.settings.weeks, periodAt(p, q)[1]));
    acc += s.weekly + s.mIn - s.mOut - s.spent;
    q = nextStart(p, q); todo.pop();
    memo.set(key(q), acc);
  }
  return acc;
}

export function pocketStats(d: Data, id: string, c: Ctx = ctxOf(d)): PocketStats | null {
  const p = d.pockets.find(x => x.id === id);
  if (!p) return null;
  const { pc, weekly, mIn, mOut, spent } = periodParts(d, p, c);
  const carry = carryInto(d, p, pc.weekStart);
  const budget = weekly + mIn + carry - mOut;
  return {
    id, name: p.name, hue: p.hue, weekly, mIn, mOut, spent, budget, left: budget - spent, carry,
    initial: p.photo ? '' : p.emoji || p.name.trim().charAt(0).toUpperCase() || '·',
    photoBg: p.photo ? `url(${p.photo})` : 'none', emoji: p.emoji || '', photo: p.photo || null,
    period: isHalf(p) ? 'half' : 'week', from: pc.weekStart, to: pc.weekEnd
  };
}
export const allStats = (d: Data, c: Ctx = ctxOf(d)) => d.pockets.map(p => pocketStats(d, p.id, c)!);
/** A pocket's share of the current Mon–Sun week. Weekly pockets: their week. 15-day pockets: only this week's spending days inside the current quincena. */
export function weekShare(d: Data, id: string, c: Ctx = ctxOf(d), s: PocketStats | null = pocketStats(d, id, c)): { budget: number; spent: number; left: number } {
  const p = d.pockets.find(x => x.id === id);
  if (!p || !s) return { budget: 0, spent: 0, left: 0 };
  if (!isHalf(p)) return { budget: s.budget, spent: s.spent, left: s.left };
  const [qa, qb] = halfOf(c.today), weekEnd = addDays(c.weekStart, 6);
  const from = c.weekStart > qa ? c.weekStart : qa, to = weekEnd < qb ? weekEnd : qb;
  const ds = dayStats(d, id, c, s);
  const n = ds.week.filter(x => x.date > c.today && x.date <= to && x.active).length;
  // dayStats' futureShare already has today's overspend taken out, so today's part never goes below 0.
  const planned = Math.max(0, ds.left) + ds.futureShare * n;
  const left = s.left <= 0 ? s.left : Math.min(s.left, planned);
  const spent = myExpenses(d).filter(e => e.p === id && inRange(e.date, from, c.today)).reduce((a, e) => a + e.amt, 0);
  return { budget: spent + left, spent, left };
}

/**
 * This period's share of income split for the month: each monthly move is spread evenly over its weeks.
 * A 15-day pocket gets the weeks whose Sunday falls in its quincena, so the month total stays the same.
 */
function spreadThisPeriod(d: Data, id: string, pc: Ctx) {
  return d.moves.filter(m => m.month && m.to === id).reduce((a, m) => {
    const n = Math.max(1, m.spread ?? 1), shares = weekShares(m.amt, n, unitsFor(d.settings.currency));
    // The first share belongs to the day the income was split (so "this week" money lands in the current quincena).
    const at = (i: number) => (i === 0 && m.day ? m.day : addDays(m.week, i * 7 + 6));
    return a + shares.reduce((t, x, i) => (inRange(at(i), pc.weekStart, pc.weekEnd) ? t + x : t), 0);
  }, 0);
}

/** The week a move belongs to counts for the month its Sunday is in (week 1 can start last month). */
export const moveMonth = (m: { week: string; month?: string }) => m.month ?? monthKey(addDays(m.week, 6));

export interface MonthStats { id: string; budget: number; spent: number; left: number; extra: number }
/** A pocket for the whole month: its budget × periods, plus money moved in this month, minus what was spent. */
export function monthStats(d: Data, id: string, c: Ctx = ctxOf(d)): MonthStats {
  const p = d.pockets.find(x => x.id === id);
  const moves = d.moves.filter(m => moveMonth(m) === c.month);
  // A "next" move leaves in its own month and arrives in the month the following period belongs to.
  const arrives = (m: Move) => monthKey(isHalf(p) ? nextStart(p, periodAt(p, m.day ?? addDays(m.week, 6))[0]) : addDays(m.week, 13));
  const nextIn = d.moves.filter(m => m.next && m.to === id && arrives(m) === c.month).reduce((a, m) => a + m.amt, 0);
  // A "next" move out of a 15-day pocket leaves in the quincena it was made in, which can be in the month before moveMonth.
  const halfNext = (m: Move) => !!m.next && isHalf(p);
  const leaveMonth = (m: Move) => monthKey(periodAt(p, m.day ?? addDays(m.week, 6))[0]);
  const outNow = moves.filter(m => m.from === id && !halfNext(m)).reduce((a, m) => a + m.amt, 0);
  const outHalfNext = d.moves.filter(m => m.from === id && halfNext(m) && leaveMonth(m) === c.month).reduce((a, m) => a + m.amt, 0);
  const extra = moves.filter(m => m.to === id && !m.next).reduce((a, m) => a + m.amt, 0) - outNow - outHalfNext + nextIn;
  const spent = monthExpenses(d, c).filter(e => e.p === id).reduce((a, e) => a + e.amt, 0);
  let carry = 0;
  if (p?.carry) {
    const m01 = c.month + '-01';
    // Weekly: the first week whose Sunday is in the month (like moveMonth); 15-day: the quincena starting on the 1st.
    carry = carryInto(d, p, isHalf(p) ? m01 : addDays(m01, -weekdayOf(m01)));
  }
  const budget = monthPlanOf(p, c) + extra + carry;
  return { id, budget, spent, left: budget - spent, extra };
}
/* ---------------- Days ---------------- */
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const DAY_LETTERS = getLang() === 'es' ? ['L', 'M', 'M', 'J', 'V', 'S', 'D'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
/** 0 = Monday … 6 = Sunday. */
export const weekdayOf = (iso: string) => (parse(iso).getDay() + 6) % 7;
export const daysOf = (p?: { days?: number[] }) => (p?.days && p.days.length ? p.days : ALL_DAYS);

export interface DayPlan { date: string; wd: number; active: boolean; past: boolean; today: boolean; spent: number; amount: number }
export interface DayStats {
  /** Today is one of the pocket's spending days. */
  active: boolean;
  /** What today gets: the week's money left this morning, shared by today and the spending days still to come. */
  allowance: number; spentToday: number; left: number;
  /** Each spending day after today gets this (what's left after today, shared evenly). */
  futureShare: number;
  next?: DayPlan; week: DayPlan[];
}
/**
 * One pocket for today. The week's budget is shared by its spending days: today's allowance is fixed for the
 * whole day (what was left this morning ÷ spending days left, including today), so today + the days to come
 * always add up to what's left in the week.
 */
export function dayStats(d: Data, id: string, c: Ctx = ctxOf(d), s: PocketStats | null = pocketStats(d, id, c)): DayStats {
  const p = d.pockets.find(x => x.id === id), on = new Set(daysOf(p));
  c = pocketCtx(p, c);
  const exp = weekExpenses(d, c).filter(e => e.p === id);
  const spentOn = (iso: string) => exp.filter(e => e.date === iso).reduce((a, e) => a + e.amt, 0);
  const budget = s?.budget ?? 0;
  const spentBefore = exp.filter(e => e.date < c.today).reduce((a, e) => a + e.amt, 0);
  const spentToday = spentOn(c.today);
  const dates = Array.from({ length: daysBetween(c.weekStart, c.weekEnd) + 1 }, (_, i) => addDays(c.weekStart, i));
  const active = on.has(weekdayOf(c.today));
  const future = dates.filter(x => x > c.today && on.has(weekdayOf(x)));
  const leftBefore = budget - spentBefore;
  const allowance = active ? Math.max(0, leftBefore / (future.length + 1)) : 0;
  const left = allowance - spentToday;
  const weekLeftNow = leftBefore - spentToday;
  const futureShare = future.length ? Math.max(0, weekLeftNow - Math.max(0, left)) / future.length : 0;
  const week: DayPlan[] = dates.map(x => {
    const wd = weekdayOf(x), act = on.has(wd), past = x < c.today, today = x === c.today;
    return { date: x, wd, active: act, past, today, spent: spentOn(x), amount: today ? allowance : past || !act ? 0 : futureShare };
  });
  return { active, allowance, spentToday, left, futureShare, next: week.find(x => x.date > c.today && x.active), week };
}
export const dayLabel = (iso: string, c: Ctx) => (iso === addDays(c.today, 1) ? 'Tomorrow' : fmtDay(iso, { weekday: 'long' }));

/* ---------------- Income split into pockets ---------------- */
/**
 * Pocket moves that came from an income. Older splits had no link, so they're matched by the time they
 * were saved together (both ids start with the same timestamp).
 */
export function incomeMoves(moves: Move[], inc: Income): Move[] {
  const stamp = inc.id.startsWith('in') ? inc.id.slice(2, 10) : '';
  return moves.filter(m => m.from === '_income' && (m.income ? m.income === inc.id : !!stamp && m.id.slice(1, 9) === stamp));
}

/* ---------------- Fixing moves ---------------- */
/** When a move was made (its id starts with the time it was saved). */
export const moveTime = (m: Move) => { const t = parseInt(m.id.slice(1, 9), 36); return t > 1.5e12 && t < 4e12 ? t : 0; };

/** Undo a move: the money goes back where it came from (a goal gets its savings reduced). */
export function undoMove(d: Data, id: string): Partial<Data> {
  const m = d.moves.find(x => x.id === id);
  if (!m) return {};
  return {
    moves: d.moves.filter(x => x.id !== id),
    goals: d.goals.map(g => (g.id === m.to ? { ...g, saved: Math.max(0, g.saved - m.amt) } : g))
  };
}

/** Change how much a move moved; goals follow the difference. */
export function editMove(d: Data, id: string, amt: number): Partial<Data> {
  const m = d.moves.find(x => x.id === id);
  if (!m) return {};
  if (!(amt > 0)) return undoMove(d, id);
  const diff = amt - m.amt;
  return {
    moves: d.moves.map(x => (x.id === id ? { ...x, amt } : x)),
    goals: d.goals.map(g => (g.id === m.to ? { ...g, saved: Math.max(0, g.saved + diff) } : g))
  };
}

/** The most a move can be changed to: an income split can't exceed the income; a pocket can't give more than it has left. */
export function moveMax(d: Data, m: Move, c: Ctx = ctxOf(d)): number {
  if (m.from === '_income') {
    const inc = d.incomes.find(t => incomeMoves([m], t).length);
    return inc ? inc.amt - incomeMoves(d.moves, inc).filter(x => x.id !== m.id).reduce((a, x) => a + x.amt, 0) : Infinity;
  }
  const srcPocket = d.pockets.find(p => p.id === m.from);
  // A "next" move edited from its arrival side (made in an earlier period): it can only be lowered or undone.
  if (m.next && !moveInPeriod(m, srcPocket, c)) return m.amt;
  const src = pocketStats(d, m.from, c);
  return src && moveInPeriod(m, srcPocket, c) ? Math.max(0, src.left) + m.amt : Infinity;
}

/** Weeks left in the month, counting this one. */
export const weeksLeft = (c: Ctx) => Math.max(1, c.weeks - c.weekNo + 1);

export interface Txn {
  kind: 'expense' | 'payment' | 'income'; id: string; icon: string | null; photoBg: string; ts: number; date: string; note: string; pocket: string;
  hue: number; tags: string[]; category: string; show: number; effect: number; after: number; fx?: string;
}
/** Every movement on an account, newest first, with the running balance after each one. */
export function acctTxns(d: Data, id: string): { list: Txn[]; opening: number; card: boolean } {
  const a = d.accounts.find(x => x.id === id);
  if (!a) return { list: [], opening: 0, card: false };
  const card = a.type === 'card';
  const items: Txn[] = [
    ...d.expenses.filter(e => e.a === id).map(e => {
      const p = d.pockets.find(x => x.id === e.p);
      return {
        kind: 'expense' as const, id: e.id, icon: p ? (p.photo ? '' : p.emoji || p.name.charAt(0).toUpperCase()) : null,
        photoBg: p && p.photo ? `url(${p.photo})` : 'none', ts: e.ts, date: e.date, note: e.note, pocket: p ? p.name : '',
        hue: p ? p.hue : a.hue, tags: e.tags || [], category: catOf(e)[0], show: -e.amt, effect: card ? e.amt : -e.amt, after: 0, fx: fxText(e.orig)
      };
    }),
    ...(d.incomes || []).filter(t => t.a === id).map(t => ({
      kind: 'income' as const, id: t.id, icon: '💰', photoBg: 'none', ts: t.ts, date: t.date, note: t.note, pocket: 'Income',
      hue: 150, tags: [], category: 'Income', show: t.amt, effect: card ? -t.amt : t.amt, after: 0, fx: fxText(t.orig)
    })),
    ...d.payments.filter(p => p.from === id || p.to === id).map(p => {
      const out = p.from === id, other = d.accounts.find(x => x.id === (out ? p.to : p.from));
      if (p.cdt) {
        const bank = d.investments.cdts?.find(c => c.id === p.cdt)?.bank ?? '';
        return {
          kind: 'payment' as const, id: p.id, icon: null, photoBg: 'none', ts: p.ts, date: p.date,
          note: out ? `Opened CDT · ${bank}` : `CDT returned · ${bank}`, pocket: 'CDT', hue: 175, tags: [], category: 'CDT',
          show: out ? -p.amt : p.amt, effect: (out ? -p.amt : p.amt) * (card ? -1 : 1), after: 0
        };
      }
      if (p.fund) {
        const name = d.investments.funds?.find(f => f.id === p.fund)?.name ?? 'fund';
        return {
          kind: 'payment' as const, id: p.id, icon: null, photoBg: 'none', ts: p.ts, date: p.date,
          note: out ? `Added to ${name}` : `Withdrawn from ${name}`, pocket: 'Investment fund', hue: 230, tags: [], category: 'Investment fund',
          show: out ? -p.amt : p.amt, effect: (out ? -p.amt : p.amt) * (card ? -1 : 1), after: 0
        };
      }
      return {
        kind: 'payment' as const, id: p.id, icon: null, photoBg: 'none', ts: p.ts, date: p.date,
        note: out ? `Payment to ${other ? other.name : 'card'}` : `Payment from ${other ? other.name : 'account'}`,
        pocket: 'Card payment', hue: 150, tags: [], category: 'Card payment', show: out ? -p.amt : p.amt, effect: -p.amt, after: 0
      };
    })
  ].sort(byDateDesc);
  let bal = a.bal;
  items.forEach(t => { t.after = bal; bal -= t.effect; });
  return { list: items, opening: bal, card };
}

/** Apply an expense's effect on the paying account (cards owe more, others hold less). */
export const chargeAccount = (accts: Account[], acctId: string, amt: number) =>
  accts.map(a => (a.id === acctId ? { ...a, bal: a.type === 'card' ? a.bal + amt : a.bal - amt } : a));

export const initialOf = (s: string) => s.trim().charAt(0).toUpperCase() || '·';
export const photoBg = (p?: string | null) => (p ? `url(${p})` : 'none');
export const plural = (n: number, one: string, many = one + 's') => (n === 1 ? `1 ${one}` : `${n} ${many}`);
