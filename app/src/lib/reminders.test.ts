import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { emptyData, sampleData } from './seed';
import { upcomingReminders } from './reminders';
import type { Data } from './types';

describe('reminders for lock-screen notifications', () => {
  const base = (): Data => {
    const e = emptyData(sampleData());
    return { ...e, accounts: [{ id: 'bank', name: 'Bancolombia', kind: 'Checking', type: 'bank', bal: 500000, hue: 85 }],
      bills: [{ id: 'nf', name: 'Netflix', kind: 'Subscription', amt: 44900, dueDay: 20, hue: 0, paidMonths: [], acct: 'bank', auto: true }] };
  };
  it('the day before a bill is due, at 9:00', () => {
    const r = upcomingReminders(base(), '2026-11-06').filter(x => x.tag.startsWith('soon:nf'));
    expect(r[0].title).toBe('Netflix is due tomorrow');
    expect(r[0].body).toContain('paid automatically from Bancolombia');
    const at = new Date(r[0].at);
    expect([at.getDate(), at.getHours(), at.getMinutes()]).toEqual([19, 9, 0]);
    expect(r[0].url).toBe('#calendar');
  });
  it('skips months already paid or skipped', () => {
    const d = base(); d.bills[0].paidMonths = ['2026-11'];
    expect(upcomingReminders(d, '2026-11-06').filter(x => x.tag === 'soon:nf:2026-11-20')).toHaveLength(0);
    expect(upcomingReminders(d, '2026-11-06', 50).some(x => x.tag === 'soon:nf:2026-12-20')).toBe(true);
  });
  it('credit card due dates and the monthly backup', () => {
    const d = base(); d.accounts.push({ id: 'v', name: 'Visa', kind: 'Credit', type: 'card', bal: 120000, limit: 1e6, due: 'Nov 25', hue: 250 });
    d.expenses = [{ id: 'e', ts: 1, p: '', a: 'bank', amt: 1, note: 'x', date: '2026-11-01', tags: [], cat: 'Other', sub: '' }] as Data['expenses'];
    const r = upcomingReminders(d, '2026-11-06');
    expect(r.find(x => x.tag === 'card:v:2026-11-25')?.title).toBe('Visa payment is due tomorrow');
    expect(r.some(x => x.tag.startsWith('backup:'))).toBe(true);
  });
  it('on the day, at 8:00: charged, arriving, paid by someone else, card payments', () => {
    const d = base();
    d.accounts.push({ id: 'rc', name: 'RappiCard', kind: 'Credit', type: 'card', bal: 200000, limit: 1e6, hue: 25 });
    d.bills.push({ id: 'sal', name: 'Salary', kind: 'Income', amt: 1100000, dueDay: 2, hue: 150, paidMonths: [], acct: 'bank', auto: true },
      { id: 'rp', name: 'Rappi pro', kind: 'Subscription', amt: 25000, dueDay: 4, hue: 50, paidMonths: [], notMine: true },
      { id: 'cp', name: 'Card', kind: 'CardPayment', amt: 0, dueDay: 15, hue: 0, paidMonths: [], acct: 'bank', toCard: 'rc', auto: true } as Data['bills'][number]);
    const r = upcomingReminders(d, '2026-11-06', 35).filter(x => x.tag.startsWith('day:'));
    const by = (id: string) => r.find(x => x.tag.startsWith(`day:${id}:`))!;
    expect(by('nf')).toMatchObject({ title: 'Netflix is charged today', body: '−$44.900 from Bancolombia.' });
    expect(by('sal')).toMatchObject({ title: '💰 Salary arrives today', body: '+$1.100.000 to Bancolombia.' });
    expect(by('rp')).toMatchObject({ title: 'Rappi pro is due today', body: '$25.000, paid by someone else.' });
    expect(by('cp')).toMatchObject({ title: 'RappiCard payment is today', body: 'The full balance, from Bancolombia.' });
    const t = new Date(by('nf').at);
    expect([t.getDate(), t.getHours()]).toEqual([20, 8]);
  });
  it('each event can pick its own times, or turn one off', () => {
    const d = base(); d.bills[0].notify = { before: '20:30', day: null };
    const r = upcomingReminders(d, '2026-11-06').filter(x => x.tag.includes(':nf:'));
    expect(r.map(x => x.tag.split(':')[0])).toEqual(['soon']);
    const t = new Date(r[0].at);
    expect([t.getDate(), t.getHours(), t.getMinutes()]).toEqual([19, 20, 30]);
  });
});
