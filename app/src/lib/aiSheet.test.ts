import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { Data } from './types';
import { emptyData, sampleData } from './seed';
import { buildAiSheet } from './aiSheet';

describe('For AI sheet: pockets by their own period', () => {
  it('a monthly pocket shows one row for the month, with its starting amount', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 10, 24, 12));
    const e = emptyData(sampleData());
    const d: Data = { ...e, settings: { ...e.settings, currency: 'COP' }, incomeStr: '0',
      pockets: [{ id: 'g', name: 'Gastos', weeklyStr: '240000', hue: 60, period: 'month', start: { from: '2026-11-01', amt: 112000 } }],
      accounts: [{ id: 'nu', name: 'Nu', kind: 'Checking', type: 'bank', bal: 0, hue: 1 }],
      expenses: [{ id: 'x', ts: 1, p: 'g', a: 'nu', amt: 363745, note: 'x', date: '2026-11-16', tags: [], cat: 'Other', sub: '' }],
      incomes: [], moves: [], bills: [] };
    const s = buildAiSheet(d, ['2026-11'], 'all');
    const byPeriod = s.sections.find(x => x.title === 'Pocket spending by period')!;
    expect(byPeriod.rows).toHaveLength(1);
    expect(byPeriod.rows[0].slice(2)).toEqual([{ v: 112000, fmt: 'money' }, { v: 363745, fmt: 'money' }, { v: -251745, fmt: 'money' }]);
    const pockets = s.sections.find(x => x.title === 'Pockets (budgets)')!;
    expect(pockets.rows[0][1]).toBe('Every month');
    vi.useRealTimers();
  });
});
