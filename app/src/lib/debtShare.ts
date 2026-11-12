// Shared debts between two friends who both use Pockets.
// When you save a debt with a friend, a copy goes to Firestore (`debts/{id}`) as a request. The friend sees it,
// accepts (it appears on their phone, from their side) or declines. After that, changes to the amount, dates, note
// or payments made by either person reach the other the next time their app syncs (the newest change wins).
// Safety rules (see docs/security-review.md, "Shared debts"):
// - Accounts stay private: the shared copy never says which account the money left or arrived in.
// - A friend's change never moves your account balances: payments you recorded on an account keep your version,
//   and if they change the amount of a debt linked to your account, the link is dropped (the money that moved stays).
// - Nothing is deleted from the cloud just because this phone doesn't have it (a new phone may still be downloading);
//   the shared copy is removed only when you delete the debt yourself (lib/social.ts, unshareDebt).
// - Values from the cloud are checked before use (a broken or huge copy is ignored).
// This file only decides what has to change; lib/social.ts reads and writes Firestore.
import type { Debt, DebtPay } from './types';

export interface DebtDoc {
  id: string;
  /** The two account ids, sorted (so `users[0]_users[1]` is their friendship id). */
  users: string[];
  /** Who created it (the one who sent the request). */
  from: string;
  owedBy: string; owedTo: string;
  names: Record<string, string>;
  amt: number; date: string; due: string | null; note: string | null;
  pays: { id: string; ts: number; amt: number; date: string }[];
  status: 'pending' | 'accepted' | 'declined';
  createdAt: number; updatedAt: number;
}

const MAX_AMT = 1e11;
const okAmt = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= MAX_AMT;
const okDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const text = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');

/** A copy from the cloud with everything checked, or null if it's broken (then it's ignored). */
export function cleanDoc(raw: Partial<DebtDoc> & { id: string }): DebtDoc | null {
  const users = Array.isArray(raw.users) ? raw.users.filter((u): u is string => typeof u === 'string') : [];
  if (users.length !== 2 || !okAmt(raw.amt) || !okDate(raw.date) || typeof raw.from !== 'string' || !users.includes(raw.from)) return null;
  if (typeof raw.owedBy !== 'string' || typeof raw.owedTo !== 'string' || !users.includes(raw.owedBy) || !users.includes(raw.owedTo) || raw.owedBy === raw.owedTo) return null;
  const status = raw.status === 'accepted' || raw.status === 'declined' ? raw.status : raw.status === 'pending' ? 'pending' : null;
  if (!status) return null;
  const names: Record<string, string> = {};
  for (const u of users) names[u] = text(raw.names && typeof raw.names === 'object' ? (raw.names as Record<string, unknown>)[u] : '', 60) || 'Friend';
  const pays = (Array.isArray(raw.pays) ? raw.pays : []).slice(0, 200)
    .filter(p => p && typeof p.id === 'string' && okAmt(p.amt) && okDate(p.date))
    .map(p => ({ id: p.id.slice(0, 40), ts: typeof p.ts === 'number' ? p.ts : 0, amt: p.amt, date: p.date }));
  return {
    id: raw.id, users: [...users].sort(), from: raw.from, owedBy: raw.owedBy, owedTo: raw.owedTo, names,
    amt: raw.amt, date: raw.date, due: okDate(raw.due) ? raw.due : null, note: text(raw.note, 300) || null, pays, status,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : 0, updatedAt: typeof raw.updatedAt === 'number' ? raw.updatedAt : 0
  };
}

/** What both people share about a debt (no accounts). */
export const sharedFields = (x: Debt, me: string) => ({
  owedBy: x.dir === 'owe' ? me : x.friend!, owedTo: x.dir === 'owe' ? x.friend! : me,
  amt: x.amt, date: x.date, due: x.due ?? null, note: x.note ? x.note.slice(0, 300) : null,
  pays: x.pays.slice(0, 200).map(p => ({ id: p.id, ts: p.ts, amt: p.amt, date: p.date }))
});
const docFields = (o: DebtDoc) => ({ owedBy: o.owedBy, owedTo: o.owedTo, amt: o.amt, date: o.date, due: o.due ?? null, note: o.note ?? null, pays: o.pays.map(p => ({ id: p.id, ts: p.ts, amt: p.amt, date: p.date })) });
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * A new request for a debt you just saved with a friend. The friend's name is their own Pockets name, not the
 * nickname you may have typed (that stays on your phone).
 */
