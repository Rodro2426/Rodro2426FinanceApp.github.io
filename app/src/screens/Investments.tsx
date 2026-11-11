import { useEffect, useMemo, useState } from 'react';
import { EyeToggle } from '../ui/EyeToggle';
import { useApp, setUI, openSheet, setData, flash } from '../lib/store';
import { LINE, TEXT, ink, tint } from '../lib/constants';
import { fmt, isCOP, num } from '../lib/derive';
import { dailyRate, monthlyRate } from '../lib/interest';
import { OTHER, colorOf, finnhubKey, holdings, perUsd, refreshQuotes, refreshUsdRate, type Holding } from '../lib/invest';
import { MoneyInput } from '../ui/MoneyInput';
import { cdtView, cdtsOf, type CdtView } from '../lib/cdt';
import { CdtBadge } from '../sheets/CdtSheets';
import { STARS, moneyHidden } from '../lib/privacy';
import { KIND_LABEL, RISK_LABEL, fundView, fundsOf, localValue, type FundView } from '../lib/funds';
import { fmtDay } from '../lib/dates';
import { ListCard, Segmented } from '../ui/bits';
import * as I from '../ui/icons';

const UP = 'oklch(0.5 0.12 150)', DOWN = 'var(--color-accent-700)';
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + fmt(Math.abs(n)).replace('−', '');
/** Short form for small tiles: $23,1 M instead of $23.054.398 once numbers get long. */
const compact = (s: string) => {
  const m = /^([+−]?)(\D*)([\d.,]+)$/.exec(s);
  if (!m || s.length <= 9) return s;
  const cop = isCOP(), n = Number(cop ? m[3].replace(/\./g, '').replace(',', '.') : m[3].replace(/,/g, ''));
  const [v, u] = n >= 1e9 ? [n / 1e9, ' mil M'] : n >= 1e6 ? [n / 1e6, ' M'] : [n / 1e3, ' mil'];
  return `${m[1]}${m[2]}${v.toLocaleString(cop ? 'es-CO' : 'en-US', { maximumFractionDigits: 1 })}${u}`;
};
const pctTxt = (p: number) => `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p * 100).toFixed(2).replace('.', isCOP() ? ',' : '.')}%`;
const ago = (t: number) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`; };

export default function Investments() {
  const { data: d } = useApp();
  const [view, setView] = useState<'portfolio' | 'sim'>('portfolio');
  return (
    <div className="page noscroll scroller" style={{ position: 'absolute', inset: 0, zIndex: 25, background: 'var(--page)' }}>
      <div className="scroll-body" style={{ padding: 'var(--top) 18px calc(var(--tb) + 30px)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0 0' }}>
        <button onClick={() => setUI({ page: null })} aria-label="Back to accounts" data-back className="hv-n200" style={{ width: 40, height: 40, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.ChevronLeft size={20} /></button>
        <span style={{ flex: 1, fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>Investments</span>
        <EyeToggle size={40} />
        <button onClick={() => openSheet({ name: 'priceSettings' })} aria-label="Price settings" className="hv-n200" style={{ height: 40, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{finnhubKey(d) ? 'Prices' : 'Connect'}</button>
      </div>
      <Segmented items={[['portfolio', 'Portfolio'], ['sim', 'Returns simulator']]} value={view} onPick={setView} />
      <div style={{ marginTop: 14 }}>{view === 'portfolio' ? <Portfolio /> : <Simulator />}</div>
      </div>
    </div>
  );
}

/* ---------------- Portfolio ---------------- */
function Portfolio() {
  const { data: d } = useApp();
  const inv = d.investments;
  const all = holdings(d);
  const [busy, setBusy] = useState(false);
  const [focus, setFocus] = useState<string | null>(null);

  const refresh = async (quiet = false) => {
    setBusy(true);
    await refreshUsdRate();
    const r = await refreshQuotes();
    setBusy(false);
    if (quiet) return;
    if (r.error === 'nokey') flash('Add your free Finnhub key to get live prices');
    else if (r.error === 'key') flash('Finnhub rejected the key. Check it in Prices.');
    else if (r.error === 'limit') flash('Too many price requests. Try again in a minute.');
    else if (r.failed.length) flash(`No live price for ${r.failed.join(', ')}. Type it in instead.`);
    else if (r.ok) flash('Prices updated');
  };
  useEffect(() => { refresh(true); }, []);

  const cdts = cdtsOf(d).map(c => cdtView(c)).sort((a, b) => (a.status === 'closed' ? 1 : 0) - (b.status === 'closed' ? 1 : 0) || (a.end < b.end ? -1 : 1));
  const open = cdts.filter(v => v.status !== 'closed');
  const cdtValue = open.reduce((a, v) => a + v.value, 0), cdtIn = open.reduce((a, v) => a + v.c.amount, 0), cdtEarned = open.reduce((a, v) => a + v.earned, 0);
  // Investment funds, in your currency (dollar funds converted at the dollar rate).
  const funds = fundsOf(d).map(f => fundView(f)).sort((a, b) => (a.f.closed ? 1 : 0) - (b.f.closed ? 1 : 0) || b.value - a.value);
  const openFunds = funds.filter(v => !v.f.closed);
  const L = (v: FundView, n: number) => localValue(d, v.f, n);
  const fundValue = openFunds.reduce((a, v) => a + L(v, v.value), 0), fundIn = openFunds.reduce((a, v) => a + L(v, v.invested), 0);
  const stockTotal = all.reduce((a, h) => a + h.valueLocal, 0), stockIn = all.reduce((a, h) => a + h.investedLocal, 0);
  const total = stockTotal + cdtValue + fundValue, invested = stockIn + cdtIn + fundIn;
  const gain = stockTotal - stockIn + cdtEarned + (fundValue - fundIn), day = all.reduce((a, h) => a + h.dayChangeLocal, 0) + open.reduce((a, v) => a + v.perDay, 0) + openFunds.reduce((a, v) => a + L(v, v.perDay), 0);
  const lastAt = Math.max(0, ...all.map(h => (h.quote && !h.quote.manual ? h.quote.at : 0)));
  const focused = focus === '_cdt' ? { ticker: 'CDTs', valueLocal: cdtValue, gain: cdtEarned, gainPct: cdtIn ? cdtEarned / cdtIn : 0 }
    : focus === '_fund' ? { ticker: 'Funds', valueLocal: fundValue, gain: fundValue - fundIn, gainPct: fundIn ? (fundValue - fundIn) / fundIn : 0 } : all.find(h => h.ticker === focus);
  const sorted = [...all].sort((a, b) => b.valueLocal - a.valueLocal);
  const trades = [...inv.trades].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.ts - a.ts)).slice(0, 8);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--surface)', borderRadius: 28, padding: '20px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <Donut all={all} total={total} extra={[...(cdtValue > 0 ? [{ key: '_cdt', v: cdtValue, color: CDT_COLOR }] : []), ...(fundValue > 0 ? [{ key: '_fund', v: fundValue, color: FUND_COLOR }] : [])]} focus={focus} onFocus={setFocus}>
          {focused ? (
            <>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{focused.ticker}</span>
              <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.03em' }}>{fmt(focused.valueLocal)}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{total ? Math.round(focused.valueLocal / total * 100) : 0}% of portfolio</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: focused.gain >= 0 ? UP : DOWN }}>{pctTxt(focused.gainPct)}</span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Portfolio value</span>
              <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{fmt(total)}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: gain >= 0 ? UP : DOWN }}>{signed(gain)} · {pctTxt(invested ? gain / invested : 0)}</span>
            </>
          )}
        </Donut>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8, width: '100%' }}>
          {[['Invested', compact(fmt(invested)), TEXT], ['Total return', compact(signed(gain)), gain >= 0 ? UP : DOWN], ['Today', compact(signed(day)), day >= 0 ? UP : DOWN]].map(([l, v, col]) => (
            <div key={l} style={{ background: 'var(--color-neutral-100)', borderRadius: 16, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ fontSize: 11.5, color: 'var(--color-neutral-700)' }}>{l}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: col, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', fontSize: 12, color: 'var(--color-neutral-600)', gap: 8 }}>
          <span>{d.settings.currency === 'COP' ? `1 USD = ${fmt(inv.usdRate)}${inv.usdManual ? ' (typed in)' : ''}` : d.settings.currency !== '$' ? `1 USD = ${fmt(perUsd(inv, d.settings.currency))}` : ''}{lastAt ? ` · prices ${ago(lastAt)}` : ''}</span>
          <button onClick={() => refresh()} disabled={busy} aria-label="Refresh prices" style={{ border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, opacity: busy ? 0.5 : 1 }}><I.Refresh size={13} />{busy ? 'Updating…' : 'Refresh'}</button>
        </div>
      </div>

      {!finnhubKey(d) && (
        <div onClick={() => openSheet({ name: 'priceSettings' })} style={{ background: 'oklch(0.94 0.04 250)', borderRadius: 22, padding: 16, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: 'var(--surface)', color: 'oklch(0.42 0.1 250)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.TrendUp size={18} /></div>
          <span style={{ flex: 1, fontSize: 14, lineHeight: 1.35, color: 'oklch(0.32 0.08 250)' }}>Connect live prices with a free Finnhub key. Until then, you can type prices in yourself.</span>
          <I.Chevron size={16} color="oklch(0.42 0.1 250)" />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 4px 0' }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Holdings</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{all.length === 1 ? '1 stock' : `${all.length} stocks`}</span>
      </div>
      <ListCard>
        {sorted.map((h, i) => <HoldingRow key={h.ticker} h={h} color={colorOf(all, h.ticker)} last={i === sorted.length - 1} total={total} />)}
        {all.length === 0 && <div style={{ padding: '16px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No stocks yet. Add your first buy, for example AAPL or VOO, or a Colombian stock from Trii.</div>}
      </ListCard>
      <button onClick={() => openSheet({ name: 'trade', side: 'buy' })} className="hv-acc600" style={{ height: 54, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} sw={2.5} />Add buy or sell
      </button>

      <div data-tour="cdts" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 4px 0' }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>CDTs</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{open.length ? `${fmt(cdtValue)} · ${open.length === 1 ? '1 active' : `${open.length} active`}` : 'Fixed-term deposits'}</span>
      </div>
      <ListCard>
        {cdts.map((v, i) => <CdtRow key={v.c.id} v={v} last={i === cdts.length - 1} />)}
        {cdts.length === 0 && <div style={{ padding: '16px 0', fontSize: 14, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>No CDTs yet. Add one you already have, or compare popular CDTs from Colombian banks and see what you'd earn.</div>}
      </ListCard>
      <button onClick={() => openSheet({ name: 'cdt', id: null })} className="hv-n200" style={{ height: 54, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} sw={2.5} />Add CDT
      </button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '6px 4px 0' }}>
        <span style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Investment funds</span>
        <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>{openFunds.length ? `${fmt(fundValue)} · ${openFunds.length === 1 ? '1 fund' : `${openFunds.length} funds`}` : 'FICs, pension and more'}</span>
      </div>
      <ListCard>
        {funds.map((v, i) => <FundRow key={v.f.id} v={v} local={n => L(v, n)} last={i === funds.length - 1} />)}
        {funds.length === 0 && <div style={{ padding: '16px 0', fontSize: 14, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>No funds yet. Add a collective investment fund (like a Fiducuenta), a voluntary pension or your cesantías to see them with the rest of your money.</div>}
      </ListCard>
      <button onClick={() => openSheet({ name: 'fund', id: null })} className="hv-n200" style={{ height: 54, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <I.Plus size={18} sw={2.5} />Add investment fund
      </button>

      {trades.length > 0 && <>
        <div style={{ padding: '6px 4px 0', fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>Activity</div>
        <ListCard>
          {trades.map((t, i) => (
            <div key={t.id} onClick={() => openSheet({ name: 'holding', ticker: t.ticker })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === trades.length - 1 ? 'transparent' : LINE}`, cursor: 'pointer' }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 8px', borderRadius: 999, background: t.side === 'buy' ? 'oklch(0.95 0.045 155)' : 'var(--color-accent-100)', color: t.side === 'buy' ? 'oklch(0.42 0.09 155)' : 'var(--color-accent-700)', flex: 'none', textTransform: 'uppercase' }}>{t.side === 'buy' ? 'Buy' : 'Sell'}</span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{t.ticker}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{fmtQty(t.qty)} × {fmtNative(t.price, t.currency)} · {t.date}</span>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmtNative(t.qty * t.price + (t.side === 'buy' ? t.fee : -t.fee), t.currency)}</span>
            </div>
          ))}
        </ListCard>
      </>}
    </div>
  );
}

