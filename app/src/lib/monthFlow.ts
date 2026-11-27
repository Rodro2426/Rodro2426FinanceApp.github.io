import type { Data, Move } from './types';
import { addDays, ctxAt, iso, monthKey } from './dates';
import { moveInPeriod, periodAt, pocketStats } from './derive';

/** How money crossed from one period to the next. */
export interface Link {
  /** next: leftover sent on by hand · borrow: an overspend taken from the next period · auto: carry over did it ·
   *  idle: money was left and nothing moved it · uncovered: overspent and nothing covered it. */
  kind: 'next' | 'borrow' | 'auto' | 'idle' | 'uncovered';
  amt: number;
  move?: Move;
}
export interface PeriodRow {
  from: string; to: string; state: 'past' | 'now' | 'future';
  /** The period's own budget. */
  base: number;
  /** Carry over (automatic) arriving from before. */
  carry: number;
  /** Sent on by hand from the period before. */
  fromPrev: number;
  /** Taken from this period to cover the one before. */
  repaid: number;
  /** Other pocket moves in and out (transfers, income splits). */
  otherIn: number; otherOut: number;
  /** What the period had to spend, what it spent, and what was left (negative = over) before any of its own moves on. */
  budget: number; spent: number; result: number;
  /** What's left after its own moves on (what carry over takes along). */
  left: number;
  /** What happened between this period and the next one. */
  links: Link[];
}

const sum = (ms: Move[]) => ms.reduce((a, m) => a + m.amt, 0);

/** A pocket's month, period by period (each week, cut on the 1st and the last day so it stays in the month; each quincena; or the month). */
export function monthFlow(d: Data, id: string, month: string, today: string): PeriodRow[] {
  const p = d.pockets.find(x => x.id === id);
  if (!p) return [];
  const starts: string[] = [];
  let s = month + '-01';
  // Periods that ended before the pocket existed are left out (same rule as monthAhead): nothing could be left in them.
  // shortcut: the creation day is read from the id (uid = prefix + Date.now in base 36); older ids are skipped.
  const born = Number.parseInt(p.id.slice(1, 9), 36), bornDay = born > 1.6e12 && born < 4e12 ? iso(new Date(born)) : '';
  const since = p.start?.from && p.start.from > bornDay ? p.start.from : bornDay;
  for (let k = 0; monthKey(s) === month && k < 7; k++) { if (periodAt(p, s)[1] >= since) starts.push(s); s = addDays(periodAt(p, s)[1], 1); }
  if (!starts.length) return [];
  const mine = d.moves.filter(m => m.from === id && m.to === id);
  const madeIn = (end: string) => { const c = ctxAt(end); return mine.filter(m => moveInPeriod(m, p, c)); };
  const prevEnd = addDays(starts[0], -1);
  let before = madeIn(prevEnd);
  return starts.map(start => {
    const [from, to] = periodAt(p, start);
    const st = pocketStats(d, id, ctxAt(to))!;
    const own = madeIn(to);
    const nextOut = sum(own.filter(m => m.next)), borrowIn = sum(own.filter(m => m.borrow));
    const fromPrev = sum(before.filter(m => m.next)), repaid = sum(before.filter(m => m.borrow));
    before = own;
    const budget = st.budget + nextOut - borrowIn;
    const result = budget - st.spent;
    const state = to < today ? 'past' : from > today ? 'future' : 'now';
    const links: Link[] = own.map(m => ({ kind: m.next ? 'next' : 'borrow', amt: m.amt, move: m }));
    // What's still left after its own moves on: carry over takes it along, otherwise it just stays (or stays uncovered).
    if (state === 'past' && Math.abs(st.left) > 0.004) {
      if (p.carry && start >= periodAt(p, p.carry)[0]) links.push({ kind: 'auto', amt: st.left });
      else links.push({ kind: st.left > 0 ? 'idle' : 'uncovered', amt: Math.abs(st.left) });
    }
    return {
      from, to, state, base: st.weekly, carry: st.carry, fromPrev, repaid,
      otherIn: st.mIn - borrowIn - fromPrev, otherOut: st.mOut - nextOut - repaid,
      budget, spent: st.spent, result, left: st.left, links
    };
  });
}