export function newDebtDoc(x: Debt, me: string, myName: string, friendName: string, now: number): DebtDoc {
  const other = x.friend!;
  return {
    id: x.id, users: [me, other].sort(), from: me, names: { [me]: myName.slice(0, 60), [other]: friendName.slice(0, 60) },
    ...sharedFields(x, me), status: 'pending', createdAt: now, updatedAt: now
  };
}

/** Your side of a debt someone sent you (when you accept it): no account, so your balances don't move. */
export function debtFromDoc(o: DebtDoc, me: string, now: number): Debt {
  const other = o.users.find(u => u !== me) ?? o.from;
  return {
    id: o.id, ts: o.createdAt || now, dir: o.owedBy === me ? 'owe' : 'owed', name: o.names[other] ?? 'Friend', friend: other,
    amt: o.amt, date: o.date, due: o.due ?? undefined, note: o.note ?? undefined,
    pays: o.pays.map(p => ({ ...p })), share: 'accepted', sync: now
  };
}

/**
 * Takes the shared copy's newer values without moving your accounts:
 * - payments you recorded on one of your accounts keep your version;
 * - their new payments arrive without an account;
 * - if the amount changes on a debt linked to your account, the link is dropped (the money that moved stays moved).
 */
function pull(x: Debt, o: DebtDoc): Debt {
  const mineWithAcct = x.pays.filter(p => p.acct);
  const keep = new Set(mineWithAcct.map(p => p.id));
  const pays: DebtPay[] = [...mineWithAcct, ...o.pays.filter(p => !keep.has(p.id)).map(p => ({ ...p }))].sort((a, b) => a.ts - b.ts);
  const acct = x.acct && o.amt !== x.amt ? undefined : x.acct;
  return { ...x, amt: o.amt, date: o.date, due: o.due ?? undefined, note: o.note ?? undefined, pays, acct, share: o.status, sync: o.updatedAt };
}

export interface DebtSyncPlan {
  /** Your debts to replace as they are (never moving account balances). */
  local: Debt[];
  creates: DebtDoc[];
  updates: { id: string; fields: ReturnType<typeof sharedFields> }[];
  /** Debts friends sent you, waiting for Accept or Decline. */
  requests: DebtDoc[];
}

/**
 * Compares your debts with the shared copies and decides what to send and what to take.
 * `friends` are your accepted friends (a request can only go to a friend).
 */
export function planDebtSync(debts: Debt[], rawDocs: (Partial<DebtDoc> & { id: string })[], me: string, myName: string, friends: { uid: string; name: string }[], now: number): DebtSyncPlan {
  const plan: DebtSyncPlan = { local: [], creates: [], updates: [], requests: [] };
  const docs = rawDocs.map(cleanDoc).filter((o): o is DebtDoc => !!o && o.users.includes(me));
  const byId = new Map(docs.map(o => [o.id, o]));
  for (const x of debts) {
    if (!x.friend || x.friend === me) continue;
    const o = byId.get(x.id);
    if (!o) {
      const f = friends.find(y => y.uid === x.friend);
      if (!x.share && f && okAmt(x.amt) && okDate(x.date)) {
        plan.creates.push(newDebtDoc(x, me, myName, f.name, now));
        plan.local.push({ ...x, share: 'pending', sync: now });
      } else if (x.share === 'pending' || x.share === 'accepted') plan.local.push({ ...x, share: 'gone' });
      continue;
    }
    const mine = sharedFields(x, me), theirs = docFields(o);
    if (!same(mine, theirs)) {
      if (o.updatedAt > (x.sync ?? 0)) plan.local.push(pull(x, o));
      else if (mine.owedBy === o.owedBy) { plan.updates.push({ id: x.id, fields: mine }); plan.local.push({ ...x, share: o.status, sync: now }); }
      // (Who owes whom can't change once shared; the form doesn't allow it.)
    } else if (x.share !== o.status || (x.sync ?? 0) < o.updatedAt) plan.local.push({ ...x, share: o.status, sync: o.updatedAt });
  }
  const mineIds = new Set(debts.map(x => x.id));
  for (const o of docs) if (!mineIds.has(o.id) && o.from !== me && o.status === 'pending') plan.requests.push(o);
  return plan;
}
