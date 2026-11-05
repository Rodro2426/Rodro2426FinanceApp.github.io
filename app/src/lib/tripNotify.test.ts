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
