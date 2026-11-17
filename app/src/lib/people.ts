// Friends & trips, people first: one entry per person, adding up the debts with them and their part of each trip's
// settle-up plan. A person is a friend's account id when there is one, otherwise their name (Mamá, a trip guest).
import type { Data, Debt } from './types';
import type { Dm, Friend, Trip } from './social';
import { balances, settleUp, type TripItem } from './settle';
import { isOpen, leftOf } from './debts';

const EPS = 0.004;
/** + they pay you, − you pay them (from the trip's fewest-payments plan). */
export interface PersonTrip { trip: Trip; amount: number }
export interface Person {
  key: string; name: string; uid?: string; friend?: Friend; dm?: Dm;
  /** Every debt with them, open and paid back. */ debts: Debt[];
  trips: PersonTrip[];
  /** + they owe you, − you owe them: open debts plus trips. */ net: number;
}
export interface PeopleSource { friends: Friend[]; trips: Trip[]; items: Record<string, TripItem[]>; dms: Dm[] }

export const personKey = (uid: string | undefined, name: string) => (uid ? uid : `n:${name.trim().toLocaleLowerCase()}`);

export function peopleOf(d: Data, s: PeopleSource, me: string, scale = 1): Person[] {
  const map = new Map<string, Person>();
  const get = (uid: string | undefined, name: string) => {
    const key = personKey(uid, name);
    let p = map.get(key);
    if (!p) { p = { key, name: name.trim() || 'Someone', uid, debts: [], trips: [], net: 0 }; map.set(key, p); }
    return p;
  };
  // Friends first, so their own name wins over what a debt or a trip calls them.
  // Requests you haven't answered show above the list, not in it.
  for (const f of s.friends) if (f.uid && f.uid !== me && !(f.status === 'pending' && f.incoming)) Object.assign(get(f.uid, f.name), { friend: f, name: f.name });
  for (const x of d.debts ?? []) {
    const p = get(x.friend, x.name);
    p.debts.push(x);
    if (isOpen(x)) p.net += x.dir === 'owed' ? leftOf(x) : -leftOf(x);
  }
  for (const t of s.trips) {
    if (!t.members.includes(me)) continue;
    const members = [...t.members.map(id => ({ id, name: t.names[id] ?? 'Friend' })), ...t.guests];
    const nameOf = (id: string) => members.find(m => m.id === id)?.name ?? 'Someone';
    for (const pay of settleUp(balances(members, s.items[t.id] ?? [], scale), scale)) {
      const other = pay.to === me ? pay.from : pay.from === me ? pay.to : null;
      if (!other) continue;
      const amount = pay.to === me ? pay.amount : -pay.amount;
      const p = get(other.startsWith('g:') ? undefined : other, nameOf(other));
      p.trips.push({ trip: t, amount });
      p.net += amount;
    }
  }
  for (const dm of s.dms) if (dm.other !== me) get(dm.other, dm.name).dm = dm;
  for (const p of map.values()) p.net = Math.round(p.net * 100) / 100;
  // Money first (biggest either way), then everyone else by name.
  return [...map.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.name.localeCompare(b.name));
}

export const isEven = (v: number) => Math.abs(v) <= EPS;
