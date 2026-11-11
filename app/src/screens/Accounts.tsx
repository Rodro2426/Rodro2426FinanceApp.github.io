import { useApp, openSheet, setUI } from '../lib/store';
import { EyeToggle } from '../ui/EyeToggle';
import { earnsInterest } from '../lib/interest';

const GREEN_TEXT = 'oklch(0.5 0.12 150)';
import { LINE, ink, tint } from '../lib/constants';
import { acctTxns, fmt, initialOf, pctOf, plural } from '../lib/derive';
import { AcctBadge, ListCard } from '../ui/bits';
import * as I from '../ui/icons';
import { setData } from '../lib/store';
import { netWorth, investmentsValue, groupValue } from '../lib/networth';
import { Toggle } from '../ui/bits';
import { Blocks, FoldHead, useFolded } from '../ui/Blocks';
import { CardFace, cardInk } from '../ui/CardFace';
import type { AssetGroup } from '../lib/types';
import { shortDate } from '../lib/dates';

export default function Accounts() {
  const { data: d } = useApp();
  const nw = netWorth(d), inv = investmentsValue(d);
  const assets = nw.assets, debt = nw.debts;
  const parts = [
    { label: 'Accounts', value: nw.accounts },
    ...(nw.includeInvestments && nw.investments ? [{ label: 'Investments', value: nw.investments }] : []),
    ...nw.groups.filter(x => x.counted && x.value).map(x => ({ label: x.g.name, value: x.value })),
    ...(nw.includeOwed && nw.owedToMe ? [{ label: 'Owed to you', value: nw.owedToMe }] : []),
    ...(nw.cards ? [{ label: 'Cards', value: -nw.cards }] : []),
    ...(nw.iOwe ? [{ label: 'Debts', value: -nw.iOwe }] : [])
  ];
  const cash = d.accounts.filter(a => a.type !== 'card');
  const cards = d.accounts.filter(a => a.type === 'card');
  const { isFolded, toggle } = useFolded();
  const pos = 'oklch(0.62 0.12 160)', neg = 'oklch(0.9 0.05 25)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '4px 4px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em' }}>Accounts</span>
        <div style={{ display: 'flex', gap: 8 }}>
        <EyeToggle size={38} />
        <button data-tour="invest" onClick={() => setUI({ page: 'investments' })} aria-label="Investments" className="hv-n200" style={{ width: 38, height: 38, borderRadius: 999, border: 0, background: 'var(--surface)', color: GREEN_TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>
          <I.TrendUp size={17} />
        </button>
        <button data-tour="excel" onClick={() => openSheet({ name: 'export', acct: 'all' })} className="hv-n200" style={{ height: 38, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--surface)', color: 'var(--color-text)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
          <I.Download size={15} color="oklch(0.5 0.12 150)" />
          Excel
        </button>
        </div>
      </div>
      <Blocks page="accounts" title="Accounts" footer={<>
      <button data-tour="add-account" onClick={() => openSheet({ name: 'addAcct' })} className="hv-white" style={{ height: 54, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} />
        Add account or card
      </button>
      <button onClick={() => openSheet({ name: 'group', id: null })} className="hv-white" style={{ height: 54, marginTop: -4, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: 'var(--color-text)', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} />
        Create a group (home, car, other assets)
      </button>
      </>} blocks={[
        { id: 'networth', name: 'Net worth', desc: 'Total you have and owe', node: <>
      <div style={{ background: 'var(--surface)', borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>Net worth</span>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05 }}>{fmt(assets - debt)}</span>
        <div style={{ marginTop: 12, height: 10, borderRadius: 999, background: neg, overflow: 'hidden' }}>
          <div style={{ height: 10, borderRadius: 999, width: pctOf(assets, assets + debt), background: pos }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 4, gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: pos }} />You have {fmt(assets)}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 999, background: neg }} />You owe {fmt(debt)}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {parts.map(x => <span key={x.label} style={{ fontSize: 12, fontWeight: 600, padding: '5px 10px', borderRadius: 999, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-800)', whiteSpace: 'nowrap' }}>{x.label} {fmt(x.value)}</span>)}
        </div>
        {(inv.total > 0 || inv.stocksCount > 0 || inv.cdtCount > 0 || inv.fundCount > 0) && (
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Include investments</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{nw.includeInvestments ? `Stocks, CDTs and funds (${fmt(inv.total)}) count in your net worth` : `Left out: net worth shows only accounts${nw.groups.some(x => x.counted) ? ' and your groups' : ''}`}</span>
            </span>
            <Toggle on={nw.includeInvestments} onChange={v => setData(x => ({ settings: { ...x.settings, excludeInvestments: !v || undefined } }))} label="Include investments in net worth" />
          </div>
        )}
        {(nw.owedToMe > 0.004 || nw.includeOwed) && (
          <div style={{ marginTop: 8, paddingTop: 12, borderTop: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Include what people owe you</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{nw.includeOwed ? `The ${fmt(nw.owedToMe)} people owe you counts, as if they had already paid` : `Left out: the ${fmt(nw.owedToMe)} people owe you only counts once they pay`}</span>
            </span>
            <Toggle on={nw.includeOwed} onChange={v => setData(x => ({ settings: { ...x.settings, owedInNetWorth: v || undefined } }))} label="Include what people owe you in net worth" />
          </div>
        )}
      </div>
      </> },
        { id: 'cash', name: 'Debit and Cash', desc: 'Bank, savings and cash accounts', node: <>
      <FoldHead title="Debit and Cash" open={!isFolded('cash')} onToggle={() => toggle('cash')} summary={`${plural(cash.length, 'account')} · ${fmt(cash.filter(x => !x.notMine).reduce((a, x) => a + x.bal, 0))}`} />
      {!isFolded('cash') && <ListCard>
        {cash.map((a, i) => (
          <div key={a.id} onClick={() => openSheet({ name: 'acct', id: a.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: `1px solid ${i === cash.length - 1 ? 'transparent' : LINE}`, cursor: 'pointer' }}>
            <AcctBadge photo={a.photo} initial={initialOf(a.name)} size={42} radius={14} bg={tint(a.hue)} color={ink(a.hue)} fs={16} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{a.notMine ? 'Not yours' : a.kind} · {plural(acctTxns(d, a.id).list.length, 'transaction')}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(a.bal)}</span>
              {earnsInterest(a) && <span style={{ fontSize: 11.5, fontWeight: 700, color: GREEN_TEXT, whiteSpace: 'nowrap' }}>+{fmt(a.earned || 0)} · {String(a.rate).replace('.', ',')}%</span>}
            </div>
            <I.Chevron size={16} color="var(--color-neutral-400)" />
          </div>
        ))}
        {cash.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No bank, savings or cash accounts yet.</div>}
      </ListCard>}
      </> },
        { id: 'investments', name: 'Investments', desc: 'Stocks and CDTs', node: <>
      <FoldHead title="Investments" open={!isFolded('investments')} onToggle={() => toggle('investments')} summary={fmt(inv.total)}
        right={<span style={{ fontSize: 13, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{nw.includeInvestments ? 'In net worth' : 'Not in net worth'}</span>} />
      {!isFolded('investments') && <InvestmentsCard inv={inv} />}
      </> },
        ...(d.groups ?? []).map(g => ({ id: `group:${g.id}`, name: `${g.emoji} ${g.name}`, desc: 'Your custom group', node: <GroupCard g={g} /> })),
        { id: 'cards', name: 'Credit cards', desc: 'Card balances and payments', node: <>
      <FoldHead title="Credit cards" open={!isFolded('cards')} onToggle={() => toggle('cards')} summary={`${plural(cards.length, 'card')} · ${fmt(cards.filter(x => !x.notMine).reduce((a, x) => a + x.bal, 0))} owed`} />
      {!isFolded('cards') && cards.map(a => {
        const { k } = cardInk(a);
        return <CardFace key={a.id} a={a} onClick={() => openSheet({ name: 'acct', id: a.id })}
          action={<button onClick={e => { e.stopPropagation(); openSheet({ name: 'pay', id: a.id }); }} className="hv-w75" style={{ height: 36, padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--surface)', color: a.cardImg ? '#141414' : k, fontSize: 14, fontWeight: 700, cursor: 'pointer', textShadow: 'none' }}>Pay</button>} />;
      })}
      </> }
      ]} />
    </div>
  );
}

/** Investments at a glance: stocks and CDTs. Tap to open the Investments page. */
function InvestmentsCard({ inv }: { inv: ReturnType<typeof investmentsValue> }) {
  const gainPct = inv.stocks - inv.stocksGain > 0 ? inv.stocksGain / (inv.stocks - inv.stocksGain) : 0;
  const row = (icon: string, title: string, sub: string, value: string, extra?: string, extraColor?: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0' }}>
      <span style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flex: 'none' }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{title}</span>
        <span style={{ fontSize: 12, opacity: 0.75 }}>{sub}</span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 16, fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</span>
        {extra && <span style={{ fontSize: 11.5, fontWeight: 700, color: extraColor, whiteSpace: 'nowrap' }}>{extra}</span>}
      </span>
    </div>
  );
  return (
    <div onClick={() => setUI({ page: 'investments' })} className="pr98" role="button" aria-label="Open investments"
      style={{ background: 'linear-gradient(135deg, #2c3a8f 0%, #1d2766 100%)', color: '#fff', borderRadius: 28, padding: '18px 20px 10px', cursor: 'pointer', transition: 'transform .15s', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, opacity: 0.8 }}>Total invested value</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>Open <I.Chevron size={14} color="#fff" /></span>
      </div>
      <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', margin: '2px 0 6px' }}>{fmt(inv.total)}</span>
      <div style={{ borderTop: '1px solid rgba(255,255,255,.15)' }}>
        {row('📈', 'Stocks & ETFs', inv.stocksCount ? plural(inv.stocksCount, 'holding') : 'Add your first buy', fmt(inv.stocks), inv.stocksCount ? `${inv.stocksGain >= 0 ? '+' : '−'}${fmt(Math.abs(inv.stocksGain))} · ${(gainPct * 100).toFixed(1).replace('.', ',')}%` : undefined, inv.stocksGain >= 0 ? '#9ff0c4' : '#ffb4b4')}
        <div style={{ height: 1, background: 'rgba(255,255,255,.12)' }} />
        {row('🏦', 'CDTs', inv.cdtCount ? plural(inv.cdtCount, 'active CDT') : 'Add a CDT', fmt(inv.cdts))}
        {row('📊', 'Investment funds', inv.fundCount ? plural(inv.fundCount, 'fund') : 'Add a fund', fmt(inv.funds))}
      </div>
    </div>
  );
}

/** A custom group (Real estate, Vehicles…) with its items valued by hand. */
function GroupCard({ g }: { g: AssetGroup }) {
  const total = groupValue(g);
  const { isFolded, toggle } = useFolded(), key = `group:${g.id}`, open = !isFolded(key);
  return (
    <>
      <FoldHead title={`${g.emoji} ${g.name}`} open={open} onToggle={() => toggle(key)} summary={fmt(total)}
        right={<button onClick={() => openSheet({ name: 'group', id: g.id })} aria-label={`Edit ${g.name}`} style={{ border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0, whiteSpace: 'nowrap' }}>
          {g.inNetWorth ? '' : 'Not in net worth · '}Edit
        </button>} />
      {open && (
      <div style={{ background: tint(g.hue), borderRadius: 28, padding: '16px 18px 6px', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, color: ink(g.hue) }}>Total value</span>
        <span style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.03em', color: total < 0 ? 'var(--color-accent-700)' : ink(g.hue), marginBottom: 8 }}>{fmt(total)}</span>
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '2px 14px', marginBottom: 10 }}>
          {g.items.map((x, i) => (
            <div key={x.id} onClick={() => openSheet({ name: 'groupItem', group: g.id, id: x.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === g.items.length - 1 ? 'transparent' : LINE}`, cursor: 'pointer' }}>
              <span style={{ width: 36, height: 36, borderRadius: 12, background: x.debt ? 'var(--color-accent-100)' : tint(g.hue), color: x.debt ? 'var(--color-accent-700)' : ink(g.hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15, flex: 'none' }}>{x.debt ? '−' : initialOf(x.name)}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[x.note || (x.debt ? 'Debt' : 'Asset'), shortDate(x.updated)].join(' · ')}</span>
              </span>
              <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: x.debt ? 'var(--color-accent-700)' : 'var(--color-text)' }}>{x.debt ? '−' : ''}{fmt(x.value)}</span>
            </div>
          ))}
          <button onClick={() => openSheet({ name: 'groupItem', group: g.id, id: null })} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', border: 0, borderTop: g.items.length ? `1px solid ${LINE}` : 0, background: 'transparent', cursor: 'pointer', color: ink(g.hue), fontSize: 15, fontWeight: 700, textAlign: 'left' }}>
            <span style={{ width: 36, height: 36, borderRadius: 12, border: `2px dashed ${ink(g.hue)}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', opacity: 0.7 }}><I.Plus size={16} /></span>
            Add {g.items.length ? 'another' : 'an'} item
          </button>
        </div>
      </div>
      )}
    </>
  );
}
