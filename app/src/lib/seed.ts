import type { Data, Expense } from './types';
import { CATS, MERCHANT_CAT, POCKET_CAT } from './constants';
import { addDays, daysInMonth, prevMonthKey, todayISO } from './dates';

/** ~60 sample transactions spread over the previous calendar month. */
function makeHistory(month: string): Expense[] {
  let seed = 20261031;
  const r = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const M: Record<string, [string, number, number][]> = {
    groc: [['Éxito', 60000, 220000], ['D1', 25000, 90000], ['Carulla', 80000, 260000], ['Ara', 20000, 70000], ['Olímpica', 40000, 150000]],
    trans: [['Uber', 12000, 38000], ['DiDi', 9000, 30000], ['Terpel gas', 80000, 160000], ['Cabify', 15000, 40000], ['TuLlave recarga', 20000, 50000]],
    dine: [['Rappi', 28000, 75000], ['Crepes & Waffles', 45000, 120000], ['Juan Valdez', 9000, 22000], ['El Corral', 30000, 65000], ['Frisby', 25000, 55000], ['Starbucks', 14000, 28000]],
    fun: [['Cine Colombia', 18000, 52000], ['Andrés DC', 120000, 260000], ['Steam', 30000, 90000], ['TuBoleta', 80000, 220000], ['Bolera', 40000, 90000]],
    care: [['Farmatodo', 15000, 85000], ['Cruz Verde', 12000, 60000], ['Peluquería', 35000, 70000], ['Sephora', 60000, 180000]]
  };
  const TAGS: Record<string, string[]> = { groc: ['home'], trans: ['work', 'night out'], dine: ['friends', 'date', 'work'], fun: ['friends', 'date', 'night out'], care: [] };
  const W: Record<string, number> = { groc: 3, trans: 3, dine: 4, fun: 2, care: 1 };
  const pockets = Object.keys(W).flatMap(k => Array(W[k]).fill(k) as string[]);
  const accts = ['c1', 'c1', 'c1', 'c1', 'c2', 'c2', 'c2', 'a1', 'a1', 'a3'];
  const out: Expense[] = [];
  let ts = 1000;
  for (let d = daysInMonth(month); d >= 1; d--) {
    const n = 1 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const p = pick(pockets), [m, lo, hi] = pick(M[p]);
      const amt = Math.round((lo + r() * (hi - lo)) / 100) * 100;
      const tags = TAGS[p].length && r() < 0.45 ? [pick(TAGS[p])] : [];
      const [cat, sub] = MERCHANT_CAT[m] || POCKET_CAT[p];
      out.push({ id: 'h' + ts, ts: ts--, p, a: pick(accts), amt, note: m, date: `${month}-${String(d).padStart(2, '0')}`, tags, cat, sub });
    }
  }
  return out;
}

export function sampleData(today = todayISO()): Data {
  const prev = prevMonthKey(today.slice(0, 7));
  const now = Date.now();
  return {
    version: 1,
    settings: { name: 'Sofía', currency: 'COP', weeks: 4, voiceLang: 'es-CO', profilePhoto: null },
    incomeStr: '4800000',
    pockets: [
      { id: 'groc', name: 'Groceries', emoji: '🛒', weeklyStr: '350000', hue: 150 },
      { id: 'trans', name: 'Transport', emoji: '🚌', weeklyStr: '120000', hue: 250 },
      { id: 'dine', name: 'Eating out', emoji: '🍽️', weeklyStr: '200000', hue: 25 },
      { id: 'fun', name: 'Fun', emoji: '🎟️', weeklyStr: '150000', hue: 300 },
      { id: 'care', name: 'Personal care', emoji: '🧴', weeklyStr: '80000', hue: 80 }
    ],
    accounts: [
      { id: 'a1', name: 'Bancolombia', kind: 'Checking', type: 'bank', bal: 3250000, hue: 80 },
      { id: 'a2', name: 'Nu Cajita', kind: 'Savings', type: 'savings', bal: 6800000, hue: 300 },
      { id: 'a3', name: 'Cash', kind: 'Wallet', type: 'cash', bal: 180000, hue: 150 },
      { id: 'c1', name: 'Visa Gold', kind: 'Credit card', type: 'card', bal: 1240000, limit: 5000000, due: 'Nov 15', hue: 250 },
      { id: 'c2', name: 'Mastercard Black', kind: 'Credit card', type: 'card', bal: 420000, limit: 3000000, due: 'Nov 22', hue: 25 }
    ],
    expenses: [
      { id: 'e4', ts: now + 4, p: 'dine', a: 'c1', amt: 72000, note: 'Lunch with Ana', date: today, tags: ['friends'], cat: 'Food & dining', sub: 'Restaurants' },
      { id: 'e3', ts: now + 3, p: 'groc', a: 'a1', amt: 165000, note: 'Market run', date: addDays(today, -1), tags: ['home'], cat: 'Groceries', sub: 'Supermarket' },
      { id: 'e2', ts: now + 2, p: 'trans', a: 'a3', amt: 48000, note: 'Taxi home', date: addDays(today, -1), tags: ['night out'], cat: 'Transport', sub: 'Ride apps' },
      { id: 'e1', ts: now + 1, p: 'fun', a: 'c2', amt: 38000, note: 'Cinema', date: addDays(today, -2), tags: ['friends', 'date'], cat: 'Entertainment', sub: 'Movies' },
      ...makeHistory(prev)
    ],
    moves: [],
    payments: [
      { id: 's2', ts: 2, from: 'a1', to: 'c1', amt: 1800000, date: `${prev}-15` },
      { id: 's3', ts: 3, from: 'a1', to: 'c2', amt: 900000, date: `${prev}-22` }
    ],
    bills: [
      { id: 'b1', name: 'Netflix', kind: 'Subscription', amt: 44900, dueDay: 8, hue: 25, paidMonths: [] },
      { id: 'b2', name: 'Spotify', kind: 'Subscription', amt: 16900, dueDay: 12, hue: 150, paidMonths: [] },
      { id: 'b3', name: 'Internet', kind: 'Bill', amt: 95000, dueDay: 18, hue: 250, paidMonths: [] },
      { id: 'b4', name: 'Phone plan', kind: 'Bill', amt: 55000, dueDay: 20, hue: 80, paidMonths: [] },
      { id: 'b5', name: 'Rent', kind: 'Bill', amt: 1400000, dueDay: 30, hue: 300, paidMonths: [] }
    ],
    goals: [
      { id: 'g1', name: 'Trip to Cartagena', saved: 1200000, target: 3000000, months: 4, hue: 195 },
      { id: 'g2', name: 'Emergency fund', saved: 4500000, target: 10000000, months: 14, hue: 150 }
    ],
    cats: CATS.map(c => ({ ...c, subs: [...c.subs] })),
    tags: ['friends', 'home', 'date', 'night out', 'work']
  };
}

export function emptyData(prev: Data): Data {
  return {
    version: 1,
    settings: { ...prev.settings },
    incomeStr: '0',
    pockets: [], accounts: [], expenses: [], moves: [], payments: [], bills: [], goals: [],
    cats: CATS.map(c => ({ ...c, subs: [...c.subs] })), tags: []
  };
}
