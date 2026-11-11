// Friends & trips: the Debts tab, the money summary at the top, and the Home block.
import { useState, type ReactNode } from 'react';
import { useApp, setUI, openSheet, setData } from '../lib/store';
import { LINE, RED, TEXT } from '../lib/constants';
import { ctxOf, fmt } from '../lib/derive';
import { shortDate, todayISO } from '../lib/dates';
import { debtOutlook, debtTiming, debtTotals, debtsOf, isOpen, leftOf, settledOn } from '../lib/debts';
import { monthSummary } from '../lib/plan';
import { getSocial, myUid } from '../lib/social';
import type { Data, Debt } from '../lib/types';
import { Toggle } from '../ui/bits';
import * as I from '../ui/icons';
import { Avatar, myBalance, useSocial } from './Social';
import { GREEN } from '../sheets/DebtSheets';

const card = { background: 'var(--surface)', borderRadius: 24, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 10 };

/** Trips: what you're owed and what you owe, added up over all your trips. */
export function tripTotals() {
  const so = getSocial();
  let owedToMe = 0, iOwe = 0;
  for (const t of so.trips) { const v = myBalance(t, so.items[t.id]).value; if (v > 0.004) owedToMe += v; else if (v < -0.004) iOwe -= v; }
  return { owedToMe, iOwe, trips: so.trips.length };
}
/** Debts with one friend: + they owe you, − you owe them. */
export const friendDebt = (d: Data, uid: string) => debtsOf(d).filter(x => x.friend === uid && isOpen(x)).reduce((a, x) => a + (x.dir === 'owed' ? leftOf(x) : -leftOf(x)), 0);

/** A short explanation of what a tab is for. */
export function Purpose({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '2px 6px' }}>
      <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1.2 }}>{icon}</span>
      <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>{children}</span>
    </div>
  );
}

/* ---------------- Summary at the top of Friends & trips ---------------- */
export function MoneyBetween() {
  const { data: d } = useApp();
  useSocial();
  const dt = debtTotals(d), tt = tripTotals();
  const owed = dt.owedToMe + tt.owedToMe, owe = dt.iOwe + tt.iOwe;
  const sub = (a: number, b: number) => (a > 0.004 && b > 0.004 ? `${fmt(a)} in debts · ${fmt(b)} in trips` : b > 0.004 ? 'From trips' : a > 0.004 ? 'From debts' : 'Nothing right now');
  const tile = (label: string, v: number, color: string, s: string) => (
    <div style={{ background: 'var(--surface)', borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
      <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{label}</span>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', color: v > 0.004 ? color : TEXT }}>{fmt(v)}</span>
      <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s}</span>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
      {tile('People owe you', owed, GREEN, sub(dt.owedToMe, tt.owedToMe))}
      {tile('You owe', owe, RED, sub(dt.iOwe, tt.iOwe))}
    </div>
  );
}

/* ---------------- Debts tab ---------------- */
function DebtRow({ x, last, d, today }: { x: Debt; last: boolean; d: Data; today: string }) {
  const left = leftOf(x), owed = x.dir === 'owed', t = debtTiming(d, x, today), done = !isOpen(x);
  const sub = done ? `Paid back ${shortDate(settledOn(x) ?? x.date)}` : x.due ? `${owed ? 'Pays you back by' : 'Pay back by'} ${shortDate(x.due)}` : 'No pay-back date';
  return (
    <button onClick={() => openSheet({ name: 'debt', id: x.id })} className="hv-n100" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 6px', margin: '0 -6px', border: 0, borderBottom: `1px solid ${last ? 'transparent' : LINE}`, borderRadius: 12, background: 'transparent', color: TEXT, cursor: 'pointer', textAlign: 'left' }}>
      <Avatar name={x.name} uid={x.friend} />
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span translate="no">{x.name}</span>{x.note ? <span translate="no" style={{ fontWeight: 400, color: 'var(--color-neutral-600)' }}> · {x.note}</span> : null}</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', display: 'flex', alignItems: 'center', gap: 6 }}>
          {!done && <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 99, flex: 'none', background: t.tone === 'ok' ? GREEN : 'oklch(0.7 0.14 70)' }} />}
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</span>
        </span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <span style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: done ? 'var(--color-neutral-600)' : owed ? GREEN : RED }}>{fmt(done ? x.amt : left)}</span>
        {!done && left < x.amt - 0.004 && <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap' }}>{`of ${fmt(x.amt)}`}</span>}
      </span>
    </button>
  );
}

