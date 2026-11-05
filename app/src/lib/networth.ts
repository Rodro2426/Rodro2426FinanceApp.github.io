// Net worth in one place: accounts, cards, investments (stocks + CDTs) and custom groups.
import type { AssetGroup, Data } from './types';
import { holdings } from './invest';
import { cdtTotal, cdtsOf } from './cdt';

export const groupValue = (g: AssetGroup) => g.items.reduce((a, x) => a + (x.debt ? -x.value : x.value), 0);
export const groupAssets = (g: AssetGroup) => g.items.filter(x => !x.debt).reduce((a, x) => a + x.value, 0);
export const groupDebts = (g: AssetGroup) => g.items.filter(x => x.debt).reduce((a, x) => a + x.value, 0);

export function investmentsValue(d: Data) {
  const hs = holdings(d);
  const stocks = hs.reduce((a, h) => a + h.valueLocal, 0), stocksIn = hs.reduce((a, h) => a + h.investedLocal, 0);
  const cdts = cdtTotal(d), openCdts = cdtsOf(d).filter(c => !c.closed).length;
  return { stocks, stocksGain: stocks - stocksIn, stocksCount: hs.length, cdts, cdtCount: openCdts, total: stocks + cdts };
}

export interface NetWorth {
  accounts: number; cards: number; investments: number; includeInvestments: boolean;
  groups: { g: AssetGroup; value: number; counted: boolean }[];
  /** What you have and what you owe, counting only what's included. */
  assets: number; debts: number; total: number;
}
export function netWorth(d: Data): NetWorth {
  const accounts = d.accounts.filter(a => a.type !== 'card').reduce((x, a) => x + a.bal, 0);
  const cards = d.accounts.filter(a => a.type === 'card').reduce((x, a) => x + a.bal, 0);
  const inv = investmentsValue(d).total, includeInvestments = !d.settings.excludeInvestments;
  const groups = (d.groups ?? []).map(g => ({ g, value: groupValue(g), counted: g.inNetWorth }));
  const counted = groups.filter(x => x.counted);
  const assets = accounts + (includeInvestments ? inv : 0) + counted.reduce((a, x) => a + groupAssets(x.g), 0);
  const debts = cards + counted.reduce((a, x) => a + groupDebts(x.g), 0);
  return { accounts, cards, investments: inv, includeInvestments, groups, assets, debts, total: assets - debts };
}
