import { describe, expect, it } from 'vitest';
import type { Data, Debt } from './types';
import type { Friend, Trip } from './social';
import type { TripItem } from './settle';
import { peopleOf } from './people';

const debt = (p: Partial<Debt>): Debt => ({ id: Math.random().toString(36), ts: 1, dir: 'owed', name: 'Juan', amt: 100, date: '2026-11-01', pays: [], ...p });
const data = (debts: Debt[]) => ({ debts } as unknown as Data);
const friend = (uid: string, name: string, status: Friend['status'] = 'accepted'): Friend => ({ uid, name, email: '', status, incoming: false, id: `f-${uid}` });
const trip: Trip = { id: 't', name: 'Cartagena', emoji: '✈️', owner: 'me', members: ['me', 'juan', 'laura'], guests: [{ id: 'g:1', name: 'Mamá' }], names: { me: 'Me', juan: 'Juan', laura: 'Laura' }, createdAt: 0, updatedAt: 0 };
// I paid 400 for four people: each owes me 100.
const items: TripItem[] = [{ id: 'i', kind: 'expense', desc: 'Hotel', amount: 400, date: '2026-11-02', createdBy: 'me', createdAt: 0, paidBy: 'me', split: { mode: 'equal', among: ['me', 'juan', 'laura', 'g:1'] } }];
const src = (p: Partial<{ friends: Friend[]; trips: Trip[] }> = {}) => ({ friends: [], trips: [], items: { t: items }, dms: [], ...p });

describe('peopleOf', () => {
  it('adds a friend\'s debts and their part of a trip into one number', () => {
    const ps = peopleOf(data([debt({ friend: 'juan', amt: 78 })]), src({ friends: [friend('juan', 'Juan')], trips: [trip] }), 'me');
    const juan = ps.find(p => p.key === 'juan')!;
    expect(juan.net).toBe(178);
    expect(juan.debts).toHaveLength(1);
    expect(juan.trips).toEqual([{ trip, amount: 100 }]);
  });

  it('puts a trip guest and a debt with the same name together, and counts what you owe as negative', () => {
    const ps = peopleOf(data([debt({ name: 'mamá ', dir: 'owe', amt: 300 })]), src({ trips: [trip] }), 'me');
    const mama = ps.filter(p => p.key === 'n:mamá');
    expect(mama).toHaveLength(1);
    expect(mama[0].net).toBe(-200);
  });

  it('leaves paid-back debts out of the number but keeps them, and keeps friends with nothing open', () => {
    const ps = peopleOf(data([debt({ friend: 'laura', name: 'Laura', amt: 50, pays: [{ id: 'p', ts: 1, date: '2026-11-03', amt: 50 }] })]), src({ friends: [friend('laura', 'Laura'), friend('santi', 'Santi')] }), 'me');
    expect(ps.map(p => [p.name, p.net, p.debts.length])).toEqual([['Laura', 0, 1], ['Santi', 0, 0]]);
  });

  it('sorts the biggest money first, either way', () => {
    const ps = peopleOf(data([debt({ name: 'A', amt: 10 }), debt({ name: 'B', dir: 'owe', amt: 500 })]), src(), 'me');
    expect(ps.map(p => p.name)).toEqual(['B', 'A']);
  });

  it('leaves out friend requests you have not answered', () => {
    expect(peopleOf(data([]), src({ friends: [{ ...friend('cami', 'Camilo', 'pending'), incoming: true }] }), 'me')).toEqual([]);
  });

  it('skips trips you are not in', () => {
    expect(peopleOf(data([]), src({ trips: [{ ...trip, members: ['juan', 'laura'] }] }), 'me')).toEqual([]);
  });
});
