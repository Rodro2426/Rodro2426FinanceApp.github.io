import 'fake-indexeddb/auto';
import { afterAll, describe, expect, it } from 'vitest';
import { CURRENCIES, codeOf, formatNumber, infoOf, unitsOf } from './currency';
import { fmt, roundAmt } from './derive';
import { getData, setData } from './store';
import { perUsd } from './invest';
import { largestRemainder } from './split';

const before = getData().settings.currency;
afterAll(() => setData(x => ({ settings: { ...x.settings, currency: before } })));
const use = (c: string) => setData(x => ({ settings: { ...x.settings, currency: c as never } }));

describe('Latin American currencies', () => {
  it('each looks the way people there write money', () => {
    use('COP'); expect(fmt(1234567)).toBe('$1.234.567');
    use('MXN'); expect(fmt(1234.5)).toBe('$1,234.50');
    use('CLP'); expect(fmt(1234567)).toBe('$1.234.567');
    use('ARS'); expect(fmt(1234.5)).toBe('$1.234,50');
    use('PEN'); expect(fmt(-12.5)).toBe('−S/ 12.50');
    use('PYG'); expect(fmt(50000)).toBe('₲ 50.000');
    use('BRL'); expect(fmt(10)).toBe('R$ 10,00');
  });
  it('currencies without cents round to whole units, the rest to cents', () => {
    use('CLP'); expect(roundAmt(1234.6)).toBe(1235);
    use('MXN'); expect(roundAmt(10.005)).toBeCloseTo(10.01, 2);
    expect(unitsOf('PYG')).toBe(1); expect(unitsOf('DOP')).toBe(100);
  });
  it('a split in cents still adds up exactly', () => {
    const parts = largestRemainder(100, [1, 1, 1], unitsOf('MXN'));
    expect(Math.round(parts.reduce((a, b) => a + b, 0) * 100)).toBe(10000);
  });
  it('old saves keep working: $ is dollars, € keeps its old look', () => {
    expect(codeOf('$')).toBe('USD'); expect(codeOf('£')).toBe('GBP'); expect(codeOf(undefined)).toBe('COP');
    expect(formatNumber(1234.5, infoOf('€'))).toBe('1,234.50');
    expect(formatNumber(1234.5, infoOf('EUR'))).toBe('1.234,50');
  });
  it('dollar rate: live when known, a rough one before, 1 in dollars', () => {
    const inv = { trades: [], quotes: {}, usdRate: 4100, usdRateAt: 0 };
    expect(perUsd(inv, 'COP')).toBe(4100);
    expect(perUsd(inv, 'USD')).toBe(1);
    expect(perUsd({ ...inv, fxPerUsd: { MXN: 17.2 } }, 'MXN')).toBe(17.2);
    expect(perUsd(inv, 'MXN')).toBeGreaterThan(1);
    expect(Object.keys(CURRENCIES).every(k => perUsd(inv, k) > 0)).toBe(true);
  });

  it('dollar bill for a Mexican user: cents, rate saved, no TRM wait', async () => {
    const { localAmount } = await import('./schedule');
    const { convert } = await import('./invest');
    use('MXN');
    const d = getData();
    const inv = { ...d.investments, fxPerUsd: { MXN: 17.25 }, usdRate: 4000 };
    const d2 = { ...d, investments: inv };
    const b = { id: 'b', name: 'App', amt: 9.99, currency: 'USD' } as never;
    // 9.99 * 17.25 = 172.3275 -> 172.33
    const r = localAmount(d2, b, '2026-03-05')!;
    expect(r.amt).toBe(172.33); expect(r.orig).toEqual({ amt: 9.99, cur: 'USD', rate: 17.25, official: false });
    // Colombian-peso stock trade for a MXN user goes through dollars: 4,000 COP = 1 USD = 17.25 MXN
    expect(convert(inv, 4000, 'COP', 'MXN')).toBeCloseTo(17.25, 6);
    // a fund in "app currency" is never converted
    expect(convert(inv, 100, 'USD', 'USD')).toBe(100);
  });
  it('0-decimal currencies never keep fractions, 2-decimal ones keep cents', () => {
    use('PYG'); expect(roundAmt(7500.5 * 1.0)).toBe(7501); expect(fmt(7500.5)).toBe('₲ 7.501');
    use('CRC'); expect(roundAmt(12.345)).toBeCloseTo(12.35, 2);
  });
});
