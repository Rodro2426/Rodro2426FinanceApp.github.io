import { useEffect, useState } from 'react';
import { useApp, setData, closeSheet, openSheet, flash, getData } from '../lib/store';
import { LINE, RED, TEXT } from '../lib/constants';
import { fmt, num, uid } from '../lib/derive';
import { todayISO } from '../lib/dates';
import { colorOf, holdings, refreshQuotes, refreshUsdRate, searchSymbols, toLocal, type SymbolMatch } from '../lib/invest';
import type { Trade } from '../lib/types';
import { FieldLabel, GhostDanger, PrimaryBtn, Segmented, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SheetFrame } from './Sheet';
import { TickerLogo, fmtNative, fmtQty } from '../screens/Investments';

const UP = 'oklch(0.5 0.12 150)';
const decInput = (v: string) => v.replace(',', '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1');

/* ---------------- Add a buy or sell ---------------- */
export function TradeSheet({ ticker: t0, side: s0 }: { ticker?: string; side?: 'buy' | 'sell' }) {
  const { data: d } = useApp();
  const held = holdings(d);
  const prior = t0 ? d.investments.trades.find(t => t.ticker === t0) : undefined;
  const [side, setSide] = useState<'buy' | 'sell'>(s0 ?? 'buy');
  const [ticker, setTicker] = useState(t0 ?? '');
  const [name, setName] = useState(prior?.name ?? '');
  const [currency, setCurrency] = useState<'USD' | 'COP'>(prior?.currency ?? 'USD');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState(t0 && d.investments.quotes[t0] ? String(d.investments.quotes[t0].price) : '');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(todayISO());
  const [matches, setMatches] = useState<SymbolMatch[]>([]);

  // Look up tickers as you type (needs the Finnhub key).
  useEffect(() => {
    if (t0 || !d.settings.finnhubKey || ticker.length < 1) { setMatches([]); return; }
    const h = setTimeout(() => { searchSymbols(ticker).then(setMatches).catch(() => setMatches([])); }, 350);
    return () => clearTimeout(h);
  }, [ticker]);

  const T = ticker.trim().toUpperCase();
  const own = held.find(h => h.ticker === T);
  const q = num(qty), p = num(price), f = num(fee);
  const tooMany = side === 'sell' && q > (own?.qty ?? 0) + 1e-9;
  const cant = !T || !(q > 0) || !(p > 0) || tooMany;
  const total = q * p + (side === 'buy' ? f : -f);

  const save = () => {
    if (cant) return;
    const trade: Trade = { id: uid('t'), ts: Date.now(), ticker: T, name: name.trim() || own?.name || T, currency, side, qty: q, price: p, fee: f, date };
    setData(x => ({ investments: { ...x.investments, trades: [...x.investments.trades, trade] } }));
    closeSheet(); flash(`${side === 'buy' ? 'Bought' : 'Sold'} ${fmtQty(q)} ${T}`);
    if (d.settings.finnhubKey) refreshQuotes();
  };
  const priceField = currency === 'USD'
    ? <input type="text" inputMode="decimal" placeholder="0.00" value={price} onChange={e => setPrice(decInput(e.target.value))} style={{ ...textInput, fontWeight: 600, width: '100%' }} />
    : <MoneyInput value={price} onChange={setPrice} style={{ ...textInput, fontWeight: 600, width: '100%' }} />;

  return (
    <SheetFrame title={side === 'buy' ? 'Buy' : 'Sell'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Segmented items={[['buy', 'Buy'], ['sell', 'Sell']]} value={side} onPick={setSide} mt={6} />
        <FieldLabel m="14px 4px 6px">Ticker</FieldLabel>
        <input value={ticker} placeholder="AAPL, VOO, ECOPETROL…" autoCapitalize="characters" onChange={e => setTicker(e.target.value.toUpperCase().replace(/\s/g, ''))} disabled={!!t0} style={{ ...textInput, fontWeight: 700, letterSpacing: '.02em' }} />
        {matches.length > 0 && !matches.some(m => m.symbol === T) && (
          <div style={{ marginTop: 6, background: '#fff', borderRadius: 18, padding: '2px 14px' }}>
            {matches.map((m, i) => (
              <button key={m.symbol} onClick={() => { setTicker(m.symbol); setName(m.description); setCurrency(m.symbol.endsWith('.CO') ? 'COP' : 'USD'); setMatches([]); }}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 0', border: 0, borderBottom: `1px solid ${i === matches.length - 1 ? 'transparent' : LINE}`, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{m.symbol}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.description}</span>
              </button>
            ))}
          </div>
        )}
        {!t0 && <>
          <FieldLabel m="14px 4px 6px">Company name (optional)</FieldLabel>
          <input value={name} placeholder="Apple" onChange={e => setName(e.target.value)} style={textInput} />
        </>}
        <FieldLabel m="14px 4px 0">Priced in</FieldLabel>
        <Segmented items={[['USD', 'US dollars'], ['COP', 'Pesos (COP)']]} value={currency} onPick={c => { setCurrency(c); setPrice(''); }} mt={6} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Shares</span>
            <input type="text" inputMode="decimal" placeholder="0" value={qty} onChange={e => setQty(decInput(e.target.value))} style={{ ...textInput, fontWeight: 600, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Price per share</span>
            {priceField}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Fee (optional)</span>
            {currency === 'USD'
              ? <input type="text" inputMode="decimal" placeholder="0" value={fee} onChange={e => setFee(decInput(e.target.value))} style={{ ...textInput, fontWeight: 600, width: '100%' }} />
              : <MoneyInput value={fee} onChange={setFee} style={{ ...textInput, fontWeight: 600, width: '100%' }} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Date</span>
            <input type="date" value={date} max={todayISO()} onChange={e => setDate(e.target.value || todayISO())} style={{ ...textInput, fontWeight: 600, width: '100%', fontSize: 15 }} />
          </div>
        </div>
        <div style={{ margin: '14px 4px 0', fontSize: 13, color: tooMany ? RED : 'var(--color-neutral-700)' }}>
          {tooMany ? `You only have ${fmtQty(own?.qty ?? 0)} shares of ${T}.`
            : q > 0 && p > 0 ? `${side === 'buy' ? 'Total cost' : 'You receive'}: ${fmtNative(total, currency)}${currency === 'USD' && d.settings.currency === 'COP' ? ` ≈ ${fmt(toLocal(d.investments, total, 'USD'))}` : ''}`
            : 'Enter the shares and the price you paid per share.'}
        </div>
        <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-600)' }}>This only tracks the trade; it doesn't move money in your accounts.</span>
        <PrimaryBtn onClick={save} disabled={cant}>{side === 'buy' ? 'Save buy' : 'Save sell'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- One holding ---------------- */
export function HoldingSheet({ ticker }: { ticker: string }) {
  const { data: d } = useApp();
  const all = holdings(d), h = all.find(x => x.ticker === ticker);
  const trades = d.investments.trades.filter(t => t.ticker === ticker).sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : b.ts - a.ts));
  const q = d.investments.quotes[ticker];
  const [manual, setManual] = useState('');
  const [confirm, setConfirm] = useState<string | null>(null);
  const cur = h?.currency ?? trades[0]?.currency ?? 'USD';

  const setPrice = () => {
    const p = num(manual); if (!(p > 0)) return;
    setData(x => ({ investments: { ...x.investments, quotes: { ...x.investments.quotes, [ticker]: { ...(x.investments.quotes[ticker] || {}), price: p, change: 0, changePct: 0, at: Date.now(), manual: true } } } }));
    setManual(''); flash(`${ticker} price set to ${fmtNative(p, cur)}`);
  };
  const useLive = () => {
    setData(x => { const qs = { ...x.investments.quotes }; if (qs[ticker]) qs[ticker] = { ...qs[ticker], manual: false }; return { investments: { ...x.investments, quotes: qs } }; });
    refreshQuotes().then(r => flash(r.failed.includes(ticker) ? `No live price for ${ticker}` : 'Live price on'));
  };
  const delTrade = (id: string) => {
    if (confirm !== id) return setConfirm(id);
    setData(x => ({ investments: { ...x.investments, trades: x.investments.trades.filter(t => t.id !== id) } }));
    setConfirm(null); flash('Trade deleted');
    if (getData().investments.trades.every(t => t.ticker !== ticker)) closeSheet();
  };
  const stat = (l: string, v: string, col = TEXT) => (
    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: `1px solid ${LINE}`, fontSize: 14 }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{l}</span><span style={{ fontWeight: 700, color: col, whiteSpace: 'nowrap' }}>{v}</span>
    </div>
  );

  return (
    <SheetFrame title={ticker}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <TickerLogo h={{ ticker, quote: q }} size={52} color={colorOf(all, ticker)} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{h?.name || ticker}</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-0.03em' }}>{fmtNative(h?.price ?? q?.price ?? 0, cur)}</span>
            {q && !q.manual ? <span style={{ fontSize: 13, fontWeight: 700, color: q.change >= 0 ? UP : RED }}>{q.change >= 0 ? '+' : '−'}{fmtNative(Math.abs(q.change), cur)} ({q.changePct >= 0 ? '+' : ''}{q.changePct.toFixed(2).replace('.', ',')}%) today</span>
              : <span style={{ fontSize: 12, color: 'var(--color-neutral-600)' }}>{q?.manual ? 'Price typed in by you' : 'No live price yet'}</span>}
          </div>
        </div>
        {h && (
          <div style={{ marginTop: 14, background: '#fff', borderRadius: 22, padding: '2px 16px 6px' }}>
            {stat('Market value', fmt(h.valueLocal))}
            {stat('Shares', fmtQty(h.qty))}
            {stat('Average cost', fmtNative(h.avgCost, cur))}
            {stat('Invested', fmt(h.investedLocal))}
            {stat('Return', `${h.gain >= 0 ? '+' : '−'}${fmt(Math.abs(h.gainLocal))} (${(h.gainPct * 100).toFixed(2).replace('.', ',')}%)`, h.gain >= 0 ? UP : RED)}
            {h.realized !== 0 && stat('Realized from sells', fmtNative(h.realized, cur), h.realized >= 0 ? UP : RED)}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
          <button onClick={() => openSheet({ name: 'trade', ticker, side: 'buy' })} className="hv-acc600" style={{ height: 50, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Buy more</button>
          <button onClick={() => openSheet({ name: 'trade', ticker, side: 'sell' })} disabled={!h} className="hv-n200" style={{ height: 50, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: h ? 1 : 0.45 }}>Sell</button>
        </div>

        <FieldLabel m="16px 4px 6px">Set the price yourself</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          {cur === 'USD'
            ? <input type="text" inputMode="decimal" placeholder={q ? String(q.price) : '0.00'} value={manual} onChange={e => setManual(decInput(e.target.value))} style={{ ...textInput, flex: 1, fontWeight: 600 }} />
            : <MoneyInput value={manual} onChange={setManual} style={{ ...textInput, flex: 1, fontWeight: 600 }} />}
          <button onClick={setPrice} disabled={!(num(manual) > 0)} style={{ height: 52, padding: '0 18px', borderRadius: 18, border: 0, background: TEXT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', opacity: num(manual) > 0 ? 1 : 0.45 }}>Set</button>
        </div>
        <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>
          Useful for Colombian stocks or funds without a live price. {q?.manual && d.settings.finnhubKey && <button onClick={useLive} style={{ border: 0, padding: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Use live price again</button>}
        </span>

        <FieldLabel>Trades</FieldLabel>
        <div style={{ background: '#fff', borderRadius: 22, padding: '2px 16px' }}>
          {trades.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: `1px solid ${i === trades.length - 1 ? 'transparent' : LINE}` }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{t.side === 'buy' ? 'Bought' : 'Sold'} {fmtQty(t.qty)} × {fmtNative(t.price, t.currency)}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{t.date}{t.fee ? ` · fee ${fmtNative(t.fee, t.currency)}` : ''}</span>
              </div>
              <button onClick={() => delTrade(t.id)} style={{ border: 0, background: confirm === t.id ? 'var(--color-accent-100)' : 'transparent', color: 'var(--color-accent-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: '6px 10px', borderRadius: 999 }}>{confirm === t.id ? 'Tap to delete' : 'Delete'}</button>
            </div>
          ))}
        </div>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Price data settings ---------------- */
export function PriceSettingsSheet() {
  const { data: d } = useApp();
  const inv = d.investments;
  const [key, setKey] = useState(d.settings.finnhubKey ?? '');
  const [rate, setRate] = useState(String(Math.round(inv.usdRate)));
  const [testing, setTesting] = useState(false);
  const saveKey = async () => {
    setData(x => ({ settings: { ...x.settings, finnhubKey: key.trim() || undefined } }));
    if (!key.trim()) { flash('Live prices off'); return; }
    setTesting(true);
    const r = await refreshQuotes();
    setTesting(false);
    flash(r.error === 'key' ? 'Finnhub rejected that key' : r.error === 'limit' ? 'Key saved. Finnhub says to wait a minute.' : 'Key saved. Prices are live.');
  };
  return (
    <SheetFrame title="Prices">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px', fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>
          Live prices come from Finnhub. Create a free account at <a href="https://finnhub.io/register" target="_blank" rel="noreferrer">finnhub.io</a>, copy your API key from the dashboard and paste it here. It stays on this phone. US stocks and ETFs update during market hours; others you can price yourself.
        </span>
        <FieldLabel m="14px 4px 6px">Finnhub API key</FieldLabel>
        <input value={key} onChange={e => setKey(e.target.value.trim())} placeholder="Paste your key" autoCapitalize="off" autoCorrect="off" spellCheck={false} style={{ ...textInput, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 14 }} />
        <PrimaryBtn onClick={saveKey} disabled={testing} mt={12} h={50} fs={15}>{testing ? 'Checking…' : 'Save key'}</PrimaryBtn>

        {d.settings.currency === 'COP' && <>
          <FieldLabel m="20px 4px 6px">Dollar rate (1 USD in COP)</FieldLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <MoneyInput value={rate} onChange={setRate} style={{ ...textInput, flex: 1, fontWeight: 600 }} />
            <button onClick={() => { const r = num(rate); if (r > 0) { setData(x => ({ investments: { ...x.investments, usdRate: r, usdManual: true, usdRateAt: Date.now() } })); flash('Dollar rate set'); } }} style={{ height: 52, padding: '0 18px', borderRadius: 18, border: 0, background: TEXT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Set</button>
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>
            {inv.usdManual ? 'Using your rate. ' : 'Updated automatically a few times a day. '}
            {inv.usdManual && <button onClick={() => { setData(x => ({ investments: { ...x.investments, usdManual: false } })); refreshUsdRate(true).then(() => setRate(String(Math.round(getData().investments.usdRate)))); }} style={{ border: 0, padding: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Update automatically</button>}
          </span>
        </>}
        {d.settings.finnhubKey && <GhostDanger onClick={() => { setKey(''); setData(x => ({ settings: { ...x.settings, finnhubKey: undefined } })); flash('Key removed'); }}>Remove key</GhostDanger>}
      </div>
    </SheetFrame>
  );
}