export const fmtQty = (q: number) => q.toLocaleString('es-CO', { maximumFractionDigits: 6 });
export const fmtNative = (n: number, cur: 'USD' | 'COP') => moneyHidden() ? (cur === 'USD' ? 'US$' : '$') + STARS : cur === 'USD'
  ? 'US$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  : '$' + Math.round(n).toLocaleString('es-CO');

export function TickerLogo({ h, size = 40, color }: { h: { ticker: string; quote?: { logo?: string } }; size?: number; color: string }) {
  const [bad, setBad] = useState(false);
  const logo = h.quote?.logo;
  return (
    <span style={{ position: 'relative', width: size, height: size, borderRadius: 999, background: 'var(--surface)', boxShadow: 'inset 0 0 0 1px var(--color-neutral-200)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flex: 'none', fontSize: size * 0.3, fontWeight: 700, color: TEXT }}>
      {logo && !bad ? <img src={logo} alt="" onError={() => setBad(true)} style={{ width: '70%', height: '70%', objectFit: 'contain' }} /> : h.ticker.replace(/\..*/, '').slice(0, 4)}
      <span style={{ position: 'absolute', right: 0, bottom: 0, width: size * 0.3, height: size * 0.3, borderRadius: 999, background: color, boxShadow: '0 0 0 2px #fff' }} />
    </span>
  );
}

const CDT_COLOR = '#6250d6';
const FUND_COLOR = '#178a7a';
/** One investment fund: its value today (estimated between statements) and the return so far. */
function FundRow({ v, local, last }: { v: FundView; local: (n: number) => number; last: boolean }) {
  const f = v.f, closed = !!f.closed;
  const sub = closed ? 'Closed' : [KIND_LABEL[f.kind], RISK_LABEL[f.risk], f.rate ? `${pctCdt(f.rate)} E.A.` : '', f.liquidity === 'lock' && v.freeFrom && v.freeFrom > new Date().toISOString().slice(0, 10) ? `locked until ${fmtDay(v.freeFrom, { month: 'short', day: 'numeric' })}` : ''].filter(Boolean).join(' · ');
  return (
    <div onClick={() => openSheet({ name: 'fundInfo', id: f.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${last ? 'transparent' : LINE}`, cursor: 'pointer', opacity: closed ? 0.55 : 1 }}>
      <span style={{ width: 42, height: 42, borderRadius: 14, background: tint(f.hue), color: ink(f.hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, flex: 'none' }}>{f.name.trim().charAt(0).toUpperCase() || 'F'}</span>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.manager ? `${f.manager} · ` : ''}{sub}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{closed ? '—' : `${v.estimated ? '≈ ' : ''}${fmt(local(v.value))}`}</span>
        {!closed && <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: v.gain >= 0 ? UP : DOWN }}>{v.gain >= 0 ? '+' : '−'}{fmt(Math.abs(local(v.gain)))}</span>}
      </div>
    </div>
  );
}
function CdtRow({ v, last }: { v: CdtView; last: boolean }) {
  const c = v.c, closed = v.status === 'closed';
  const sub = closed ? `${c.closed!.how === 'renew' ? 'Renewed' : 'Cashed out'} ${fmtDay(c.closed!.date, { month: 'short', day: 'numeric' })}`
    : v.status === 'matured' ? 'Matured · tap to cash out or renew' : `${pctCdt(c.rate)} E.A. · ${v.daysLeft} days left`;
  return (
    <div onClick={() => openSheet({ name: 'cdtInfo', id: c.id })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${last ? 'transparent' : LINE}`, cursor: 'pointer', opacity: closed ? 0.55 : 1 }}>
      <CdtBadge bank={c.bank} hue={c.hue} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.bank}</span>
        <span style={{ fontSize: 12, fontWeight: v.status === 'matured' ? 700 : 400, color: v.status === 'matured' ? 'oklch(0.45 0.11 150)' : 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
        {!closed && <div style={{ marginTop: 6, height: 4, borderRadius: 99, background: 'var(--color-neutral-200)', overflow: 'hidden' }}><div style={{ width: `${Math.min(100, v.progress * 100)}%`, height: '100%', background: CDT_COLOR }} /></div>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(closed ? c.closed!.amt : v.value)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: UP }}>+{fmt(v.earned)}</span>
      </div>
    </div>
  );
}
const pctCdt = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '%';

function HoldingRow({ h, color, last, total }: { h: Holding; color: string; last: boolean; total: number }) {
  return (
    <div onClick={() => openSheet({ name: 'holding', ticker: h.ticker })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${last ? 'transparent' : LINE}`, cursor: 'pointer' }}>
      <TickerLogo h={h} color={color} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{h.ticker}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h.name !== h.ticker ? h.name + ' · ' : ''}{fmtQty(h.qty)} sh · {total ? Math.round(h.valueLocal / total * 100) : 0}%</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(h.valueLocal)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', color: h.gain >= 0 ? UP : DOWN }}>{pctTxt(h.gainPct)}</span>
      </div>
    </div>
  );
}

/** Ring of holdings by value; up to 7 named slices, the rest folded into "Other". Tap a slice to see it. */
function Donut({ all, total, extra = [], focus, onFocus, children }: { all: Holding[]; total: number; extra?: { key: string; v: number; color: string }[]; focus: string | null; onFocus: (t: string | null) => void; children: React.ReactNode }) {
  const S = 230, R = 96, W = 20, C = 2 * Math.PI * R, GAP = all.length + extra.length > 1 ? 3 : 0;
  const slices = useMemo(() => {
    const named = all.filter(h => colorOf(all, h.ticker) !== OTHER).sort((a, b) => a.firstTs - b.firstTs);
    const rest = all.filter(h => colorOf(all, h.ticker) === OTHER);
    const s = named.map(h => ({ key: h.ticker, v: h.valueLocal, color: colorOf(all, h.ticker) }));
    if (rest.length) s.push({ key: '_other', v: rest.reduce((a, h) => a + h.valueLocal, 0), color: OTHER });
    s.push(...extra);
    let at = 0;
    return s.filter(x => x.v > 0).map(x => { const len = total ? (x.v / total) * C : 0, o = { ...x, off: at, len }; at += len; return o; });
  }, [all, total, extra.map(e => e.v).join()]);
  return (
    <div style={{ position: 'relative', width: S, height: S }}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} style={{ transform: 'rotate(-90deg)' }} role="img" aria-label="Portfolio by holding">
        <circle cx={S / 2} cy={S / 2} r={R} style={{ fill: 'none', stroke: 'var(--color-neutral-200)', strokeWidth: W }} />
        {slices.map(sl => (
          <circle key={sl.key} cx={S / 2} cy={S / 2} r={R} onClick={() => sl.key !== '_other' && onFocus(focus === sl.key ? null : sl.key)}
            style={{ fill: 'none', stroke: sl.color, strokeWidth: focus === sl.key ? W + 8 : W, strokeDasharray: `${Math.max(0, sl.len - GAP)} ${C}`, strokeDashoffset: -sl.off, cursor: 'pointer', opacity: focus && focus !== sl.key ? 0.35 : 1, transition: 'stroke-width .2s, opacity .2s' }} />
        ))}
      </svg>
      <div onClick={() => onFocus(null)} style={{ position: 'absolute', inset: W + 18, borderRadius: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 2 }}>{children}</div>
    </div>
  );
}

/* ---------------- Returns simulator (like Nu's Cajitas) ---------------- */
function Simulator() {
  const { data: d } = useApp();
  const sim = d.investments.sim || { amt: '10000000', rate: '9.25', months: '12', deposit: '0' };
  const set = (k: keyof typeof sim) => (v: string) => setData(x => ({ investments: { ...x.investments, sim: { ...sim, [k]: v } } }));
  const [tip, setTip] = useState<number | null>(null);

  const amt = num(sim.amt), ea = num(sim.rate), months = Math.max(1, Math.min(120, Math.round(num(sim.months)) || 1)), dep = num(sim.deposit);
  const rm = monthlyRate(ea), rd = dailyRate(ea);
  const rows: { m: number; money: number; interest: number; bal: number }[] = [];
  let bal = amt, money = amt;
  for (let m = 1; m <= months; m++) { bal = bal * (1 + rm) + dep; money += dep; rows.push({ m, money, interest: bal - money, bal }); }
  const final = rows[rows.length - 1], max = Math.max(1, ...rows.map(r => r.bal)) * 1.04; // headroom for the 2px gap
  const field = { background: 'var(--surface)', borderRadius: 18, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 } as const;
  const inp = { border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none', minWidth: 0, width: '100%' } as const;
  const MONEY = '#2a78d6', INTEREST = '#1baf7a';
  const sel = tip != null ? rows[tip] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
        <label style={{ ...field, gridColumn: '1 / -1' }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Amount to save</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}><span style={{ ...inp, width: 'auto', color: 'var(--color-neutral-400)' }}>$</span><MoneyInput value={sim.amt} onChange={set('amt')} style={inp} /></div></label>
        <label style={field}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Annual return</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}><input type="text" inputMode="decimal" value={sim.rate} onChange={e => set('rate')(e.target.value.replace(/[^\d.,]/g, ''))} style={inp} /><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-400)', whiteSpace: 'nowrap' }}>% E.A.</span></div></label>
        <label style={field}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Time</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}><input type="text" inputMode="numeric" value={sim.months} onChange={e => set('months')(e.target.value.replace(/\D/g, ''))} style={inp} /><span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-400)' }}>months</span></div></label>
        <label style={{ ...field, gridColumn: '1 / -1' }}><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Monthly deposit (optional)</span>
          <div style={{ display: 'flex', gap: 4, alignItems: 'baseline' }}><span style={{ ...inp, width: 'auto', color: 'var(--color-neutral-400)' }}>$</span><MoneyInput value={sim.deposit} onChange={set('deposit')} style={inp} /></div></label>
      </div>

      <div style={{ background: 'oklch(0.95 0.045 155)', borderRadius: 26, padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'oklch(0.42 0.09 155)' }}>You'd have after {months === 1 ? '1 month' : `${months} months`}</span>
        <span style={{ fontSize: 38, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: 'oklch(0.3 0.07 155)' }}>{fmt(final.bal)}</span>
        <span style={{ fontSize: 13, color: 'oklch(0.42 0.09 155)' }}>{fmt(final.money)} of your money + <b>{fmt(final.interest)}</b> in interest</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 8 }}>
        {[['Per day', compact(fmt(amt * rd))], ['Per month', compact(fmt(amt * rm))], ['Total interest', compact(fmt(final.interest))]].map(([l, v]) => (
          <div key={l} style={{ background: 'var(--surface)', borderRadius: 16, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <span style={{ fontSize: 11.5, color: 'var(--color-neutral-700)' }}>{l}</span>
            <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</span>
          </div>
        ))}
      </div>
      <span style={{ margin: '0 4px', fontSize: 12, color: 'var(--color-neutral-700)' }}>"Per day" and "Per month" are what the starting amount earns at first. Interest is compounded daily, which equals {(rm * 100).toFixed(3).replace('.', ',')}% a month. No tax withholding is included.</span>

      <div style={{ background: 'var(--surface)', borderRadius: 24, padding: '16px 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Balance by month</span>
          <span style={{ display: 'flex', gap: 10, fontSize: 11.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: MONEY }} />Your money</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: INTEREST }} />Interest</span>
          </span>
        </div>
        <div style={{ minHeight: 34, fontSize: 12.5, color: 'var(--color-neutral-700)' }}>
          {sel ? <>Month {sel.m}: <b style={{ color: TEXT }}>{fmt(sel.bal)}</b> · {fmt(sel.money)} yours + {fmt(sel.interest)} interest</> : 'Tap a bar to see that month.'}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: rows.length > 36 ? 1 : 2, height: 150 }}>
          {rows.map((r, i) => (
            <button key={r.m} onClick={() => setTip(tip === i ? null : i)} aria-label={`Month ${r.m}: ${fmt(r.bal)}`}
              style={{ flex: 1, minWidth: 0, height: '100%', border: 0, padding: 0, background: 'transparent', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 2, opacity: tip != null && tip !== i ? 0.45 : 1 }}>
              <span style={{ display: 'block', height: `${(r.interest / max) * 100}%`, background: INTEREST, borderRadius: '4px 4px 0 0', minHeight: r.interest > 0 ? 2 : 0, flexShrink: 0 }} />
              <span style={{ display: 'block', height: `${(r.money / max) * 100}%`, background: MONEY, borderRadius: r.interest > 0 ? 0 : '4px 4px 0 0', flexShrink: 0 }} />
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-neutral-600)' }}><span>Month 1</span><span>Month {months}</span></div>
      </div>
      <button onClick={() => setData(x => ({ investments: { ...x.investments, sim: { amt: '10000000', rate: '9.25', months: '12', deposit: '0' } } }))} style={{ alignSelf: 'center', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Reset to example</button>
    </div>
  );
}
