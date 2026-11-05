import { useState } from 'react';
import { useApp, setData, closeSheet, openSheet, flash, getData } from '../lib/store';
import { LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { fmt, num } from '../lib/derive';
import { addDays, fmtDay, todayISO } from '../lib/dates';
import { OFFERS, OFFERS_AS_OF, PAYOUT_LABEL, WITHHOLD, addCdt, cashOutCdt, cdtView, cdtsOf, deleteCdt, hueFor, newCdtId, payouts, renewCdt, updateCdt, type Term } from '../lib/cdt';
import type { Cdt, CdtPayout } from '../lib/types';
import { Bar, FieldLabel, GhostDanger, PrimaryBtn, Segmented, Toggle, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SheetFrame } from './Sheet';

const UP = 'oklch(0.5 0.12 150)';
const pct = (n: number) => n.toLocaleString('es-CO', { maximumFractionDigits: 2 }) + '%';
const longDate = (s: string) => fmtDay(s, { month: 'short', day: 'numeric', year: 'numeric' });
const rateInput = (v: string) => v.replace('.', ',').replace(/[^\d,]/g, '').replace(/(,.*),/g, '$1').replace(/(,\d{2}).+/, '$1');
const TERMS = [90, 180, 360, 540, 720];
const termTxt = (days: number) => (days % 360 === 0 ? `${days / 360} year${days > 360 ? 's' : ''}` : days % 30 === 0 ? `${days / 30} months` : `${days} days`);

export function CdtBadge({ bank, hue, size = 40 }: { bank: string; hue: number; size?: number }) {
  return <span style={{ width: size, height: size, borderRadius: size * 0.32, background: tint(hue), color: ink(hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: size * 0.4, flex: 'none' }}>{bank.trim().charAt(0).toUpperCase() || 'C'}</span>;
}

const chip = (on: boolean) => ({ height: 36, padding: '0 13px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, flex: 'none' as const });
const row = (l: string, v: string, col = TEXT, last = false) => (
  <div key={l} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: `1px solid ${last ? 'transparent' : LINE}`, fontSize: 14 }}>
    <span style={{ color: 'var(--color-neutral-700)' }}>{l}</span><span style={{ fontWeight: 700, color: col, whiteSpace: 'nowrap', textAlign: 'right' }}>{v}</span>
  </div>
);

/* ---------------- New or edit ---------------- */
export function CdtSheet({ id }: { id: string | null }) {
  const { data: d } = useApp();
  const old = id ? cdtsOf(d).find(c => c.id === id) : undefined;
  const banks = d.accounts.filter(a => a.type !== 'card');
  const [view, setView] = useState<'popular' | 'custom'>(old ? 'custom' : 'popular');
  const [bank, setBank] = useState(old?.bank ?? '');
  const [amt, setAmt] = useState(old ? String(Math.round(old.amount)) : '');
  const [rate, setRate] = useState(old ? String(old.rate).replace('.', ',') : '');
  const [days, setDays] = useState(old?.days ?? 360);
  const [customDays, setCustomDays] = useState(old && !TERMS.includes(old.days) ? String(old.days) : '');
  const [start, setStart] = useState(old?.start ?? todayISO());
  const [payout, setPayout] = useState<CdtPayout>(old?.payout ?? 'end');
  const [withholding, setWithholding] = useState(old?.withholding ?? true);
  const [acct, setAcct] = useState(old ? old.acct ?? '' : banks.find(a => a.type === 'bank')?.id ?? banks[0]?.id ?? '');
  const [fund, setFund] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  const r = num(rate.replace(',', '.')), a = num(amt), term = customDays ? Math.round(num(customDays)) : days;
  const cant = !bank.trim() || !(a > 0) || !(r > 0) || r > 40 || !(term >= 1) || term > 3650;
  const draft: Cdt = { id: old?.id ?? 'draft', ts: old?.ts ?? Date.now(), bank: bank.trim(), amount: a, rate: r, days: term, start, payout, withholding, acct: acct || undefined, hue: old?.hue ?? hueFor(bank), paid: old?.paid, renewedFrom: old?.renewedFrom };
  const v = !cant ? cdtView(draft, start) : null;
  const ps = !cant ? payouts(draft) : [];
  const fundAcct = banks.find(x => x.id === acct);
  const short = !old && fund && fundAcct && fundAcct.bal < a;

  const pick = (bankName: string, t: Term, rt: number) => {
    setBank(bankName); setRate(String(rt).replace('.', ',')); setDays(t); setCustomDays(''); setPicked(`${bankName} · ${t} days`); setView('custom');
  };
  const save = () => {
    if (cant) return;
    const c: Cdt = { ...draft, id: old?.id ?? newCdtId(), hue: old?.hue ?? hueFor(bank) };
    if (old) { setData(x => updateCdt(x, c)); flash('CDT updated'); openSheet({ name: 'cdtInfo', id: c.id }); return; }
    setData(x => addCdt(x, c, fund && !!acct));
    flash(fund && fundAcct ? `CDT opened · −${fmt(a)} from ${fundAcct.name}` : 'CDT added');
    openSheet({ name: 'cdtInfo', id: c.id });
  };

  return (
    <SheetFrame title={old ? 'Edit CDT' : 'New CDT'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {!old && <Segmented items={[['popular', 'Popular CDTs'], ['custom', 'Custom']]} value={view} onPick={setView} mt={6} />}

        {view === 'popular' ? (
          <>
            <span style={{ margin: '14px 4px 8px', fontSize: 13, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Pick a bank and a term to fill in the details. Then type the amount and check the rate with the bank before you open it.</span>
            <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '2px 14px' }}>
              {OFFERS.map((o, i) => (
                <div key={o.bank} style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 0', borderBottom: `1px solid ${i === OFFERS.length - 1 ? 'transparent' : LINE}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CdtBadge bank={o.bank} hue={o.hue} size={34} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: 15, fontWeight: 700 }}>{o.bank}</span>
                      {o.min && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>From {fmt(o.min)}</span>}
                    </div>
                    {i === 0 && <span style={{ fontSize: 11, fontWeight: 800, padding: '4px 8px', borderRadius: 999, background: 'oklch(0.95 0.045 155)', color: 'oklch(0.42 0.09 155)' }}>Best rate</span>}
                  </div>
                  <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                    {([90, 180, 360] as Term[]).filter(t => o.rates[t]).map(t => (
                      <button key={t} onClick={() => pick(o.bank, t, o.rates[t]!)} className="hv-n200" style={{ height: 40, padding: '0 12px', borderRadius: 14, border: 0, background: 'var(--color-neutral-100)', color: TEXT, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', flex: 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{t} days</span>
                        <span style={{ fontSize: 14, fontWeight: 800 }}>{pct(o.rates[t]!)} E.A.</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <span style={{ margin: '10px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-600)' }}>Reference rates from {OFFERS_AS_OF}, taken from Superintendencia Financiera reports and CDT comparison sites. Banks change their rates every week and they depend on the amount, so confirm the rate before investing.</span>
            <button onClick={() => setView('custom')} className="hv-n200" style={{ marginTop: 14, height: 50, borderRadius: 999, border: '2px dashed var(--color-neutral-400)', background: 'transparent', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>My bank isn't here · custom CDT</button>
          </>
        ) : (
          <>
            {picked && <div style={{ marginTop: 12, background: 'oklch(0.95 0.045 155)', borderRadius: 16, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, color: 'oklch(0.36 0.08 155)' }}>Filled in from <b>{picked}</b>. Rates are from {OFFERS_AS_OF}: change the rate if your bank offers you a different one.</div>}
            <FieldLabel m="14px 4px 6px">Bank or entity</FieldLabel>
            <input value={bank} onChange={e => setBank(e.target.value)} placeholder="Bancolombia, Pibank…" list="cdt-banks" style={textInput} />
            <datalist id="cdt-banks">{OFFERS.map(o => <option key={o.bank} value={o.bank} />)}</datalist>
            <FieldLabel m="14px 4px 6px">Amount</FieldLabel>
            <div style={{ ...textInput, display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-400)' }}>$</span>
              <MoneyInput value={amt} onChange={setAmt} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
            </div>
            <FieldLabel m="14px 4px 6px">Annual rate</FieldLabel>
            <div style={{ ...textInput, display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <input type="text" inputMode="decimal" placeholder="11,8" value={rate} onChange={e => setRate(rateInput(e.target.value))} aria-label="Annual rate" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-neutral-400)' }}>% E.A.</span>
            </div>
            <FieldLabel m="14px 4px 6px">Term</FieldLabel>
            <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {TERMS.map(t => <button key={t} onClick={() => { setDays(t); setCustomDays(''); }} style={chip(!customDays && days === t)}>{t} days</button>)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <input type="text" inputMode="numeric" placeholder="Other: number of days" value={customDays} onChange={e => setCustomDays(e.target.value.replace(/\D/g, '').slice(0, 4))} aria-label="Term in days" style={{ ...textInput, flex: 1, padding: '12px 16px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginTop: 14 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Opened on</span>
                <input type="date" value={start} onChange={e => setStart(e.target.value || todayISO())} style={{ ...textInput, fontWeight: 600, width: '100%', fontSize: 16, minHeight: 52, WebkitAppearance: 'none', appearance: 'none' }} />
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Matures on</span>
                <span style={{ ...textInput, fontWeight: 700, minHeight: 52, boxSizing: 'border-box', display: 'flex', alignItems: 'center', background: 'var(--color-neutral-100)' }}>{term >= 1 ? longDate(addDays(start, term)) : '—'}</span>
              </div>
            </div>
            <FieldLabel m="14px 4px 6px">Interest is paid</FieldLabel>
            <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {(Object.keys(PAYOUT_LABEL) as CdtPayout[]).map(k => <button key={k} onClick={() => setPayout(k)} style={chip(payout === k)}>{PAYOUT_LABEL[k]}</button>)}
            </div>
            <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>Withhold 4% of the interest</span>
                  <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>Retención en la fuente. Banks in Colombia keep it from CDT interest; you can claim it back in your tax return.</span>
                </span>
                <Toggle on={withholding} onChange={setWithholding} label="Withhold 4%" />
              </div>
              <div style={{ height: 1, background: LINE }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 700 }}>Linked account</span>
                  <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>{payout === 'end' ? 'Where the money goes back at maturity.' : 'Interest lands here on each payment day.'}</span>
                </span>
                <select aria-label="Linked account" value={acct} onChange={e => setAcct(e.target.value)} style={{ maxWidth: 150, height: 38, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', fontWeight: 700, padding: '0 8px', color: TEXT, fontSize: 14 }}>
                  <option value="">None</option>
                  {banks.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              {!old && acct && <>
                <div style={{ height: 1, background: LINE }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 700 }}>Take the money from {fundAcct?.name}</span>
                    <span style={{ fontSize: 12, lineHeight: 1.35, color: short ? RED : 'var(--color-neutral-700)' }}>{short ? `${fundAcct!.name} only has ${fmt(fundAcct!.bal)}.` : fund ? `${fmt(a || 0)} moves out of ${fundAcct?.name} into the CDT. It's not counted as spending.` : 'Turn on if the money for this CDT left that account and you haven\'t logged it.'}</span>
                  </span>
                  <Toggle on={fund} onChange={setFund} label="Take the money from the account" />
                </div>
              </>}
            </div>

            {v && (
              <div style={{ marginTop: 14, background: 'oklch(0.95 0.045 155)', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'oklch(0.42 0.09 155)' }}>On {longDate(v.end)} you get</span>
                <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: 'oklch(0.3 0.07 155)' }}>{fmt(v.atMaturity)}</span>
                <span style={{ fontSize: 13, lineHeight: 1.45, color: 'oklch(0.36 0.08 155)' }}>
                  {payout === 'end'
                    ? <>Your {fmt(a)} + <b>{fmt(v.totalNet)}</b> interest{withholding ? ` (${fmt(v.totalGross)} minus ${fmt(v.withheld)} withheld)` : ''}.</>
                    : <>Your {fmt(a)} + the last interest payment. Before that you get <b>{fmt(ps[0].net)}</b> {PAYOUT_LABEL[payout].toLowerCase()} ({ps.length} payments, <b>{fmt(v.totalNet)}</b> in total{withholding ? ' after the 4%' : ''}).</>}
                </span>
                <span style={{ fontSize: 12, color: 'oklch(0.42 0.09 155)' }}>About {fmt(v.perDay || draft.amount * (Math.pow(1 + r / 100, 1 / 365) - 1) * (withholding ? 1 - WITHHOLD : 1))} a day.</span>
              </div>
            )}
            <PrimaryBtn onClick={save} disabled={cant || !!short}>{old ? 'Save changes' : 'Add CDT'}</PrimaryBtn>
            {!old && <span style={{ margin: '8px 4px 0', fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'center' }}>This tracks your CDT. To open one for real, do it with your bank.</span>}
          </>
        )}
      </div>
    </SheetFrame>
  );
}

/* ---------------- One CDT ---------------- */
export function CdtInfoSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const c = cdtsOf(d).find(x => x.id === id);
  const banks = d.accounts.filter(a => a.type !== 'card');
  const [to, setTo] = useState(c?.acct ?? banks[0]?.id ?? '');
  const [renew, setRenew] = useState(false);
  const [mode, setMode] = useState<'all' | 'capital'>('all');
  const [rRate, setRRate] = useState(c ? String(c.rate).replace('.', ',') : '');
  const [rDays, setRDays] = useState(c?.days ?? 360);
  const [confirm, setConfirm] = useState(false);
  if (!c) return <SheetFrame title="CDT"><span style={{ padding: 20 }}>This CDT was deleted.</span></SheetFrame>;
  const v = cdtView(c), ps = payouts(c), today = todayISO();
  const acctName = d.accounts.find(a => a.id === c.acct)?.name;
  const toName = d.accounts.find(a => a.id === to)?.name;

  const cashOut = () => { setData(x => cashOutCdt(x, id, to)); flash(to ? `${fmt(v.atMaturity)} added to ${toName}` : 'CDT closed'); };
  const doRenew = () => {
    const r = num(rRate.replace(',', '.')); if (!(r > 0)) return;
    const { patch, next } = renewCdt(getData(), id, mode, r, rDays);
    setData(patch); flash('CDT renewed'); openSheet({ name: 'cdtInfo', id: next.id });
  };
  const del = () => { if (!confirm) return setConfirm(true); setData(x => deleteCdt(x, id)); closeSheet(); flash('CDT deleted'); };
  const statusTxt = v.status === 'closed' ? (c.closed!.how === 'renew' ? `Renewed on ${longDate(c.closed!.date)}` : `Cashed out on ${longDate(c.closed!.date)}`)
    : v.status === 'matured' ? 'Matured' : `${v.daysLeft} day${v.daysLeft === 1 ? '' : 's'} left`;

  return (
    <SheetFrame title={`CDT ${c.bank}`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
          <CdtBadge bank={c.bank} hue={c.hue} size={52} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{c.bank} · {pct(c.rate)} E.A. · {termTxt(c.days)}</span>
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em' }}>{fmt(v.status === 'closed' ? c.closed!.amt : v.value)}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: UP }}>+{fmt(v.earned)} earned{v.status === 'active' ? ` · +${fmt(v.perDay)} a day` : ''}</span>
          </div>
        </div>

        <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700 }}>
            <span>{statusTxt}</span><span style={{ color: 'var(--color-neutral-700)' }}>{Math.round(Math.min(1, v.progress) * 100)}%</span>
          </div>
          <Bar pct={`${Math.min(100, v.progress * 100)}%`} track="var(--color-neutral-200)" fill={UP} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-neutral-700)' }}><span>{longDate(c.start)}</span><span>{longDate(v.end)}</span></div>
        </div>

        {v.status === 'matured' && (
          <div style={{ marginTop: 12, background: 'oklch(0.95 0.045 155)', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'oklch(0.3 0.07 155)' }}>Your CDT matured: {fmt(v.atMaturity)}</span>
            {!renew ? <>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: 'oklch(0.36 0.08 155)' }}>Cash it out once the bank pays you, or renew it if the bank rolled it over.</span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
                <span style={{ flex: 1 }}>Send the money to</span>
                <select aria-label="Cash out to" value={to} onChange={e => setTo(e.target.value)} style={{ maxWidth: 160, height: 38, borderRadius: 12, border: 0, background: 'var(--surface)', fontWeight: 700, padding: '0 8px', color: TEXT, fontSize: 14 }}>
                  <option value="">Don't move money</option>
                  {banks.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
                <button onClick={cashOut} className="hv-acc600" style={{ height: 48, borderRadius: 999, border: 0, background: 'oklch(0.5 0.12 150)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Cash out</button>
                <button onClick={() => setRenew(true)} className="hv-n200" style={{ height: 48, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Renew</button>
              </div>
            </> : <>
              <Segmented items={[['all', 'Reinvest interest'], ['capital', 'Interest to account']]} value={mode} onPick={setMode} mt={0} />
              <span style={{ fontSize: 13, lineHeight: 1.4, color: 'oklch(0.36 0.08 155)' }}>
                {mode === 'all' ? `The new CDT starts with ${fmt(v.atMaturity)}.` : `The new CDT starts with ${fmt(c.amount)}; ${fmt(v.atMaturity - c.amount)} goes to ${acctName ?? 'no account'}.`} It starts on {longDate(v.end)}.
              </span>
              <div style={{ ...textInput, display: 'flex', alignItems: 'baseline', gap: 6, padding: '12px 16px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>New rate</span>
                <input type="text" inputMode="decimal" value={rRate} onChange={e => setRRate(rateInput(e.target.value))} aria-label="New rate" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 17, fontWeight: 700, color: TEXT, padding: 0, outline: 'none', textAlign: 'right' }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-neutral-400)' }}>% E.A.</span>
              </div>
              <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
                {TERMS.map(t => <button key={t} onClick={() => setRDays(t)} style={chip(rDays === t)}>{t} days</button>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }}>
                <button onClick={doRenew} style={{ height: 48, borderRadius: 999, border: 0, background: 'oklch(0.5 0.12 150)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Renew CDT</button>
                <button onClick={() => setRenew(false)} style={{ height: 48, padding: '0 18px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Back</button>
              </div>
            </>}
          </div>
        )}

        <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '2px 16px 4px' }}>
          {row('Amount invested', fmt(c.amount))}
          {row('Interest over the term', fmt(v.totalGross))}
          {c.withholding && row('Withholding (4%)', `−${fmt(v.withheld)}`, RED)}
          {row('Net interest', `+${fmt(v.totalNet)}`, UP)}
          {row('At maturity you get', fmt(v.atMaturity))}
          {row('Interest paid', PAYOUT_LABEL[c.payout])}
          {row('Linked account', acctName ?? 'None', TEXT, true)}
        </div>

        {ps.length > 1 && <>
          <FieldLabel>Interest payments</FieldLabel>
          <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '2px 16px' }}>
            {ps.map((p, i) => {
              const done = p.date <= today && (!p.final || v.status === 'closed');
              return (
                <div key={p.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: `1px solid ${i === ps.length - 1 ? 'transparent' : LINE}`, fontSize: 14 }}>
                  <span style={{ flex: 1 }}>{longDate(p.date)}{p.final ? ' · with your money back' : ''}</span>
                  <span style={{ fontWeight: 700, color: done ? UP : TEXT }}>+{fmt(p.net)}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 999, background: done ? 'oklch(0.95 0.045 155)' : 'var(--color-neutral-100)', color: done ? 'oklch(0.42 0.09 155)' : 'var(--color-neutral-700)' }}>{done ? 'Paid' : 'Upcoming'}</span>
                </div>
              );
            })}
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>{c.acct ? `Each payment is added to ${acctName} automatically on its day.` : 'Link an account to have each payment added automatically.'}</span>
        </>}

        {v.status !== 'closed' && <button onClick={() => openSheet({ name: 'cdt', id })} className="hv-n200" style={{ marginTop: 14, height: 48, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Edit CDT</button>}
        <GhostDanger onClick={del}>{confirm ? 'Tap again to delete (undoes its account moves)' : 'Delete CDT'}</GhostDanger>
        {c.renewedFrom && <span style={{ margin: '4px', fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'center' }}>Renewed from an earlier CDT that matured on {longDate(c.start)}.</span>}
      </div>
    </SheetFrame>
  );
}
