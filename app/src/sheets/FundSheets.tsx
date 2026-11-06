// Investment funds: add or edit a fund, see one in detail, and add money, take money out or update the balance.
import { useState } from 'react';
import { useApp, setData, closeSheet, openSheet, flash } from '../lib/store';
import { LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { fmt, num } from '../lib/derive';
import { fmtDay, todayISO } from '../lib/dates';
import { FUND_KINDS, KIND_HUE, KIND_LABEL, MANAGERS, RISK_FOR, RISK_LABEL, addFund, addFundMove, closeFund, deleteFund, deleteFundMove, fundView, fundsOf, localValue, updateFund } from '../lib/funds';
import type { Fund, FundKind, FundMove, FundRisk } from '../lib/types';
import { FieldLabel, GhostDanger, PrimaryBtn, Segmented, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SheetFrame } from './Sheet';
import { STARS, moneyHidden } from '../lib/privacy';

const UP = 'oklch(0.5 0.12 150)', DOWN = 'var(--color-accent-700)';
const pct = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '%';
const chip = (on: boolean) => ({ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, flex: 'none' as const, boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--color-neutral-200)' });
const half = { display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 } as const;
const small = (label: string) => <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{label}</span>;
const curOf = (d: { settings: { currency: string } }, f: { currency: 'COP' | 'USD' }) => (f.currency === 'USD' ? 'US$' : d.settings.currency === 'COP' ? '$' : d.settings.currency);
const money = (sym: string, n: number) => (moneyHidden() ? (sym === 'US$' ? 'US$' : '$') + STARS : sym === 'US$' ? `US$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : fmt(n));

function Money({ value, onChange, sym, label }: { value: string; onChange: (v: string) => void; sym: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: 'var(--surface)', borderRadius: 18, padding: '13px 16px' }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--color-neutral-400)' }}>{sym}</span>
      <MoneyInput value={value} onChange={onChange} ariaLabel={label} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
    </div>
  );
}
function Pct({ value, onChange, label, ph }: { value: string; onChange: (v: string) => void; label: string; ph: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: 'var(--surface)', borderRadius: 18, padding: '13px 16px' }}>
      <input type="text" inputMode="decimal" placeholder={ph} value={value} aria-label={label} onChange={e => onChange(e.target.value.replace(/[^\d.,-]/g, ''))}
        style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-neutral-400)' }}>%</span>
    </div>
  );
}
const dateInput = (v: string, on: (v: string) => void, label: string) => <input type="date" value={v} max={todayISO()} onChange={e => on(e.target.value || todayISO())} aria-label={label} style={{ ...textInput, fontWeight: 600 }} />;
const pnum = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };

/* ---------------- Add or edit a fund ---------------- */
export function FundSheet({ id }: { id: string | null }) {
  const { data: d } = useApp();
  const old = id ? fundsOf(d).find(f => f.id === id) : undefined;
  const banks = d.accounts.filter(a => a.type !== 'card');
  const [name, setName] = useState(old?.name ?? '');
  const [manager, setManager] = useState(old?.manager ?? '');
  const [kind, setKind] = useState<FundKind>(old?.kind ?? 'vista');
  const [risk, setRisk] = useState<FundRisk>(old?.risk ?? 'low');
  const [riskTouched, setRiskTouched] = useState(!!old);
  const [currency, setCurrency] = useState<'COP' | 'USD'>(old?.currency ?? 'COP');
  const [rate, setRate] = useState(old?.rate != null ? String(old.rate) : '');
  const [fee, setFee] = useState(old?.fee != null ? String(old.fee) : '');
  const [liquidity, setLiquidity] = useState<'vista' | 'lock'>(old?.liquidity ?? 'vista');
  const [lockDays, setLockDays] = useState(old?.lockDays ? String(old.lockDays) : '');
  const [settle, setSettle] = useState(old?.settleDays != null ? String(old.settleDays) : '');
  const [minAmt, setMinAmt] = useState(old?.minAmount ? String(old.minAmount) : '');
  const [units, setUnits] = useState(old?.units ? String(old.units) : '');
  const [notes, setNotes] = useState(old?.notes ?? '');
  const [start, setStart] = useState(old?.start ?? todayISO());
  // New fund: the first money in, and (optional) today's balance from a statement.
  const [amt, setAmt] = useState('');
  const [acct, setAcct] = useState('');
  const [stmt, setStmt] = useState('');
  const [stmtDate, setStmtDate] = useState(todayISO());
  const [confirmDel, setConfirmDel] = useState(false);
  const sym = currency === 'USD' ? 'US$' : '$';
  const cant = !name.trim() || (!old && !(num(amt) > 0) && !(num(stmt) > 0));
  const pickKind = (k: FundKind) => { setKind(k); if (!riskTouched) setRisk(RISK_FOR[k]); };

  const save = () => {
    if (cant) return;
    const info = {
      name: name.trim(), manager: manager.trim(), kind, risk, currency, hue: old?.hue ?? KIND_HUE[kind],
      rate: pnum(rate), fee: pnum(fee), liquidity, lockDays: liquidity === 'lock' ? Math.max(0, Math.round(num(lockDays))) || undefined : undefined,
      settleDays: settle ? Math.max(0, Math.round(num(settle))) : undefined, minAmount: num(minAmt) || undefined, units: pnum(units), notes: notes.trim() || undefined, start
    };
    const clean = JSON.parse(JSON.stringify(info));
    if (old) { setData(x => updateFund(x, { ...old, ...clean } as Fund)); openSheet({ name: 'fundInfo', id: old.id }); flash('Fund updated'); return; }
    setData(x => addFund(x, clean, num(amt) > 0 ? { amt: num(amt), date: start, acct: acct || undefined } : null, num(stmt) > 0 ? { amt: num(stmt), date: stmtDate } : null));
    closeSheet(); flash(`${info.name} added${acct ? ` · ${fmt(localValue(d, info as Fund, num(amt)))} from ${banks.find(b => b.id === acct)?.name}` : ''}`);
  };

  return (
    <SheetFrame title={old ? 'Edit fund' : 'New investment fund'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <FieldLabel m="4px 4px 6px">Fund name</FieldLabel>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Fiducuenta" aria-label="Fund name" style={textInput} />
        <FieldLabel m="14px 4px 6px">Managed by</FieldLabel>
        <input value={manager} onChange={e => setManager(e.target.value)} placeholder="Fiduciaria Bancolombia" aria-label="Fund manager" style={textInput} />
        <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '8px -20px 0', padding: '0 20px' }}>
          {MANAGERS.map(m => <button key={m} onClick={() => setManager(m)} style={chip(manager === m)}>{m}</button>)}
        </div>

        <FieldLabel m="16px 4px 6px">Type of fund</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 6 }}>
          {FUND_KINDS.map(([k, label, sub]) => {
            const on = kind === k;
            return (
              <button key={k} onClick={() => pickKind(k)} aria-pressed={on} style={{ textAlign: 'left', border: 0, borderRadius: 16, padding: '10px 12px', cursor: 'pointer', background: on ? tint(KIND_HUE[k]) : 'var(--surface)', color: on ? ink(KIND_HUE[k]) : TEXT, boxShadow: on ? `inset 0 0 0 2px ${ink(KIND_HUE[k])}` : 'none', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
                {sub && <span style={{ fontSize: 11.5, lineHeight: 1.3, opacity: 0.8 }}>{sub}</span>}
              </button>
            );
          })}
        </div>

        <FieldLabel m="16px 4px 0">Risk profile</FieldLabel>
        <Segmented items={[['low', RISK_LABEL.low], ['medium', RISK_LABEL.medium], ['high', RISK_LABEL.high]]} value={risk} onPick={r => { setRisk(r); setRiskTouched(true); }} mt={6} />
        {d.settings.currency === 'COP' && <>
          <FieldLabel m="14px 4px 0">Currency</FieldLabel>
          <Segmented items={[['COP', 'Pesos'], ['USD', 'Dollars']]} value={currency} onPick={setCurrency} mt={6} />
        </>}

        {!old && <>
          <FieldLabel m="16px 4px 6px">How much did you put in?</FieldLabel>
          <Money value={amt} onChange={setAmt} sym={sym} label="Amount invested" />
          <div style={{ ...half, marginTop: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Date')}{dateInput(start, setStart, 'Date invested')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Taken from')}
              <select value={acct} onChange={e => setAcct(e.target.value)} aria-label="Taken from account" style={{ ...textInput, fontWeight: 600 }}>
                <option value="">Not from an account</option>
                {banks.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{acct ? `This amount leaves ${banks.find(b => b.id === acct)?.name} and goes into the fund.` : 'For a fund you already had: your accounts don\'t change.'}</span>

          <FieldLabel m="16px 4px 6px">Balance on your latest statement (optional)</FieldLabel>
          <div style={half}>
            <Money value={stmt} onChange={setStmt} sym={sym} label="Statement balance" />
            {dateInput(stmtDate, setStmtDate, 'Statement date')}
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>What the fund's app or extract says your money is worth now. Pockets uses it to show your real gain.</span>
        </>}

        <div style={{ ...half, marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Yearly return (E.A.)')}<Pct value={rate} onChange={setRate} label="Yearly return" ph="9,5" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Management fee')}<Pct value={fee} onChange={setFee} label="Management fee" ph="1,5" /></div>
        </div>
        <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Use the net return from the fund's fact sheet (ficha técnica), for example the last 30 days or 1 year. Between statements, Pockets estimates your balance with it. The fee is already taken out of that return.</span>

        <FieldLabel m="16px 4px 0">Withdrawals</FieldLabel>
        <Segmented items={[['vista', 'Any day'], ['lock', 'Minimum stay']]} value={liquidity} onPick={setLiquidity} mt={6} />
        <div style={{ ...half, marginTop: 8 }}>
          {liquidity === 'lock' && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Minimum stay (days)')}<input inputMode="numeric" value={lockDays} onChange={e => setLockDays(e.target.value.replace(/\D/g, ''))} placeholder="90" aria-label="Minimum stay in days" style={{ ...textInput, fontWeight: 600 }} /></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Money arrives in (days)')}<input inputMode="numeric" value={settle} onChange={e => setSettle(e.target.value.replace(/\D/g, ''))} placeholder="1" aria-label="Business days to receive a withdrawal" style={{ ...textInput, fontWeight: 600 }} /></div>
        </div>
        <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{liquidity === 'lock' ? 'Pacto de permanencia: taking money out before this usually has a penalty.' : 'On-demand funds let you take money out any business day.'}</span>

        <div style={{ ...half, marginTop: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Minimum to invest')}<Money value={minAmt} onChange={setMinAmt} sym={sym} label="Minimum to invest" /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Units you own')}<input inputMode="decimal" value={units} onChange={e => setUnits(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Optional" aria-label="Units owned" style={{ ...textInput, fontWeight: 600 }} /></div>
        </div>
        {old && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>{small('Opened on')}{dateInput(start, setStart, 'Opened on')}</div>}
        <FieldLabel m="14px 4px 6px">Notes</FieldLabel>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Account number, goal, contact…" aria-label="Notes" style={{ ...textInput, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.4 }} />

        <PrimaryBtn onClick={save} disabled={cant} mt={18}>{old ? 'Save changes' : 'Add fund'}</PrimaryBtn>
        {!old && cant && name.trim() && <span style={{ margin: '8px 4px 0', fontSize: 12, textAlign: 'center', color: 'var(--color-neutral-600)' }}>Type how much you put in or your current balance.</span>}
        {old && <GhostDanger onClick={() => { if (!confirmDel) { setConfirmDel(true); return; } setData(x => deleteFund(x, old.id)); closeSheet(); flash(`${old.name} deleted · money moved back to your accounts`); }}>{confirmDel ? 'Tap again to delete (undoes its account moves)' : 'Delete fund'}</GhostDanger>}
      </div>
    </SheetFrame>
  );
}

/* ---------------- One fund in detail ---------------- */
const MOVE_LABEL: Record<FundMove['kind'], string> = { in: 'Added money', out: 'Took money out', value: 'Balance from statement' };

export function FundInfoSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const f = fundsOf(d).find(x => x.id === id);
  const [open, setOpen] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const banks = d.accounts.filter(a => a.type !== 'card');
  const [to, setTo] = useState(banks[0]?.id ?? '');
  if (!f) return null;
  const v = fundView(f), sym = curOf(d, f), k = ink(f.hue);
  const today = todayISO(), locked = v.freeFrom && v.freeFrom > today;
  const facts: [string, string][] = [
    ['Type', KIND_LABEL[f.kind]], ['Risk', RISK_LABEL[f.risk]], ...(f.manager ? [['Manager', f.manager] as [string, string]] : []),
    ...(f.rate != null ? [['Yearly return', `${pct(f.rate)} E.A.`] as [string, string]] : []), ...(f.fee != null ? [['Management fee', `${pct(f.fee)} a year`] as [string, string]] : []),
    ['Withdrawals', f.liquidity === 'lock' ? (v.freeFrom ? `Locked until ${fmtDay(v.freeFrom, { month: 'short', day: 'numeric', year: 'numeric' })}` : 'Minimum stay') : 'Any day'],
    ...(f.settleDays != null ? [['Money arrives in', f.settleDays === 0 ? 'The same day' : `${f.settleDays} business day${f.settleDays === 1 ? '' : 's'}`] as [string, string]] : []),
    ...(f.minAmount ? [['Minimum to invest', money(sym, f.minAmount)] as [string, string]] : []),
    ...(f.units ? [['Units', f.units.toLocaleString('es-CO', { maximumFractionDigits: 4 })] as [string, string], ['Unit value (approx.)', money(sym, v.value / f.units)] as [string, string]] : []),
    ['Opened', fmtDay(f.start, { month: 'short', day: 'numeric', year: 'numeric' })], ['Currency', f.currency === 'USD' ? 'Dollars' : 'Pesos']
  ];
  const moves = [...f.moves].sort((a, b) => (b.date > a.date ? 1 : b.date < a.date ? -1 : 0));
  const btn = { flex: 1, height: 44, borderRadius: 999, border: 0, background: 'var(--surface)', color: k, fontSize: 14, fontWeight: 700, cursor: 'pointer' } as const;

  return (
    <SheetFrame title={f.name}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: tint(f.hue), borderRadius: 26, padding: 18, display: 'flex', flexDirection: 'column', gap: 4, color: k }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{f.closed ? `Closed ${fmtDay(f.closed, { month: 'short', day: 'numeric' })}` : v.estimated ? 'Estimated value today' : 'Value'}</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{f.closed ? money(sym, 0) : `${v.estimated ? '≈ ' : ''}${money(sym, v.value)}`}</span>
          {sym === 'US$' && !f.closed && <span style={{ fontSize: 13 }}>≈ {fmt(localValue(d, f, v.value))}</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: v.gain >= 0 ? k : DOWN }}>{v.gain >= 0 ? '+' : '−'}{money(sym, Math.abs(v.gain))} ({(v.gainPct * 100).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%) on {money(sym, v.invested)} put in</span>
          <span style={{ fontSize: 12, lineHeight: 1.4, marginTop: 4 }}>{v.lastValue ? `Last statement: ${money(sym, v.lastValue.amt)} on ${fmtDay(v.lastValue.date, { month: 'short', day: 'numeric' })}${v.daysSince > 0 && f.rate ? `, grown ${v.daysSince} days at ${pct(f.rate)}` : ''}.` : f.rate ? `Estimated from what you put in at ${pct(f.rate)} E.A. Update the balance from your statement for the exact amount.` : 'Add the balance from your statement to see your gain.'}</span>
          {!f.closed && <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={() => openSheet({ name: 'fundMove', id: f.id, kind: 'in' })} className="hv-w75" style={btn}>Add money</button>
            <button onClick={() => openSheet({ name: 'fundMove', id: f.id, kind: 'out' })} className="hv-w75" style={btn}>Withdraw</button>
            <button onClick={() => openSheet({ name: 'fundMove', id: f.id, kind: 'value' })} className="hv-w75" style={btn}>Update</button>
          </div>}
          {locked && !f.closed && <span style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>⏳ Minimum stay until {fmtDay(v.freeFrom!, { month: 'short', day: 'numeric' })}: withdrawing before may have a penalty.</span>}
        </div>

        <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '6px 16px' }}>
          {facts.map(([l, val], i) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '9px 0', borderBottom: `1px solid ${i === facts.length - 1 ? 'transparent' : LINE}`, fontSize: 14 }}>
              <span style={{ color: 'var(--color-neutral-700)' }}>{l}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{val}</span>
            </div>
          ))}
        </div>
        {f.notes && <div style={{ marginTop: 10, background: 'var(--surface)', borderRadius: 18, padding: '12px 16px', fontSize: 14, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{f.notes}</div>}

        <FieldLabel m="16px 4px 6px">History</FieldLabel>
        <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '2px 16px' }}>
          {moves.map((m, i) => (
            <div key={m.id} style={{ borderBottom: `1px solid ${i === moves.length - 1 ? 'transparent' : LINE}` }}>
              <button onClick={() => setOpen(open === m.id ? null : m.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', border: 0, background: 'transparent', color: TEXT, cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14.5, fontWeight: 600 }}>{m.note === 'Closed' ? 'Closed the fund' : MOVE_LABEL[m.kind]}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{fmtDay(m.date, { month: 'short', day: 'numeric', year: 'numeric' })}{m.acct ? ` · ${m.kind === 'in' ? 'from' : 'to'} ${d.accounts.find(a => a.id === m.acct)?.name ?? 'an account'}` : ''}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700, color: m.kind === 'in' ? UP : m.kind === 'out' ? DOWN : TEXT }}>{m.kind === 'in' ? '+' : m.kind === 'out' ? '−' : '='}{money(sym, m.amt)}</span>
              </button>
              {open === m.id && <button onClick={() => { setData(x => deleteFundMove(x, f.id, m.id)); setOpen(null); flash(m.acct ? 'Removed · your account was corrected' : 'Removed'); }} style={{ marginBottom: 10, height: 36, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-accent-100)', color: RED, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Remove this entry</button>}
            </div>
          ))}
        </div>

        <button onClick={() => openSheet({ name: 'fund', id: f.id })} className="hv-n200" style={{ marginTop: 14, height: 50, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Edit fund details</button>
        {!f.closed && (!closing
          ? <button onClick={() => setClosing(true)} style={{ marginTop: 8, height: 46, borderRadius: 999, border: 0, background: 'transparent', color: RED, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Close the fund (take everything out)</button>
          : <div style={{ marginTop: 10, background: 'var(--surface)', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 14, lineHeight: 1.4 }}>Take out about <b>{money(sym, v.value)}</b> and close {f.name}?{locked ? ' It\'s still in its minimum stay, so check for a penalty.' : ''}</span>
              <select value={to} onChange={e => setTo(e.target.value)} aria-label="Send the money to" style={{ ...textInput, fontWeight: 600 }}>
                {banks.map(a => <option key={a.id} value={a.id}>To {a.name}</option>)}
                <option value="">Don't add it to an account</option>
              </select>
              <PrimaryBtn onClick={() => { setData(x => closeFund(x, f.id, to || undefined)); closeSheet(); flash(`${f.name} closed`); }} mt={4} h={48} fs={15}>Close fund</PrimaryBtn>
              <button onClick={() => setClosing(false)} style={{ height: 38, border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>)}
      </div>
    </SheetFrame>
  );
}

/* ---------------- Add money, withdraw, or update the balance ---------------- */
export function FundMoveSheet({ id, kind }: { id: string; kind: FundMove['kind'] }) {
  const { data: d } = useApp();
  const f = fundsOf(d).find(x => x.id === id);
  const banks = d.accounts.filter(a => a.type !== 'card');
  const [amt, setAmt] = useState('');
  const [date, setDate] = useState(todayISO());
  const [acct, setAcct] = useState(kind === 'value' ? '' : banks.find(a => a.type === 'bank')?.id ?? banks[0]?.id ?? '');
  if (!f) return null;
  const v = fundView(f), sym = curOf(d, f), a = num(amt);
  const tooMuch = kind === 'out' && a > v.value * 1.02 + 1;
  const title = kind === 'in' ? `Add money to ${f.name}` : kind === 'out' ? `Withdraw from ${f.name}` : 'Update the balance';
  const save = () => {
    if (!(a > 0) || tooMuch) return;
    setData(x => addFundMove(x, f.id, { date, kind, amt: a, ...(acct && kind !== 'value' ? { acct } : {}) }));
    openSheet({ name: 'fundInfo', id: f.id });
    flash(kind === 'value' ? 'Balance updated' : kind === 'in' ? `Added ${money(sym, a)}` : `Withdrew ${money(sym, a)}`);
  };
  return (
    <SheetFrame title={title}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px 10px', fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>
          {kind === 'value' ? `Type what your statement or the fund's app says ${f.name} is worth. Right now Pockets estimates ${money(sym, v.value)}.` : kind === 'in' ? 'A new contribution (aporte) to the fund.' : `A withdrawal (retiro). About ${money(sym, v.value)} is in the fund.`}
        </span>
        <Money value={amt} onChange={setAmt} sym={sym} label="Amount" />
        {tooMuch && <span style={{ margin: '6px 4px 0', fontSize: 12.5, color: RED }}>That's more than the fund has.</span>}
        <div style={{ ...half, marginTop: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small('Date')}{dateInput(date, setDate, 'Date')}</div>
          {kind !== 'value' && <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{small(kind === 'in' ? 'Taken from' : 'Sent to')}
            <select value={acct} onChange={e => setAcct(e.target.value)} aria-label={kind === 'in' ? 'Taken from account' : 'Sent to account'} style={{ ...textInput, fontWeight: 600 }}>
              {banks.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
              <option value="">No account (just record it)</option>
            </select>
          </div>}
        </div>
        {kind !== 'value' && acct && <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>{banks.find(x => x.id === acct)?.name} {kind === 'in' ? 'goes down' : 'goes up'} by {fmt(localValue(d, f, a))}.</span>}
        <PrimaryBtn onClick={save} disabled={!(a > 0) || tooMuch} mt={16}>{kind === 'value' ? 'Save balance' : kind === 'in' ? 'Add money' : 'Withdraw'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}
