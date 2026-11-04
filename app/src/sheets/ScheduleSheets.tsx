import { useEffect, useState } from 'react';
import { useApp, setData, closeSheet, flash } from '../lib/store';
import { HUES, TEXT, ink, tint } from '../lib/constants';
import { fmt, num, roundAmt, uid } from '../lib/derive';
import { relDay, todayISO } from '../lib/dates';
import { describeDay, ordinal } from '../lib/schedule';
import type { Bill, NotifKind, ScheduleKind } from '../lib/types';
import { FieldLabel, GhostDanger, PrimaryBtn, Segmented, SmallAmount, Toggle, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';
import * as I from '../ui/icons';

const KIND_ITEMS: [ScheduleKind, string][] = [['Income', 'Income'], ['Bill', 'Bill'], ['Subscription', 'Subscription']];
const PLACEHOLDER = { Income: 'Salary', Bill: 'Rent', Subscription: 'Netflix' };
const DEFAULT_CAT = { Income: '', Bill: 'Home', Subscription: 'Entertainment' };
const chip = (on: boolean) => ({ background: on ? TEXT : '#fff', color: on ? '#fff' : TEXT });

/* ---------------- Add / edit scheduled income, bill or subscription ---------------- */
export function ScheduleSheet({ id, day, kind: kind0 }: { id: string | null; day?: number; kind?: ScheduleKind }) {
  const { data: d } = useApp();
  const base = id ? d.bills.find(b => b.id === id) : undefined;
  const [kind, setKind] = useState<ScheduleKind>(base?.kind ?? kind0 ?? 'Bill');
  const [name, setName] = useState(base?.name ?? '');
  const [amt, setAmt] = useState(base ? String(base.amt) : '');
  const [dueDay, setDueDay] = useState(base?.dueDay ?? day ?? 1);
  const [acct, setAcct] = useState(base?.acct ?? (d.accounts.find(a => a.type === 'bank') || d.accounts[0])?.id ?? '');
  const [auto, setAuto] = useState(base ? !!base.auto : true);
  const [pocket, setPocket] = useState(base?.pocket ?? '');
  const [cat, setCat] = useState(base?.cat ?? DEFAULT_CAT[base?.kind ?? kind0 ?? 'Bill']);
  const [confirmDel, setConfirmDel] = useState(false);

  const income = kind === 'Income';
  const accounts = income ? d.accounts.filter(a => a.type !== 'card') : d.accounts;
  const acctOk = accounts.some(a => a.id === acct);
  const v = num(amt), cant = !name.trim() || !(v > 0) || (auto && !acctOk);
  const acctName = accounts.find(a => a.id === acct)?.name;
  const hue = base?.hue ?? (income ? 150 : HUES[d.bills.length % HUES.length]);

  const pickKind = (k: ScheduleKind) => {
    setKind(k);
    if (!base) setCat(DEFAULT_CAT[k]);
    if (k === 'Income' && !d.accounts.some(a => a.id === acct && a.type !== 'card')) setAcct(d.accounts.find(a => a.type !== 'card')?.id ?? '');
  };

  const save = () => {
    if (cant) return;
    const today = todayISO();
    // Only start moving money from today on, so nothing is charged retroactively.
    const restart = !base || (auto && (!base.auto || base.acct !== acct));
    const subs = d.cats.find(c => c.name === cat)?.subs || [];
    const patch: Partial<Bill> = {
      name: name.trim(), kind, amt: roundAmt(v), dueDay, acct: acctOk ? acct : undefined, auto: auto && acctOk,
      pocket: income ? undefined : pocket || undefined, cat: income ? undefined : cat, sub: income ? undefined : base?.cat === cat ? base.sub : subs[0] || '',
      start: restart ? today : base?.start
    };
    if (base) setData(x => ({ bills: x.bills.map(b => (b.id === base.id ? { ...b, ...patch } : b)) }));
    else setData(x => ({ bills: [...x.bills, { id: uid('b'), hue, paidMonths: [], ...patch } as Bill] }));
    closeSheet(); flash(base ? `${patch.name} updated` : `${patch.name} scheduled`);
  };
  const remove = () => {
    if (!confirmDel) return setConfirmDel(true);
    setData(x => ({ bills: x.bills.filter(b => b.id !== base!.id) }));
    closeSheet(); flash(`${base!.name} deleted`);
  };

  return (
    <SheetFrame title={base ? `Edit ${base.kind.toLowerCase()}` : 'New scheduled item'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Segmented items={KIND_ITEMS} value={kind} onPick={pickKind} mt={6} />
        <FieldLabel m="14px 4px 6px">Name</FieldLabel>
        <input value={name} placeholder={PLACEHOLDER[kind]} onChange={e => setName(e.target.value)} style={textInput} />
        <FieldLabel m="14px 4px 6px">Amount</FieldLabel>
        <SmallAmount value={amt} onChange={setAmt} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 4px 6px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Day of the month</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)' }}>Every {ordinal(dueDay)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4, background: '#fff', borderRadius: 22, padding: 8 }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setDueDay(n)} style={{ height: 36, borderRadius: 12, border: 0, background: n === dueDay ? ink(hue) : 'transparent', color: n === dueDay ? '#fff' : TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{n}</button>
          ))}
        </div>
        {dueDay > 28 && <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>In shorter months it happens on the last day.</span>}

        <FieldLabel>{income ? 'Goes into' : 'Paid from'}</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {accounts.map(a => (
            <button key={a.id} onClick={() => setAcct(a.id)} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${a.id === acct ? ink(a.hue) : '#fff'}`, background: a.id === acct ? tint(a.hue) : '#fff', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{a.type === 'card' ? `${fmt((a.limit || 0) - a.bal)} available` : fmt(a.bal)}</span>
            </button>
          ))}
          {accounts.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Add {income ? 'a bank or cash account' : 'an account'} first, in the Accounts tab.</span>}
        </div>

        <div style={{ marginTop: 12, background: '#fff', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{income ? 'Add to my balance automatically' : 'Pay automatically'}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
              {auto && acctName ? `${income ? '+' : '−'}${fmt(v)} ${income ? 'into' : 'from'} ${acctName} on the ${ordinal(dueDay)}` : "Just remind me, I'll tick it off myself"}
            </span>
          </div>
          <Toggle on={auto} onChange={setAuto} label="Automatic" />
        </div>

        {!income && <>
          <FieldLabel>Pocket (optional)</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[{ id: '', name: 'No pocket' }, ...d.pockets].map(p => (
              <button key={p.id} onClick={() => setPocket(p.id)} style={{ height: 34, padding: '0 13px', borderRadius: 999, border: 0, ...chip(p.id === pocket), fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{p.name}</button>
            ))}
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>{pocket ? "It will count toward this pocket's weekly budget." : "It won't take money from your weekly pockets."}</span>
          <FieldLabel>Category</FieldLabel>
          <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
            {d.cats.map(k => (
              <button key={k.name} onClick={() => setCat(k.name)} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, border: 0, ...chip(k.name === cat), fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 0 0 1px var(--color-neutral-200)' }}>{k.name}</button>
            ))}
          </div>
        </>}

        <PrimaryBtn onClick={save} disabled={cant} mt={18}>{base ? 'Save changes' : `Schedule ${kind.toLowerCase()}`}</PrimaryBtn>
        {base && <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete' : `Delete ${base.kind.toLowerCase()}`}</GhostDanger>}
        {base && <span style={{ margin: '4px 4px 0', fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'center' }}>{describeDay(base)}. Past transactions stay in your history.</span>}
      </div>
    </SheetFrame>
  );
}

/* ---------------- Notifications ---------------- */
export const NOTIF_TONE: Record<NotifKind, { bg: string; fg: string }> = {
  bill: { bg: 'var(--color-accent-100)', fg: 'var(--color-accent-700)' },
  income: { bg: 'oklch(0.95 0.045 155)', fg: 'oklch(0.42 0.09 155)' },
  budget: { bg: 'oklch(0.96 0.055 92)', fg: 'oklch(0.46 0.09 75)' },
  card: { bg: 'oklch(0.94 0.04 250)', fg: 'oklch(0.42 0.1 250)' }
};
export const NotifIcon = ({ kind, size = 18 }: { kind: NotifKind; size?: number }) =>
  kind === 'income' ? <I.Plus size={size} /> : kind === 'budget' ? <I.Alert size={size} /> : kind === 'card' ? <I.Card size={size} /> : <I.Calendar size={size} />;

export function NotificationsSheet() {
  const { data: d } = useApp();
  const today = todayISO();
  const list = d.notifications.filter(n => !n.dismissed);
  useEffect(() => {
    if (d.notifications.some(n => !n.read)) setData(x => ({ notifications: x.notifications.map(n => ({ ...n, read: true, bannered: true })) }));
  }, [d.notifications]);
  const dismiss = (id: string) => setData(x => ({ notifications: x.notifications.map(n => (n.id === id ? { ...n, dismissed: true } : n)) }));
  return (
    <SheetFrame title="Notifications">
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 320 }}>
        {list.length > 0 && (
          <button onClick={() => setData(x => ({ notifications: x.notifications.map(n => ({ ...n, dismissed: true })) }))} style={{ alignSelf: 'flex-end', margin: '0 4px 8px', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Dismiss all</button>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.map(n => (
            <div key={n.id} style={{ background: '#fff', borderRadius: 20, padding: '12px 10px 12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: NOTIF_TONE[n.kind].bg, color: NOTIF_TONE[n.kind].fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><NotifIcon kind={n.kind} /></div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{n.title}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.35 }}>{n.body}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', marginTop: 2 }}>{relDay(n.date, today)}</span>
              </div>
              <button onClick={() => dismiss(n.id)} aria-label="Dismiss" style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.X size={14} /></button>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ background: '#fff', borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.Bell size={20} /></div>
              <span style={{ fontSize: 15, fontWeight: 700 }}>You're all caught up</span>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Bills due tomorrow, money that arrives or leaves automatically, and budget warnings show up here.</span>
            </div>
          )}
        </div>
      </div>
    </SheetFrame>
  );
}
