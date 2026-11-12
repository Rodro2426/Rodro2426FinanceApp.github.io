import { describe, expect, it } from 'vitest';
import { cleanDoc, debtFromDoc, newDebtDoc, planDebtSync, type DebtDoc } from './debtShare';
import type { Debt } from './types';

const ana = 'uAna', beto = 'uBeto';
const fAna = [{ uid: ana, name: 'Ana P.' }], fBeto = [{ uid: beto, name: 'Beto R.' }];
const lent: Debt = { id: 'debt1', ts: 1, dir: 'owed', name: 'Betico', friend: beto, amt: 50000, date: '2026-11-10', due: '2026-11-30', acct: 'nequi', note: 'Pizza', pays: [] };
const docOf = (x: Debt, status: DebtDoc['status'] = 'accepted', updatedAt = 300): DebtDoc => ({ ...newDebtDoc(x, ana, 'Ana P.', 'Beto R.', 100), status, updatedAt });

describe('shared debts', () => {
  it('sends a new debt with a friend as a request, from the right side, with their real name and no accounts', () => {
    const p = planDebtSync([lent], [], ana, 'Ana P.', fBeto, 100);
    expect(p.creates).toHaveLength(1);
    const o = p.creates[0];
    expect(o).toMatchObject({ id: 'debt1', from: ana, owedBy: beto, owedTo: ana, amt: 50000, status: 'pending', users: [ana, beto].sort() });
    expect(o.names).toEqual({ [ana]: 'Ana P.', [beto]: 'Beto R.' });
    expect(JSON.stringify(o)).not.toContain('nequi');
    expect(JSON.stringify(o)).not.toContain('Betico');
    expect(p.local[0]).toMatchObject({ share: 'pending', sync: 100 });
  });

  it('keeps debts with people who are not friends private', () => {
    expect(planDebtSync([{ ...lent, friend: 'stranger' }], [], ana, 'Ana', fBeto, 100).creates).toHaveLength(0);
    expect(planDebtSync([{ ...lent, friend: undefined }], [], ana, 'Ana', fBeto, 100).creates).toHaveLength(0);
  });

  it('shows the friend a request, and accepting gives them their side without accounts', () => {
    const o = docOf(lent, 'pending', 100);
    const p = planDebtSync([], [o], beto, 'Beto R.', fAna, 200);
    expect(p.requests.map(r => r.id)).toEqual(['debt1']);
    const mine = debtFromDoc(o, beto, 300);
    expect(mine).toMatchObject({ dir: 'owe', name: 'Ana P.', friend: ana, amt: 50000, due: '2026-11-30', share: 'accepted', sync: 300 });
    expect(mine.acct).toBeUndefined();
  });

  it('tells the creator when the friend accepted or declined', () => {
    expect(planDebtSync([{ ...lent, share: 'pending', sync: 100 }], [docOf(lent, 'accepted', 300)], ana, 'Ana', fBeto, 400).local[0]).toMatchObject({ share: 'accepted', sync: 300 });
    expect(planDebtSync([{ ...lent, share: 'pending', sync: 100 }], [docOf(lent, 'declined', 300)], ana, 'Ana', fBeto, 400).local[0].share).toBe('declined');
    expect(planDebtSync([], [docOf(lent, 'declined', 300)], beto, 'Beto', fAna, 400).requests).toEqual([]);
  });

  it('sends your newer change and takes the other phone’s newer change', () => {
    const o = docOf(lent);
    const paid = { ...lent, share: 'accepted' as const, sync: 300, pays: [{ id: 'p1', ts: 5, amt: 20000, date: '2026-11-12', acct: 'nequi' }] };
    const push = planDebtSync([paid], [o], ana, 'Ana', fBeto, 500);
    expect(push.updates[0].fields.pays).toEqual([{ id: 'p1', ts: 5, amt: 20000, date: '2026-11-12' }]);
    const after: DebtDoc = { ...o, pays: push.updates[0].fields.pays, updatedAt: 500 };
    const pulled = planDebtSync([debtFromDoc(o, beto, 300)], [after], beto, 'Beto', fAna, 600).local[0];
    expect(pulled.pays).toEqual([{ id: 'p1', ts: 5, amt: 20000, date: '2026-11-12' }]);
    expect(pulled.sync).toBe(500);
  });

  it('never lets a friend’s edit move your accounts', () => {
    const mine = { ...lent, share: 'accepted' as const, sync: 300, pays: [{ id: 'p1', ts: 5, amt: 20000, date: '2026-11-12', acct: 'nequi' }] };
    // Beto changes the amount and the amount of Ana's own payment.
    const evil: DebtDoc = { ...docOf(lent), amt: 5000000, pays: [{ id: 'p1', ts: 5, amt: 4000000, date: '2026-11-12' }, { id: 'p2', ts: 6, amt: 1000, date: '2026-11-13' }], updatedAt: 900 };
    const got = planDebtSync([mine], [evil], ana, 'Ana', fBeto, 1000).local[0];
    expect(got.amt).toBe(5000000);
    expect(got.acct).toBeUndefined();                       // link dropped: the original 50,000 stays where it went
    expect(got.pays.find(p => p.id === 'p1')).toMatchObject({ amt: 20000, acct: 'nequi' }); // your payment keeps your version
    expect(got.pays.find(p => p.id === 'p2')?.acct).toBeUndefined();
  });

  it('ignores broken or oversized copies from the cloud', () => {
    const base = docOf(lent);
    expect(cleanDoc({ ...base, amt: 'abc' as unknown as number })).toBeNull();
    expect(cleanDoc({ ...base, owedBy: 'someoneElse' })).toBeNull();
    const big = cleanDoc({ ...base, note: 'x'.repeat(5000), names: { [ana]: { evil: 1 } as unknown as string, [beto]: 'B' }, pays: [{ id: 'q', ts: 1, amt: NaN, date: 'x' }] })!;
    expect(big.note!.length).toBe(300);
    expect(big.names[ana]).toBe('Friend');
    expect(big.pays).toEqual([]);
    expect(planDebtSync([], [{ ...base, status: 'pending', amt: -5 }], beto, 'Beto', fAna, 1).requests).toEqual([]);
  });

  it('never deletes cloud copies just because this phone doesn’t have them, and marks removed ones', () => {
    const p = planDebtSync([], [docOf(lent, 'accepted')], ana, 'Ana', fBeto, 200);
    expect(p).toMatchObject({ creates: [], updates: [], requests: [], local: [] });
    const betoSide = debtFromDoc(docOf(lent), beto, 150);
    expect(planDebtSync([betoSide], [], beto, 'Beto', fAna, 300).local[0].share).toBe('gone');
    expect(planDebtSync([{ ...betoSide, share: 'gone' }], [], beto, 'Beto', fAna, 400).creates).toHaveLength(0);
  });
});
