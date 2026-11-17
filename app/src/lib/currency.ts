// Every currency Pockets can run in: how its amounts look (symbol, cents, separators) and who uses it.
// One table, read by fmt, the money inputs, splitting and the setup question. No store import (split.ts uses it).

export interface CurrencyInfo {
  /** Shown in the setup list and in Profile. */ country: string; flag: string; name: string;
  symbol: string; /** "S/ 25.00" instead of "S/25.00". */ space?: boolean;
  decimals: 0 | 2; group: '.' | ','; dec: ',' | '.';
  /** Quick amounts on Pay card and similar: typical round numbers in this currency. */ quick: [number, number, number];
}

const peso = (country: string, flag: string, name: string, decimals: 0 | 2, group: '.' | ',', quick: [number, number, number]): CurrencyInfo =>
  ({ country, flag, name, symbol: '$', decimals, group, dec: group === '.' ? ',' : '.', quick });

export const CURRENCIES = {
  COP: peso('Colombia', '🇨🇴', 'Colombian peso', 0, '.', [50000, 100000, 250000]),
  MXN: peso('Mexico', '🇲🇽', 'Mexican peso', 2, ',', [200, 500, 1000]),
  ARS: peso('Argentina', '🇦🇷', 'Argentine peso', 2, '.', [10000, 50000, 100000]),
  CLP: peso('Chile', '🇨🇱', 'Chilean peso', 0, '.', [10000, 25000, 50000]),
  PEN: { country: 'Peru', flag: '🇵🇪', name: 'Peruvian sol', symbol: 'S/', space: true, decimals: 2, group: ',', dec: '.', quick: [50, 100, 200] },
  UYU: peso('Uruguay', '🇺🇾', 'Uruguayan peso', 2, '.', [500, 1000, 2000]),
  PYG: { country: 'Paraguay', flag: '🇵🇾', name: 'Paraguayan guaraní', symbol: '₲', space: true, decimals: 0, group: '.', dec: ',', quick: [50000, 100000, 200000] },
  BOB: { country: 'Bolivia', flag: '🇧🇴', name: 'Bolivian boliviano', symbol: 'Bs', space: true, decimals: 2, group: '.', dec: ',', quick: [50, 100, 200] },
  BRL: { country: 'Brazil', flag: '🇧🇷', name: 'Brazilian real', symbol: 'R$', space: true, decimals: 2, group: '.', dec: ',', quick: [50, 100, 200] },
  CRC: { country: 'Costa Rica', flag: '🇨🇷', name: 'Costa Rican colón', symbol: '₡', decimals: 2, group: '.', dec: ',', quick: [5000, 10000, 25000] },
  GTQ: { country: 'Guatemala', flag: '🇬🇹', name: 'Guatemalan quetzal', symbol: 'Q', decimals: 2, group: ',', dec: '.', quick: [100, 200, 500] },
  HNL: { country: 'Honduras', flag: '🇭🇳', name: 'Honduran lempira', symbol: 'L', decimals: 2, group: ',', dec: '.', quick: [200, 500, 1000] },
  NIO: { country: 'Nicaragua', flag: '🇳🇮', name: 'Nicaraguan córdoba', symbol: 'C$', decimals: 2, group: ',', dec: '.', quick: [200, 500, 1000] },
  DOP: { country: 'Dominican Republic', flag: '🇩🇴', name: 'Dominican peso', symbol: 'RD$', decimals: 2, group: ',', dec: '.', quick: [500, 1000, 2000] },
  USD: { country: 'Ecuador, El Salvador, Panama, USA', flag: '🇺🇸', name: 'US dollar', symbol: '$', decimals: 2, group: ',', dec: '.', quick: [25, 50, 100] },
  EUR: { country: 'Europe', flag: '🇪🇺', name: 'Euro', symbol: '€', decimals: 2, group: '.', dec: ',', quick: [25, 50, 100] },
  GBP: { country: 'United Kingdom', flag: '🇬🇧', name: 'British pound', symbol: '£', decimals: 2, group: ',', dec: '.', quick: [25, 50, 100] }
} satisfies Record<string, CurrencyInfo>;

export type CurrencyCode = keyof typeof CURRENCIES;
/** Older saves stored a symbol instead of a code. */
const LEGACY: Record<string, CurrencyCode> = { '$': 'USD', '€': 'EUR', '£': 'GBP' };
/** The code for a saved setting, old or new; unknown values fall back to COP. */
export const codeOf = (c: string | undefined): CurrencyCode => (c && c in CURRENCIES ? (c as CurrencyCode) : (c && LEGACY[c]) || 'COP');
// Older "€" saves wrote euros the English way (€1,234.50); keep that so their numbers look the same.
export const infoOf = (c: string | undefined): CurrencyInfo => (c === '€' ? { ...CURRENCIES.EUR, group: ',', dec: '.' } : CURRENCIES[codeOf(c)]);
/** The currencies offered in setup and Profile, Latin America first. */
export const CURRENCY_LIST = Object.keys(CURRENCIES) as CurrencyCode[];

/** `1234567.5` → "1.234.567,50" in the currency's own way (no symbol). */
export function formatNumber(n: number, info: CurrencyInfo, decimals: number = info.decimals) {
  const [int, frac] = Math.abs(n).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, info.group);
  return frac ? grouped + info.dec + frac : grouped;
}
/** Units per currency unit for splitting money: 1 for currencies without cents, 100 with them. */
export const unitsOf = (c: string | undefined) => (infoOf(c).decimals === 0 ? 1 : 100);
