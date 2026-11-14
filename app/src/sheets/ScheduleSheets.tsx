import { useEffect, useState } from 'react';
import { cardCycle, cardDueLabel, payDayOf } from '../lib/cards';
import { openTripLink } from '../lib/tripNotify';
import { useApp, setData, closeSheet, flash, openSheet } from '../lib/store';
import { HUES, TEXT, ink, tint } from '../lib/constants';
import { fmt, num, roundAmt, uid } from '../lib/derive';
import { relDay, todayISO } from '../lib/dates';
import { ensureTrm, fmtUsd, latestRate, trmFor } from '../lib/trm';
import { KIND_LABEL, describeDay, ordinal } from '../lib/schedule';
import { DEFAULT_BEFORE, DEFAULT_DAY, notifyTime } from '../lib/reminders';
import type { Bill, NotifKind, ScheduleKind } from '../lib/types';
import { BillBadge, FieldLabel, GhostDanger, PrimaryBtn, Segmented, SmallAmount, Toggle, textInput } from '../ui/bits';
import { pickPhoto } from '../lib/photo';
import { makeBackup } from '../lib/backup';
import { SheetFrame } from './Sheet';
import * as I from '../ui/icons';

const KIND_ITEMS: [ScheduleKind, string][] = [['Income', 'Income'], ['Bill', 'Bill'], ['Subscription', 'Subscription'], ['CardPayment', 'Card payment']];
const PLACEHOLDER: Record<ScheduleKind, string> = { Income: 'Salary', Bill: 'Rent', Subscription: 'Netflix', CardPayment: 'Card payment' };
const DEFAULT_CAT: Record<ScheduleKind, string> = { Income: '', Bill: 'Home', Subscription: 'Entertainment', CardPayment: '' };
/** "Nov 15" → 15 */
const chip = (on: boolean) => ({ background: on ? TEXT : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT });

