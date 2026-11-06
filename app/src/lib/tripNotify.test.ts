import { describe, expect, it } from 'vitest';
import { tripNotifs } from './tripNotify';
import type { Trip } from './social';

const trip: Trip = { id: 't1', name: 'Cartagena', emoji: '🏖️', owner: 'me', members: ['me', 'ana', 'juan'], guests: [], names: { me: 'Santi', ana: 'Ana', juan: 'Juan' }, createdAt: 0, updatedAt: 0 };
const exp = { id: 'e1', kind: 'expense' as const, desc: 'Dinner', amount: 300000, date: '2026-11-05', createdBy: 'ana', createdAt: 1, paidBy: 'ana', split: { mode: 'equal' as const, among: ['me', 'ana', 'juan'] } };
const pay = { id: 'p1', kind: 'payment' as const, desc: 'Payment', amount: 50000, date: '2026-11-05', createdBy: 'juan', createdAt: 2, paidBy: 'juan', to: 'me' };
const msg = (id: string, text: string) => ({ id, uid: 'ana', name: 'Ana', text, createdAt: 3 });

describe('trip notifications', () => {
  it('describes expenses with your share, and payments to you', () => {
    const n = tripNotifs([{ trip, items: [exp, pay], messages: [] }], 'me', '2026-11-05', []);
    expect(n.map(x => x.body)).toEqual(['Ana added Dinner · $300.000 · your share $100.000', 'Juan paid you $50.000']);
    expect(n[0].link).toEqual({ trip: 't1', item: 'e1' });
    expect(n[0].title).toBe('🏖️ Cartagena');
  });
  it('groups messages into one notification per trip per day and keeps counting', () => {
    const first = tripNotifs([{ trip, items: [], messages: [msg('m1', 'Hola')] }], 'me', '2026-11-05', []);
    expect(first).toHaveLength(1);
    expect(first[0].body).toBe('Ana: Hola');
    expect(first[0].link).toEqual({ trip: 't1', chat: true });
    const next = tripNotifs([{ trip, items: [], messages: [msg('m2', 'Ya llegué'), msg('m3', 'Dónde están?')] }], 'me', '2026-11-05', first);
    expect(next[0].id).toBe(first[0].id);
    expect(next[0].body).toBe('3 new messages · Ana: Dónde están?');
  });
});

describe('being added to a trip', () => {
  it('says so and opens the trip', () => {
    const n = tripNotifs([{ trip, items: [], messages: [], joined: true }], 'me', '2026-11-05', []);
    expect(n[0].body).toMatch(/^You were added to this trip · 3 people/);
    expect(n[0].link).toEqual({ trip: 't1' });
  });
});

describe('photo and GIF messages', () => {
  it('says what was sent', () => {
    const photo = { id: 'p', uid: 'ana', name: 'Ana', text: '', createdAt: 5, img: { thumb: 'x', w: 1, h: 1 } };
    const gif = { id: 'g', uid: 'ana', name: 'Ana', text: '', createdAt: 6, gif: { url: 'u', w: 1, h: 1 } };
    expect(tripNotifs([{ trip, items: [], messages: [photo] }], 'me', '2026-11-05', [])[0].body).toBe('Ana sent a photo');
    expect(tripNotifs([{ trip, items: [], messages: [gif] }], 'me', '2026-11-05', [])[0].body).toBe('Ana sent a GIF');
    expect(tripNotifs([{ trip, items: [], messages: [{ ...photo, text: 'La playa!' }] }], 'me', '2026-11-05', [])[0].body).toBe('Ana: 📷 La playa!');
  });
});

import { dmNotifs } from './tripNotify';
describe('direct message notifications', () => {
  const dm = { key: 'dm:ana_me', other: 'ana', name: 'Ana', updatedAt: 3 };
  it('one per friend per day, counting up, opening the conversation', () => {
    const first = dmNotifs([{ dm, messages: [{ id: 'a', uid: 'ana', name: 'Ana', text: 'Hola!', createdAt: 1 }] }], '2026-11-06', []);
    expect(first[0]).toMatchObject({ id: 'dm:ana:2026-11-06', kind: 'dm', title: 'Ana', body: 'Hola!', link: { dm: 'ana' } });
    const next = dmNotifs([{ dm, messages: [{ id: 'b', uid: 'ana', name: 'Ana', text: '', createdAt: 2, img: { thumb: 'x', w: 1, h: 1 } }] }], '2026-11-06', first);
    expect(next[0].body).toBe('2 new messages · Sent a photo');
  });
});