export function DebtList() {
  const { data: d } = useApp();
  const today = todayISO(), c = ctxOf(d);
  const all = debtsOf(d), open = all.filter(isOpen), done = all.filter(x => !isOpen(x));
  const owed = open.filter(x => x.dir === 'owed').sort((a, b) => (a.due ?? '9') < (b.due ?? '9') ? -1 : 1);
  const owe = open.filter(x => x.dir === 'owe').sort((a, b) => (a.due ?? '9') < (b.due ?? '9') ? -1 : 1);
  const tot = debtTotals(d), out = debtOutlook(d, today), sum = monthSummary(d, c);
  const [showDone, setShowDone] = useState(false);
  const section = (title: string, total: number, color: string, list: Debt[], empty: string) => (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>{title}</span>
        {list.length > 0 && <span style={{ fontSize: 15, fontWeight: 800, color }}>{fmt(total)}</span>}
      </div>
      {list.length ? <div style={{ display: 'flex', flexDirection: 'column' }}>{list.map((x, i) => <DebtRow key={x.id} x={x} d={d} today={today} last={i === list.length - 1} />)}</div>
        : <span style={{ fontSize: 13.5, color: 'var(--color-neutral-700)' }}>{empty}</span>}
    </div>
  );
  const addBtn = (dir: 'owed' | 'owe', label: string) => (
    <button onClick={() => openSheet({ name: 'debt', id: null, dir })} className="hv-n200" style={{ height: 50, borderRadius: 18, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <I.Plus size={16} />{label}
    </button>
  );
  const affects = out.late > 0.004 || out.oweSoon > 0.004;
  return <>
    <Purpose icon="🤝">Money between you and one person: you lent it, paid for them, or borrowed. Only you see these, and they don't count as spending.</Purpose>
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
      {addBtn('owed', 'Someone owes me')}
      {addBtn('owe', 'I owe someone')}
    </div>
    {section('Owed to you', tot.owedToMe, GREEN, owed, 'Nobody owes you money right now.')}
    {section('You owe', tot.iOwe, RED, owe, "You don't owe anyone right now.")}

    {affects && (
      <div style={{ ...card, gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Your pockets</span>
        {out.late > 0.004 && <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{`${fmt(out.late)} that people owe you comes back after you need it (after your card is due or after this month), so your pockets can't count on it yet.`}</span>}
        {out.oweSoon > 0.004 && <span style={{ fontSize: 13.5, lineHeight: 1.45 }}>{`${fmt(out.oweSoon)} you owe is due this month (or has no date), so it isn't money your pockets can spend.`}</span>}
        {sum.real > 0.004
          ? <>
            <span style={{ fontSize: 13.5, lineHeight: 1.45, color: RED, fontWeight: 600 }}>{`Your pockets promise ${fmt(sum.real)} more than you have.`}</span>
            <button onClick={() => openSheet({ name: 'cover' })} className="hv-acc600" style={{ height: 46, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 14.5, fontWeight: 700, cursor: 'pointer' }}>Adjust my pockets</button>
          </>
          : <span style={{ fontSize: 13.5, lineHeight: 1.45, color: GREEN, fontWeight: 600 }}>You have enough money to cover it, so your pockets don't need to change.</span>}
      </div>
    )}

    <div style={{ ...card, gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Count what people owe you in your net worth</span>
        <Toggle on={!!d.settings.owedInNetWorth} onChange={v => setData(x => ({ settings: { ...x.settings, owedInNetWorth: v } }))} label="Count what people owe you in your net worth" />
      </div>
      <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>{d.settings.owedInNetWorth ? `On: the ${fmt(tot.owedToMe)} people owe you counts as yours, as if they had already paid.` : 'Off: money you lent only shows once they pay you back.'} What you owe always counts.</span>
    </div>

    {done.length > 0 && (
      <div style={card}>
        <button onClick={() => setShowDone(s => !s)} aria-expanded={showDone} style={{ display: 'flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', color: TEXT, padding: 0, cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
          <span style={{ flex: 1, textAlign: 'left' }}>{`Paid back · ${done.length}`}</span>
          <span style={{ transform: showDone ? 'rotate(90deg)' : 'none', transition: 'transform .2s', display: 'flex' }}><I.Chevron size={16} color="var(--color-neutral-500)" /></span>
        </button>
        {showDone && <div style={{ display: 'flex', flexDirection: 'column' }}>{done.map((x, i) => <DebtRow key={x.id} x={x} d={d} today={today} last={i === done.length - 1} />)}</div>}
      </div>
    )}
  </>;
}

/* ---------------- Home block ---------------- */
export function FriendsHomeCard() {
  const { data: d } = useApp();
  const so = useSocial();
  const dt = debtTotals(d), tt = tripTotals();
  const owed = dt.owedToMe + tt.owedToMe, owe = dt.iOwe + tt.iOwe;
  const friends = so.friends.filter(f => f.status === 'accepted' && f.uid !== myUid()).length;
  const bits = [tt.trips ? (tt.trips === 1 ? '1 trip' : `${tt.trips} trips`) : '', friends ? (friends === 1 ? '1 friend' : `${friends} friends`) : '', dt.owedCount + dt.oweCount ? (dt.owedCount + dt.oweCount === 1 ? '1 debt' : `${dt.owedCount + dt.oweCount} debts`) : ''].filter(Boolean);
  const empty = owed <= 0.004 && owe <= 0.004 && !bits.length;
  return (
    <button onClick={() => setUI({ page: 'social' })} className="pr98" style={{ ...card, border: 0, cursor: 'pointer', textAlign: 'left', color: TEXT, gap: 8 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--color-neutral-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤝</span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Friends & trips</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{empty ? 'Debts with one person, and trips shared with a group' : bits.join(' · ') || 'Debts and trips'}</span>
        </span>
        <I.Chevron size={16} color="var(--color-neutral-500)" />
      </span>
      {!empty && (
        <span style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8 }}>
          <span style={{ background: 'var(--color-neutral-100)', borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>People owe you</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: owed > 0.004 ? GREEN : TEXT }}>{fmt(owed)}</span>
          </span>
          <span style={{ background: 'var(--color-neutral-100)', borderRadius: 16, padding: '10px 12px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>You owe</span>
            <span style={{ fontSize: 17, fontWeight: 800, color: owe > 0.004 ? RED : TEXT }}>{fmt(owe)}</span>
          </span>
        </span>
      )}
    </button>
  );
}
