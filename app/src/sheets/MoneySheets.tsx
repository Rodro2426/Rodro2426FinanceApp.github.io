import { useState } from 'react';
import { useApp, setData, openSheet, closeSheet, flash, replaceData, setUI, startTour } from '../lib/store';
import { ACCT_KIND, ACCT_TYPE_LABEL, HUES, LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { acctTxns, fmt, initialOf, num, pctOf, plural, roundAmt, uid } from '../lib/derive';
import { allMonths, downloadCSV, exportData } from '../lib/exportData';
import { monthLabel, shortDate, todayISO } from '../lib/dates';
import { pickPhoto } from '../lib/photo';
import { makeBackup, pickBackupFile, readBackup, restoreBackup } from '../lib/backup';
import { dailyRate, earnsInterest, perDay } from '../lib/interest';
import { emptyData, sampleData } from '../lib/seed';
import type { AcctType, Currency } from '../lib/types';
import { AcctBadge, Bar, BigAmount, FieldLabel, GhostDanger, PrimaryBtn, Segmented, SmallAmount, Toggle, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';
import * as I from '../ui/icons';
import { MoneyInput } from '../ui/MoneyInput';

const TYPES = Object.entries(ACCT_TYPE_LABEL) as [AcctType, string][];
const GREEN_TEXT = 'oklch(0.5 0.12 150)';

/* ---------------- Excel export ---------------- */
export function ExportSheet({ acct }: { acct: string }) {
  const { data: d } = useApp();
  const [month, setMonth] = useState(todayISO().slice(0, 7));
  const [acctId, setAcctId] = useState(acct);
  const [busy, setBusy] = useState(false);
  const x = exportData(d, month, acctId);
  const byCat: Record<string, number> = {};
  x.details.forEach(r => { byCat[r.category] = (byCat[r.category] || 0) + r.amount; });
  const tot = x.details.reduce((a, r) => a + r.amount, 0);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const sheets = ['For AI', 'Summary', 'Details', 'Card payments'].concat(x.statement ? ['Statement'] : []);
  const chip = (on: boolean) => ({ background: on ? TEXT : '#fff', color: on ? '#fff' : TEXT });

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const mod = await import('../lib/xlsx');
      mod.downloadWorkbook(x);
      flash('Excel downloaded · ' + monthLabel(month));
    } catch (err) {
      console.warn('Excel export failed, falling back to CSV', err);
      downloadCSV(x);
      flash('Downloaded as CSV (opens in Excel)');
    }
    setBusy(false); closeSheet();
  };

  return (
    <SheetFrame title="Download Excel">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <FieldLabel m="6px 4px 8px">Month</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {[...allMonths(d).reverse(), 'all'].map(m => (
            <button key={m} onClick={() => setMonth(m)} style={{ height: 38, padding: '0 15px', borderRadius: 999, border: 0, ...chip(m === month), fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>{monthLabel(m)}</button>
          ))}
        </div>
        <FieldLabel>Accounts</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {[{ id: 'all', name: 'All accounts' }, ...d.accounts].map(a => (
            <button key={a.id} onClick={() => setAcctId(a.id)} style={{ flex: 'none', height: 36, padding: '0 14px', borderRadius: 999, border: 0, ...chip(a.id === acctId), fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>{a.name}</button>
          ))}
        </div>
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontSize: 14, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{plural(x.details.length, 'expense')}</span>
            <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', whiteSpace: 'nowrap' }}>{fmt(tot)}</span>
          </div>
          {cats.map(([n, v]) => (
            <div key={n} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, gap: 8 }}><span style={{ whiteSpace: 'nowrap' }}>{n}</span><span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{fmt(v)}</span></div>
              <Bar h={6} pct={pctOf(v, tot)} track="var(--color-neutral-200)" fill="oklch(0.68 0.12 150)" ease="0s" />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingTop: 10, borderTop: '1px solid var(--color-neutral-200)', fontSize: 12, color: 'var(--color-neutral-700)' }}>
            <span>{plural(x.payments.length, 'card payment')} on a separate sheet</span>
            <span>Sheets: {sheets.join(' · ')}</span>
          </div>
        </div>
        <PrimaryBtn onClick={download} mt={16} bg="oklch(0.5 0.12 150)" hover="hv-green">
          <I.Download size={18} />{busy ? 'Preparing file…' : 'Download Excel'}
        </PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Account detail + history ---------------- */
export function AcctSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const a = d.accounts.find(x => x.id === id);
  if (!a) return null;
  const { list, card } = acctTxns(d, id);
  const k = ink(a.hue), lim = a.limit || 0;
  const mTotals: Record<string, number> = {};
  list.forEach(t => { if (t.kind === 'expense') mTotals[t.date.slice(0, 7)] = (mTotals[t.date.slice(0, 7)] || 0) + Math.abs(t.show); });
  const setPhoto = (p: string) => setData(x => ({ accounts: x.accounts.map(y => (y.id === id ? { ...y, photo: p } : y)) }));
  const shown = list.slice(0, 300);

  return (
    <SheetFrame title={a.name}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: tint(a.hue), borderRadius: 28, padding: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => pickPhoto().then(p => p && setPhoto(p))} aria-label="Change photo" style={{ border: 0, padding: 0, cursor: 'pointer', background: 'transparent', borderRadius: 18 }}>
              <AcctBadge photo={a.photo} initial={initialOf(a.name)} size={56} radius={18} bg="rgba(255,255,255,.8)" color={k} fs={20} />
            </button>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: k }}>{a.kind}</span>
              <span style={{ fontSize: 13, color: k, whiteSpace: 'nowrap' }}>{card ? 'Balance owed' : 'Current balance'}</span>
            </div>
          </div>
          <span style={{ marginTop: 10, fontSize: 38, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: k }}>{fmt(a.bal)}</span>
          {earnsInterest(a) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: GREEN_TEXT, background: 'rgba(255,255,255,.8)', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>+{fmt(a.earned || 0)} earned</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: k, background: 'rgba(255,255,255,.7)', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap' }}>{String(a.rate).replace('.', ',')}% E.A. · +{fmt(perDay(a))} a day</span>
            </div>
          )}
          {card && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              <Bar pct={pctOf(a.bal, lim)} track="rgba(255,255,255,.8)" fill={k} ease="0s" />
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: k }}><span style={{ whiteSpace: 'nowrap' }}>Limit {fmt(lim)}</span><span style={{ whiteSpace: 'nowrap' }}>{fmt(lim - a.bal)} available · due {a.due || '—'}</span></div>
            </div>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 12 }}>
          <button onClick={() => openSheet({ name: 'editAcct', id })} className="hv-n200" style={{ height: 50, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <I.Pencil size={16} />Edit
          </button>
          <button onClick={() => openSheet({ name: 'export', acct: id })} className="hv-green2" style={{ height: 50, borderRadius: 999, border: 0, background: 'oklch(0.94 0.05 150)', color: 'oklch(0.38 0.1 150)', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <I.Download size={16} />Excel
          </button>
        </div>
        {card && <PrimaryBtn onClick={() => openSheet({ name: 'pay', id })} mt={8} h={50} fs={15}>Pay card</PrimaryBtn>}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '18px 4px 8px' }}>
          <span style={{ fontSize: 17, fontWeight: 700 }}>History</span>
          <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{plural(list.length, 'transaction')}</span>
        </div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '4px 16px' }}>
          {shown.map((t, i) => {
            const mk = t.date.slice(0, 7), header = i === 0 || shown[i - 1].date.slice(0, 7) !== mk;
            return (
              <div key={t.kind + t.ts + i}>
                {header && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '14px 0 6px', borderBottom: '1px solid var(--color-neutral-200)' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{monthLabel(mk)}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>Spent {fmt(mTotals[mk] || 0)}</span>
                  </div>
                )}
                <div onClick={() => t.kind !== 'payment' && openSheet({ name: 'txn', kind: t.kind, id: t.id, back: { name: 'acct', id } })} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === shown.length - 1 ? 'transparent' : LINE}`, cursor: t.kind === 'payment' ? 'default' : 'pointer' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 999, backgroundColor: tint(t.hue), backgroundImage: t.photoBg, backgroundSize: 'cover', backgroundPosition: 'center', color: ink(t.hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flex: 'none' }}>{t.icon != null ? t.icon : (t.pocket || t.note).charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{t.note}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{[shortDate(t.date), t.pocket, t.fx].filter(Boolean).join(' · ')}</span>
                    {t.tags.length > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-700)' }}>{t.tags.map(x => '#' + x).join('  ')}</span>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: t.show > 0 ? GREEN_TEXT : TEXT }}>{(t.show > 0 ? '+' : '−') + fmt(Math.abs(t.show))}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{(card ? 'Owed ' : 'Bal. ') + fmt(t.after)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {list.length === 0 && <div style={{ padding: '16px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No transactions on this account yet.</div>}
          {list.length > shown.length && <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>Showing the latest {shown.length}. Download Excel for the full history.</div>}
        </div>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Account form (edit + add) ---------------- */
/** Interest settings from the form; turning a rate on starts counting from today. */
function rateFields(prev: { rate?: number; accruedTo?: string; earned?: number } | null, f: { type: AcctType; rate: string }) {
  const r = f.type === 'bank' || f.type === 'savings' ? num(f.rate) : 0;
  if (!(r > 0)) return { rate: undefined, accruedTo: undefined };
  return { rate: r, accruedTo: prev?.rate ? prev.accruedTo : todayISO(), earned: prev?.earned ?? 0 };
}

function AcctForm({ initial, isNew, onSave, onDelete }: {
  initial: { name: string; type: AcctType; bal: string; limit: string; due: string; photo: string | null; hue: number; rate: string };
  isNew: boolean; onSave: (v: typeof initial) => void; onDelete?: () => void;
}) {
  const [f, setF] = useState(initial);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF(x => ({ ...x, [k]: v }));
  const isCard = f.type === 'card';
  const cant = !f.name.trim() || (isCard && !(num(f.limit) > 0));
  const namePh = { bank: 'Davivienda', savings: 'Emergency savings', cash: 'Wallet', card: 'Visa Platinum' }[f.type];
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 22, padding: 14, marginTop: isNew ? 10 : 0 }}>
        <AcctBadge photo={f.photo} initial={initialOf(f.name)} size={64} radius={20} bg={tint(f.hue)} color={ink(f.hue)} fs={24} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
          <button onClick={() => pickPhoto().then(p => p && setF(x => ({ ...x, photo: p })))} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{f.photo ? 'Change photo' : 'Add photo'}</button>
          {f.photo && <button onClick={() => setF(x => ({ ...x, photo: null }))} style={{ padding: '0 4px', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove photo</button>}
        </div>
      </div>
      <Segmented items={TYPES} value={f.type} onPick={t => setF(x => ({ ...x, type: t }))} h={isNew ? 40 : 38} />
      <FieldLabel m="14px 4px 6px">Name</FieldLabel>
      <input value={f.name} placeholder={namePh} onChange={e => set('name')(e.target.value)} style={textInput} />
      <FieldLabel m="14px 4px 6px">{isCard ? 'Balance owed' : 'Current balance'}</FieldLabel>
      <SmallAmount value={f.bal} onChange={set('bal')} />
      {isCard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Credit limit</span>
            <MoneyInput value={f.limit} onChange={set('limit')} style={{ ...textInput, fontWeight: 600 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Payment due</span>
            <input placeholder="Nov 25" value={f.due} onChange={e => set('due')(e.target.value)} style={{ ...textInput, fontWeight: 600 }} />
          </div>
        </div>
      )}
      {(f.type === 'bank' || f.type === 'savings') && (
        <>
          <FieldLabel m="14px 4px 6px">Annual return (% E.A.)</FieldLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: '#fff', borderRadius: 18, padding: '13px 18px' }}>
            <input type="text" inputMode="decimal" placeholder="0" value={f.rate} onChange={e => set('rate')(e.target.value.replace(/[^\d.,]/g, ''))}
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-400)' }}>% E.A.</span>
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>
            {num(f.rate) > 0 ? `Like a Cajita: interest is added every day. ${fmt(num(f.bal) * dailyRate(num(f.rate)))} a day on this balance.` : 'Leave at 0 if this account earns no interest.'}
          </span>
        </>
      )}
      <PrimaryBtn onClick={() => onSave(f)} disabled={cant} mt={20}>{isNew ? `Add ${isCard ? 'card' : 'account'}` : 'Save changes'}</PrimaryBtn>
      {onDelete && <GhostDanger onClick={() => (confirmDel ? onDelete() : setConfirmDel(true))}>{confirmDel ? 'Tap again to delete' : 'Delete account'}</GhostDanger>}
    </div>
  );
}

export function EditAcctSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const a = d.accounts.find(x => x.id === id);
  if (!a) return null;
  return (
    <SheetFrame title="Edit account">
      <AcctForm isNew={false}
        initial={{ name: a.name, type: a.type, bal: String(roundAmt(a.bal)), limit: String(a.limit || ''), due: a.due || '', photo: a.photo || null, hue: a.hue, rate: a.rate ? String(a.rate) : '' }}
        onSave={f => {
          const card = f.type === 'card';
          setData(x => ({ accounts: x.accounts.map(y => (y.id === id ? { ...y, name: f.name.trim(), type: f.type, kind: ACCT_KIND[f.type], bal: Math.abs(num(f.bal) - y.bal) < 1 ? y.bal : roundAmt(num(f.bal)), limit: card ? num(f.limit) : undefined, due: card ? f.due.trim() || 'Nov 25' : undefined, photo: f.photo, ...rateFields(y, f) } : y)) }));
          openSheet({ name: 'acct', id }); flash('Account updated');
        }}
        onDelete={() => {
          setData(x => ({ accounts: x.accounts.filter(y => y.id !== id) }));
          setUI(u => ({ sheet: null, lastAdd: { ...u.lastAdd, acct: u.lastAdd.acct === id ? '' : u.lastAdd.acct } }));
          flash(`${a.name} deleted`);
        }} />
    </SheetFrame>
  );
}

export function AddAcctSheet() {
  const { data: d } = useApp();
  return (
    <SheetFrame title="New account">
      <AcctForm isNew initial={{ name: '', type: 'bank', bal: '', limit: '', due: '', photo: null, hue: HUES[d.accounts.length % HUES.length], rate: '' }}
        onSave={f => {
          const card = f.type === 'card';
          const a = { id: uid('x'), name: f.name.trim(), kind: ACCT_KIND[f.type], type: f.type, bal: roundAmt(num(f.bal)), hue: f.hue, photo: f.photo, ...(card ? { limit: num(f.limit), due: f.due.trim() || 'Nov 25' } : {}), ...rateFields(null, f) };
          setData(x => ({ accounts: [...x.accounts, a] }));
          setUI({ sheet: null, tab: 'accounts' }); flash(`${a.name} added`);
        }} />
    </SheetFrame>
  );
}

/* ---------------- Pay card ---------------- */
export function PaySheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const pc = d.accounts.find(x => x.id === id);
  const sources = d.accounts.filter(a => a.type !== 'card');
  const [amt, setAmt] = useState(String(pc?.bal ?? ''));
  const [from, setFrom] = useState(sources[0]?.id);
  if (!pc) return null;
  const pFrom = d.accounts.find(x => x.id === from), v = num(amt);
  const bad = !pFrom || v <= 0 || v > pc.bal + 0.004 || v > pFrom.bal + 0.004;
  const hint = v > pc.bal + 0.004 ? `That's more than the ${fmt(pc.bal)} you owe.`
    : pFrom && v > pFrom.bal + 0.004 ? `${pFrom.name} only has ${fmt(pFrom.bal)}.`
    : pFrom && v > 0 ? `${pFrom.name} goes to ${fmt(pFrom.bal - v)}. You'll owe ${fmt(pc.bal - v)}.`
    : !sources.length ? 'Add a bank or cash account to pay from.' : '';
  const confirm = () => {
    if (bad) return;
    const val = roundAmt(v);
    setData(x => ({ accounts: x.accounts.map(a => (a.id === pc.id || a.id === pFrom!.id ? { ...a, bal: a.bal - val } : a)), payments: [...x.payments, { id: uid('pay'), ts: Date.now(), from: pFrom!.id, to: pc.id, amt: val, date: todayISO() }] }));
    closeSheet(); flash(`Paid ${fmt(val)} to ${pc.name}`);
  };
  return (
    <SheetFrame title={`Pay ${pc.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px', fontSize: 13, color: 'var(--color-neutral-700)' }}>{fmt(pc.bal)} owed · due {pc.due || '—'}</span>
        <BigAmount value={amt} onChange={setAmt} />
        <FieldLabel m="18px 4px 8px">Pay from</FieldLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sources.map(a => (
            <button key={a.id} onClick={() => setFrom(a.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px 10px 10px', borderRadius: 20, border: `2px solid ${a.id === from ? ink(a.hue) : '#fff'}`, background: '#fff', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
              <AcctBadge photo={a.photo} initial={initialOf(a.name)} size={36} radius={12} bg={tint(a.hue)} color={ink(a.hue)} fs={15} />
              <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{a.name}</span>
              <span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>{fmt(a.bal)}</span>
            </button>
          ))}
        </div>
        <div style={{ margin: '14px 4px 0', fontSize: 13, color: bad && v > 0 ? RED : 'var(--color-neutral-700)' }}>{hint}</div>
        <PrimaryBtn onClick={confirm} disabled={bad}>Pay {fmt(v)}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Add money to goal ---------------- */
export function GoalSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const g = d.goals.find(x => x.id === id);
  const [amt, setAmt] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  if (!g) return null;
  const remove = () => {
    if (!confirmDel) return setConfirmDel(true);
    setData(x => ({ goals: x.goals.filter(y => y.id !== g.id) }));
    closeSheet(); flash(`${g.name} deleted`);
  };
  const v = num(amt), q = d.settings.currency === 'COP' ? [50000, 100000, 250000] : [25, 50, 100];
  const confirm = () => {
    if (!(v > 0)) return;
    const val = roundAmt(v);
    setData(x => ({ goals: x.goals.map(y => (y.id === g.id ? { ...y, saved: y.saved + val } : y)) }));
    closeSheet(); flash(`${fmt(val)} added to ${g.name}`);
  };
  return (
    <SheetFrame title={g.name}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px', fontSize: 13, color: 'var(--color-neutral-700)' }}>{fmt(g.saved)} saved of {fmt(g.target)}</span>
        <BigAmount value={amt} onChange={setAmt} />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
          {q.map(x => <button key={x} onClick={() => setAmt(String(x))} className="hv-n300" style={{ height: 38, padding: '0 16px', borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+{fmt(x)}</button>)}
        </div>
        <div style={{ margin: '14px 4px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>{v > 0 ? `You'll be at ${Math.min(100, Math.round((g.saved + v) / g.target * 100))}% of your goal.` : 'How much are you setting aside?'}</div>
        <PrimaryBtn onClick={confirm} disabled={!(v > 0)}>Add to goal</PrimaryBtn>
        <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete goal'}</GhostDanger>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Profile and settings ---------------- */
export function SettingsSheet() {
  const { data: d } = useApp();
  const st = d.settings;
  const [confirm, setConfirm] = useState<null | 'erase' | 'sample'>(null);
  const [restore, setRestore] = useState<Awaited<ReturnType<typeof readBackup>> | null>(null);
  const [askTour, setAskTour] = useState(false);
  const logged = d.expenses.length + d.incomes.length;
  const hasData = logged + d.accounts.length + d.pockets.length + d.bills.length > 0;
  const setS = (patch: Partial<typeof st>) => setData(x => ({ settings: { ...x.settings, ...patch } }));
  return (
    <SheetFrame title="Profile">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 22, padding: 14 }}>
          <AcctBadge photo={st.profilePhoto} initial={initialOf(st.name)} size={64} radius={999} bg="var(--color-accent-200)" color="var(--color-accent-800)" fs={24} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <button onClick={() => pickPhoto().then(p => p && setS({ profilePhoto: p }))} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{st.profilePhoto ? 'Change photo' : 'Add photo'}</button>
            {st.profilePhoto && <button onClick={() => setS({ profilePhoto: null })} style={{ padding: '0 4px', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove photo</button>}
          </div>
        </div>
        <FieldLabel m="14px 4px 6px">Your name</FieldLabel>
        <input value={st.name} onChange={e => setS({ name: e.target.value })} style={textInput} />
        <FieldLabel m="14px 4px 0">Currency</FieldLabel>
        <Segmented<Currency> mt={6} items={[['COP', 'COP'], ['$', '$'], ['€', '€'], ['£', '£']]} value={st.currency} onPick={c => setS({ currency: c })} />
        <FieldLabel m="14px 4px 0">Weeks per month</FieldLabel>
        <Segmented mt={6} items={[['4', '4 weeks'], ['5', '5 weeks']]} value={String(st.weeks) as '4' | '5'} onPick={w => setS({ weeks: Number(w) as 4 | 5 })} />
        <FieldLabel m="18px 4px 0">Backup</FieldLabel>
        <div style={{ marginTop: 6, background: '#fff', borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
            Your data lives only on this phone. Save a backup file to iCloud Drive so you can get everything back if the app is deleted.
            {st.lastBackup ? <> Last backup: <b style={{ color: TEXT }}>{shortDate(st.lastBackup)}</b>.</> : <> <b style={{ color: 'var(--color-accent-700)' }}>No backup yet.</b></>}
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8 }}>
            <button onClick={async () => { const r = await makeBackup(); if (r === 'shared') flash('Backup saved'); else if (r === 'downloaded') flash('Backup downloaded to Files'); }} className="hv-acc600" style={{ height: 48, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><I.Download size={16} />Back up</button>
            <button onClick={async () => {
              const f = await pickBackupFile(); if (!f) return;
              try { const r = await readBackup(f); setRestore(r); } catch (e) { flash((e as Error).message); }
            }} className="hv-n200" style={{ height: 48, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Restore</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 10, borderTop: '1px solid var(--color-neutral-200)' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Monthly reminder</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>A one-tap "Back up now" on the day you pick</span>
            </div>
            {st.backupReminder !== false && (
              <select aria-label="Reminder day" value={st.backupDay || 1} onChange={e => setS({ backupDay: Number(e.target.value) })}
                style={{ height: 36, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', fontWeight: 700, padding: '0 8px', color: TEXT }}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(n => <option key={n} value={n}>Day {n}</option>)}
              </select>
            )}
            <Toggle on={st.backupReminder !== false} onChange={v => setS({ backupReminder: v })} label="Monthly backup reminder" />
          </div>
          {restore && (
            <div style={{ background: 'var(--color-accent-100)', borderRadius: 16, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--color-accent-900)' }}>
                Backup{restore.summary.exportedAt ? ` from ${new Date(restore.summary.exportedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''} for {restore.summary.name}: {restore.summary.accounts} accounts, {restore.summary.expenses} expenses, {restore.summary.pockets} pockets, {restore.summary.scheduled} scheduled, {restore.summary.trades} trades. <b>Restoring replaces everything on this phone.</b>
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { restoreBackup(restore.data); setRestore(null); closeSheet(); flash('Backup restored'); }} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Restore it</button>
                <button onClick={() => setRestore(null)} style={{ flex: 1, height: 42, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
        {askTour ? (
          <div role="alertdialog" aria-label="Tutorial with your data" style={{ marginTop: 18, background: '#e3f1e6', borderRadius: 20, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#1d4a2e' }}>
              {logged > 0 ? `I noticed you already have ${logged} transaction${logged > 1 ? 's' : ''} logged. Would you like to see the tutorial without altering your logs?` : 'I noticed you already have data in the app. Would you like to see the tutorial without altering it?'}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.4, color: '#2f5a3e' }}>The tutorial uses a separate practice copy. Your accounts, pockets and transactions stay saved, nothing you do in the tutorial touches them, and they come back as soon as you finish or exit.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { setAskTour(false); startTour('replay'); }} style={{ flex: 1, height: 44, borderRadius: 999, border: 0, background: '#1d4a2e', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Yes, use a practice copy</button>
              <button onClick={() => setAskTour(false)} style={{ flex: 'none', padding: '0 18px', height: 44, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        ) : <button onClick={() => (hasData ? setAskTour(true) : startTour('replay'))} className="hv-n200" style={{ marginTop: 18, height: 46, borderRadius: 999, border: 0, background: '#1d4a2e', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>App tutorial</button>}
        <button onClick={() => setUI({ sheet: null, install: 'profile' })} className="hv-n200" style={{ marginTop: 12, height: 46, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>How to install Pockets on iPhone</button>
        <span style={{ margin: '14px 4px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>Start over</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 8, marginTop: 10 }}>
          <button onClick={() => {
            if (confirm !== 'sample') return setConfirm('sample');
            replaceData({ ...sampleData(), settings: { ...st } }); closeSheet(); flash('Sample data loaded');
          }} className="hv-n200" style={{ height: 48, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>{confirm === 'sample' ? 'Tap to replace' : 'Load sample data'}</button>
          <button onClick={() => {
            if (confirm !== 'erase') return setConfirm('erase');
            replaceData(emptyData(d)); closeSheet(); flash('All data erased');
          }} className="hv-acc100" style={{ height: 48, borderRadius: 999, border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: 'inset 0 0 0 1.5px var(--color-accent-300)' }}>{confirm === 'erase' ? 'Tap again to erase' : 'Start fresh'}</button>
        </div>
      </div>
    </SheetFrame>
  );
}

/* ---------------- New savings goal ---------------- */
export function NewGoalSheet() {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [months, setMonths] = useState('6');
  const [saved, setSaved] = useState('');
  const t = num(target), m = Math.max(1, Math.round(num(months)) || 1), s0 = num(saved);
  const cant = !name.trim() || !(t > 0);
  const save = () => {
    if (cant) return;
    setData(x => ({ goals: [...x.goals, { id: uid('g'), name: name.trim(), saved: roundAmt(Math.max(0, s0)), target: roundAmt(t), months: m, hue: HUES[(x.goals.length + 3) % HUES.length] }] }));
    closeSheet(); flash(`${name.trim()} created`);
  };
  return (
    <SheetFrame title="New savings goal">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <FieldLabel m="6px 4px 6px">Name</FieldLabel>
        <input value={name} placeholder="Trip to Cartagena" onChange={e => setName(e.target.value)} autoFocus style={textInput} />
        <FieldLabel m="14px 4px 6px">Target amount</FieldLabel>
        <SmallAmount value={target} onChange={setTarget} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, marginTop: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Months to reach it</span>
            <input type="number" inputMode="numeric" value={months} onChange={e => setMonths(e.target.value)} style={{ ...textInput, fontWeight: 600 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ margin: '0 4px', fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Already saved</span>
            <MoneyInput value={saved} onChange={setSaved} style={{ ...textInput, fontWeight: 600 }} />
          </div>
        </div>
        <span style={{ margin: '10px 4px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
          {t > 0 ? `Save ${fmt(Math.max(0, t - s0) / m)} a month to reach it in ${m === 1 ? '1 month' : m + ' months'}.` : 'How much do you want to save?'}
        </span>
        <PrimaryBtn onClick={save} disabled={cant} mt={18}>Create goal</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}