/* ---------------- Add / edit scheduled income, bill or subscription ---------------- */
export function ScheduleSheet({ id, day, kind: kind0 }: { id: string | null; day?: number; kind?: ScheduleKind }) {
  const { data: d } = useApp();
  const base = id ? d.bills.find(b => b.id === id) : undefined;
  const [kind, setKind] = useState<ScheduleKind>(base?.kind ?? kind0 ?? 'Bill');
  const [name, setName] = useState(base?.name ?? '');
  const [amt, setAmt] = useState(base ? String(base.amt) : '');
  const [currency, setCurrency] = useState<'USD' | 'COP'>(base?.currency ?? 'COP');
  const canUsd = d.settings.currency === 'COP';
  const usd = canUsd && currency === 'USD';
  const todayTrm = trmFor(d, todayISO());
  useEffect(() => { if (usd) ensureTrm([todayISO()]); }, [usd]);
  const rate = todayTrm ?? latestRate(d);
  const [dueDay, setDueDay] = useState(base?.dueDay ?? day ?? 1);
  const [acct, setAcct] = useState(base?.acct ?? (d.accounts.find(a => a.type === 'bank') || d.accounts[0])?.id ?? '');
  const [auto, setAuto] = useState(base ? !!base.auto : true);
  const [others, setOthers] = useState(!!base?.notMine);
  const [pocket, setPocket] = useState(base?.pocket ?? '');
  const [cat, setCat] = useState(base?.cat ?? DEFAULT_CAT[base?.kind ?? kind0 ?? 'Bill']);
  const [confirmDel, setConfirmDel] = useState(false);
  const [photo, setPhoto] = useState<string | null>(base?.photo ?? null);
  const cards = d.accounts.filter(a => a.type === 'card');
  const [toCard, setToCard] = useState(base?.toCard ?? cards[0]?.id ?? '');
  const [payMode, setPayMode] = useState<'full' | 'fixed'>(base?.payMode === 'fixed' ? 'fixed' : 'full');
  // Lock-screen notifications for this event: the day before and on the day, each at its own time (or off).
  const [before, setBefore] = useState<string | null>(base ? notifyTime(base, 'before') : DEFAULT_BEFORE);
  const [onDay, setOnDay] = useState<string | null>(base ? notifyTime(base, 'day') : DEFAULT_DAY);

  const income = kind === 'Income', cardPay = kind === 'CardPayment';
  const accounts = income || cardPay ? d.accounts.filter(a => a.type !== 'card') : d.accounts;
  const acctOk = accounts.some(a => a.id === acct);
  const card = cards.find(c => c.id === toCard);
  const v = num(amt);
  const notMineOn = others && !income && !cardPay;
  const cy = card ? cardCycle(d, card, todayISO()) : null;
  const cant = cardPay ? !card || !acctOk || (payMode === 'fixed' && !(v > 0)) : !name.trim() || !(v > 0) || (auto && !notMineOn && !acctOk);
  const acctName = accounts.find(a => a.id === acct)?.name;
  const hue = base?.hue ?? (income ? 150 : HUES[d.bills.length % HUES.length]);

  const pickKind = (k: ScheduleKind) => {
    setKind(k);
    if (!base) setCat(DEFAULT_CAT[k]);
    if ((k === 'Income' || k === 'CardPayment') && !d.accounts.some(a => a.id === acct && a.type !== 'card')) setAcct(d.accounts.find(a => a.type !== 'card')?.id ?? '');
    if (k === 'CardPayment' && !base && card) setDueDay(payDayOf(card) || dueDay);
  };

  const save = () => {
    if (cant) return;
    const today = todayISO();
    // Only start moving money from today on, so nothing is charged retroactively.
    const restart = !base || (auto && (!base.auto || base.acct !== acct || base.toCard !== toCard));
    const subs = d.cats.find(c => c.name === cat)?.subs || [];
    const patch: Partial<Bill> = cardPay ? {
      name: `${card!.name} payment`, hue: card!.hue, kind, amt: payMode === 'fixed' ? roundAmt(v) : 0, currency: undefined, dueDay, photo: card!.photo ?? null, acct, toCard, payMode, auto,
      pocket: undefined, cat: undefined, sub: undefined, start: restart ? today : base?.start
    } : {
      name: name.trim(), kind, amt: usd ? Math.round(v * 100) / 100 : roundAmt(v), currency: usd ? 'USD' : undefined, dueDay, photo, acct: acctOk && !notMineOn ? acct : undefined, auto: auto && acctOk && !notMineOn, notMine: notMineOn || undefined,
      pocket: income || notMineOn ? undefined : pocket || undefined, cat: income ? undefined : cat, sub: income ? undefined : base && base.cat === cat ? base.sub : subs[0] || '',
      start: restart ? today : base?.start
    };
    patch.notify = before === DEFAULT_BEFORE && onDay === DEFAULT_DAY ? undefined : { before, day: onDay };
    if (base) setData(x => ({ bills: x.bills.map(b => (b.id === base.id ? { ...b, ...patch } : b)) }));
    else setData(x => ({ bills: [...x.bills, { id: uid('b'), hue, paidMonths: [], ...patch } as Bill] }));
    closeSheet(); flash(base ? `${patch.name} updated` : `${patch.name} scheduled`);
  };
  const notifRow = (label: string, sub: string, v: string | null, set: (x: string | null) => void, def: string) => (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0' }}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{v ? sub : 'Off'}</span>
              </span>
              {v && <input type="time" value={v} onChange={e => set(e.target.value || def)} aria-label={`${label}: time`} style={{ height: 40, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', color: TEXT, padding: '0 10px', fontSize: 16, fontWeight: 700, fontFamily: 'inherit' }} />}
              <Toggle on={!!v} onChange={on => set(on ? def : null)} label={label} />
            </div>
          );
  const remove = () => {
    if (!confirmDel) return setConfirmDel(true);
    setData(x => ({ bills: x.bills.filter(b => b.id !== base!.id) }));
    closeSheet(); flash(`${base!.name} deleted`);
  };

  return (
    <SheetFrame title={base ? `Edit ${KIND_LABEL[base.kind].toLowerCase()}` : 'New scheduled item'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 4, marginTop: 6, background: 'var(--color-neutral-200)', borderRadius: 22, padding: 4 }}>
          {KIND_ITEMS.map(([k, label]) => (
            <button key={k} onClick={() => pickKind(k)} style={{ height: 38, borderRadius: 18, border: 0, background: kind === k ? 'var(--surface)' : 'transparent', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: kind === k ? 'var(--shadow-sm)' : 'none', transition: 'background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease' }}>{label}</button>
          ))}
        </div>
        {cardPay ? <>
          <FieldLabel m="14px 4px 6px">Card to pay</FieldLabel>
          <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
            {cards.map(c => (
              <button key={c.id} onClick={() => { setToCard(c.id); if (!base) setDueDay(payDayOf(c) || dueDay); }} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${c.id === toCard ? ink(c.hue) : 'var(--surface)'}`, background: c.id === toCard ? tint(c.hue) : 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{c.name}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{cardDueLabel(d, c, todayISO()) ? `${fmt(c.bal)} owed · due ${cardDueLabel(d, c, todayISO())}` : `${fmt(c.bal)} owed`}</span>
              </button>
            ))}
            {cards.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Add a credit card first, in the Accounts tab.</span>}
          </div>
          <FieldLabel m="14px 4px 0">How much</FieldLabel>
          <Segmented items={[['full', 'Minimum payment'], ['fixed', 'Fixed amount']]} value={payMode} onPick={setPayMode} mt={6} />
          {payMode === 'fixed' && <div style={{ marginTop: 8 }}><SmallAmount value={amt} onChange={setAmt} /></div>}
          <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>
            {payMode === 'full' ? (cy?.cycle ? `Pays what you bought up to the cutoff and haven't paid yet (now ${fmt(cy.statement)}). What you buy after the cutoff waits for the next cycle.` : `Pays whatever the card owes that day${card ? ` (now ${fmt(card.bal)})` : ''}. Add the card's cutoff day to leave out what you buy after it.`) : 'Never more than the card owes.'} If the account doesn't have enough, it pays what's there.
          </span>
        </> : <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', borderRadius: 22, padding: 12, marginTop: 12 }}>
          <BillBadge b={{ name: name || PLACEHOLDER[kind], hue, kind, photo }} size={56} radius={18} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <button onClick={() => pickPhoto().then(p => p && setPhoto(p))} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <I.Image size={14} />{photo ? 'Change logo' : 'Add logo'}
            </button>
            {photo && <button onClick={() => setPhoto(null)} style={{ padding: '0 4px', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Remove logo</button>}
          </div>
        </div>
        <FieldLabel m="14px 4px 6px">Name</FieldLabel>
        <input value={name} placeholder={PLACEHOLDER[kind]} onChange={e => setName(e.target.value)} style={textInput} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '14px 4px 6px', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Amount</span>
          {canUsd && (
            <div style={{ display: 'flex', gap: 2, background: 'var(--color-neutral-200)', borderRadius: 999, padding: 3 }}>
              {(['COP', 'USD'] as const).map(c => (
                <button key={c} onClick={() => { if (c !== currency) { setCurrency(c); setAmt(''); } }} style={{ height: 28, padding: '0 12px', borderRadius: 999, border: 0, background: currency === c ? 'var(--surface)' : 'transparent', boxShadow: currency === c ? 'var(--shadow-sm)' : 'none', color: TEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{c === 'COP' ? 'Pesos' : 'Dollars'}</button>
              ))}
            </div>
          )}
        </div>
        {usd ? (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: 'var(--surface)', borderRadius: 18, padding: '13px 18px' }}>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-400)' }}>US$</span>
            <input type="text" inputMode="decimal" placeholder="0,00" value={amt.replace('.', ',')} onChange={e => setAmt(e.target.value.replace(',', '.').replace(/[^\d.]/g, '').replace(/(\..*)\./g, '$1').replace(/(\.\d{2}).+/, '$1'))}
              style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
          </div>
        ) : <SmallAmount value={amt} onChange={setAmt} />}
        {usd && (
          <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>
            {todayTrm ? `Today's TRM is ${fmt(todayTrm)}` : `About ${fmt(rate)} per dollar`}{v > 0 ? `, so ${fmtUsd(v)} ≈ ${fmt(v * rate)}` : ''}. {auto ? 'On the day it runs, it uses that day\'s official TRM.' : ''}
          </span>
        )}
        </>}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '14px 4px 6px' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Day of the month</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)' }}>Every {ordinal(dueDay)}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4, background: 'var(--surface)', borderRadius: 22, padding: 8 }}>
          {Array.from({ length: 31 }, (_, i) => i + 1).map(n => (
            <button key={n} onClick={() => setDueDay(n)} style={{ height: 36, borderRadius: 12, border: 0, background: n === dueDay ? ink(hue) : 'transparent', color: n === dueDay ? 'var(--on-text)' : TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{n}</button>
          ))}
        </div>
        {dueDay > 28 && <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>In shorter months it happens on the last day.</span>}

        {!income && !cardPay && (
          <div style={{ marginTop: 16, background: 'var(--surface)', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 15, fontWeight: 600 }}>Not paid by me</span>
              <span style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>{others ? 'Someone else pays it. It stays on your list and you still get reminders, but no money is taken and it isn’t counted in your totals.' : 'Turn on for things you use but someone else pays, like a shared family plan.'}</span>
            </div>
            <Toggle on={others} onChange={setOthers} label="Not paid by me" />
          </div>
        )}

        {!notMineOn && <>
        <FieldLabel>{income ? 'Goes into' : 'Paid from'}</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {accounts.map(a => (
            <button key={a.id} onClick={() => setAcct(a.id)} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${a.id === acct ? ink(a.hue) : 'var(--surface)'}`, background: a.id === acct ? tint(a.hue) : 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{a.type === 'card' ? `${fmt((a.limit || 0) - a.bal)} available` : fmt(a.bal)}</span>
            </button>
          ))}
          {accounts.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Add {income ? 'a bank or cash account' : 'an account'} first, in the Accounts tab.</span>}
        </div>

        <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>{income ? 'Add to my balance automatically' : 'Pay automatically'}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>
              {auto && acctName ? (cardPay ? `${payMode === 'full' ? 'Minimum payment' : fmt(v)} from ${acctName} to ${card?.name || 'the card'} on the ${ordinal(dueDay)}` : `${income ? '+' : '−'}${usd ? fmtUsd(v) + ' in pesos' : fmt(v)} ${income ? 'into' : 'from'} ${acctName} on the ${ordinal(dueDay)}`) : "Just remind me, I'll tick it off myself"}
            </span>
          </div>
          <Toggle on={auto} onChange={setAuto} label="Automatic" />
        </div>
        </>}

        {!income && !cardPay && !notMineOn && <>
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

        <FieldLabel m="18px 4px 6px">Notifications</FieldLabel>
        <div style={{ background: 'var(--surface)', borderRadius: 20, padding: '2px 14px' }}>
          {notifRow('The day before', income ? 'A reminder that it arrives tomorrow' : 'A reminder that it\'s due tomorrow', before, setBefore, DEFAULT_BEFORE)}
          <div style={{ height: 1, background: 'var(--color-neutral-200)' }} />
          {notifRow('On the day', income ? 'When it arrives' : auto && !notMineOn ? 'When it\'s charged' : 'When it\'s due', onDay, setOnDay, DEFAULT_DAY)}
        </div>
        <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Lock-screen notifications (turn them on in Profile). They arrive within a few minutes of the time you pick.</span>
        <PrimaryBtn onClick={save} disabled={cant} mt={18}>{base ? 'Save changes' : `Schedule ${KIND_LABEL[kind].toLowerCase()}`}</PrimaryBtn>
        {base && <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete' : `Delete ${KIND_LABEL[base.kind].toLowerCase()}`}</GhostDanger>}
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
  card: { bg: 'oklch(0.94 0.04 250)', fg: 'oklch(0.42 0.1 250)' },
  backup: { bg: 'var(--color-neutral-200)', fg: 'var(--color-neutral-800)' },
  trip: { bg: 'oklch(0.94 0.045 300)', fg: 'oklch(0.42 0.11 300)' },
  dm: { bg: 'oklch(0.94 0.04 240)', fg: 'oklch(0.42 0.11 240)' },
  reminder: { bg: 'oklch(0.95 0.05 60)', fg: 'oklch(0.45 0.1 55)' }
};
export const NotifIcon = ({ kind, size = 18 }: { kind: NotifKind; size?: number }) =>
  kind === 'reminder' ? <I.Bell size={size} /> : kind === 'income' ? <I.Plus size={size} /> : kind === 'budget' ? <I.Alert size={size} /> : kind === 'card' ? <I.Card size={size} /> : kind === 'backup' ? <I.Download size={size} /> : kind === 'dm' ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" /></svg> : kind === 'trip' ? <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.6c2.6.2 4.5 1.9 5 4.9" /></svg> : <I.Calendar size={size} />;

/** One tap: opens the share sheet with the backup file, then clears the reminder. */
export function BackupNowButton({ id }: { id: string }) {
  return (
    <button onClick={async e => {
      e.stopPropagation();
      const r = await makeBackup();
      if (r === 'cancelled') return;
      setData(x => ({ notifications: x.notifications.map(n => (n.id === id ? { ...n, dismissed: true, bannered: true } : n)) }));
      flash(r === 'shared' ? 'Backup saved' : 'Backup downloaded to Files');
    }} style={{ alignSelf: 'flex-start', marginTop: 8, height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
      <I.Download size={14} />Back up now
    </button>
  );
}

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
            <div key={n.id} onClick={n.kind === 'reminder' ? () => { dismiss(n.id); openSheet({ name: 'add' }); } : n.link ? () => { dismiss(n.id); openTripLink(n.link!); } : undefined} style={{ background: 'var(--surface)', borderRadius: 20, padding: '12px 10px 12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12, cursor: n.link ? 'pointer' : 'default' }}>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: NOTIF_TONE[n.kind].bg, color: NOTIF_TONE[n.kind].fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><NotifIcon kind={n.kind} /></div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{n.title}</span>
                <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.35 }}>{n.body}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-neutral-500)', marginTop: 2 }}>{relDay(n.date, today)}{n.link ? (n.link.chat || n.link.dm ? ' · Tap to open the chat' : ' · Tap to see it') : ''}</span>
                {n.kind === 'backup' && <BackupNowButton id={n.id} />}
              </div>
              <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} aria-label="Dismiss" style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.X size={14} /></button>
            </div>
          ))}
          {list.length === 0 && (
            <div style={{ background: 'var(--surface)', borderRadius: 22, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-500)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><I.Bell size={20} /></div>
              <span style={{ fontSize: 15, fontWeight: 700 }}>You're all caught up</span>
              <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>Bills due tomorrow, money that arrives or leaves automatically, budget warnings and news from your shared trips show up here.</span>
            </div>
          )}
        </div>
      </div>
    </SheetFrame>
  );
}
