// Debts between you and one person: add or edit one, see it, and record payments back.
import { useState, type ReactNode } from 'react';
import { useApp, setData, closeSheet, openSheet, flash, setUI } from '../lib/store';
import { LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { fmt, num, roundAmt, uid } from '../lib/derive';
import { shortDate, todayISO } from '../lib/dates';
import { addDebtPay, debtTiming, deleteDebt, deleteDebtPay, leftOf, paidOf, saveDebt } from '../lib/debts';
import type { Account, Data, Debt } from '../lib/types';
import { BigAmount, Bar, FieldLabel, GhostDanger, PrimaryBtn, Segmented, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';
import { Avatar, useSocial } from '../screens/Social';
import { myUid } from '../lib/social';

export const GREEN = 'var(--money-in)';
const OK_BG = 'var(--ok-bg)', OK_INK = 'var(--ok-ink)', WARN_BG = 'var(--warn-bg)', WARN_INK = 'var(--warn-ink)';

/** Whether a debt changes your pockets, as a small colored note. */
export function TimingNote({ d, x, today }: { d: Data; x: Debt; today: string }) {
  const t = debtTiming(d, x, today);
  if (t.tone === 'none') return null;
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', background: t.tone === 'ok' ? OK_BG : WARN_BG, color: t.tone === 'ok' ? OK_INK : WARN_INK, borderRadius: 16, padding: '10px 12px', fontSize: 13, lineHeight: 1.4 }}>
      <span aria-hidden="true">{t.tone === 'ok' ? '✓' : '!'}</span><span>{t.text}</span>
    </div>
  );
}

/** Account choices as pills, plus "No account". */
function AcctPills({ accts, value, onPick, none }: { accts: Account[]; value: string; onPick: (id: string) => void; none: string }) {
  const pill = (key: string, on: boolean, hue: number | null, label: ReactNode, sub: string) => (
    <button key={key} onClick={() => onPick(key)} aria-pressed={on} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${on ? (hue == null ? TEXT : ink(hue)) : 'var(--surface)'}`, background: on ? (hue == null ? 'var(--color-neutral-100)' : tint(hue)) : 'var(--surface)', color: TEXT, cursor: 'pointer', textAlign: 'left' }}>
      <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{sub}</span>
    </button>
  );
  return (
    <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
      {accts.map(a => pill(a.id, value === a.id, a.hue, a.name, a.type === 'card' ? 'Credit card' : fmt(a.bal)))}
      {pill('', value === '', null, none, 'No balance changes')}
    </div>
  );
}

const dateInput = (value: string, onChange: (v: string) => void, label: string) => (
  <input type="date" value={value} onChange={e => onChange(e.target.value)} aria-label={label} style={{ ...textInput, width: '100%', boxSizing: 'border-box', fontWeight: 600, minHeight: 52 }} />
);

/* ---------------- Add, edit or see a debt ---------------- */
export function DebtSheet({ id, dir: dir0, friend }: { id: string | null; dir?: 'owed' | 'owe'; friend?: { uid: string; name: string } }) {
  const { data: d, ui } = useApp();
  const old = id ? (d.debts ?? []).find(x => x.id === id) : undefined;
  const [editing, setEditing] = useState(!old);
  if (id && !old) return <SheetFrame title="Debt"><span style={{ fontSize: 14 }}>This debt was deleted.</span></SheetFrame>;
  if (old && !editing) return <DebtView x={old} onEdit={() => setEditing(true)} />;
  return <DebtForm old={old} dir0={dir0} friend={friend} lastAcct={ui.lastAdd?.acct} onDone={x => { if (old) setEditing(false); else openSheet({ name: 'debt', id: x.id }); }} />;
}

function DebtForm({ old, dir0, friend, lastAcct, onDone }: { old?: Debt; dir0?: 'owed' | 'owe'; friend?: { uid: string; name: string }; lastAcct?: string; onDone: (x: Debt) => void }) {
  const { data: d } = useApp();
  const so = useSocial();
  const today = todayISO();
  const friends = so.friends.filter(f => f.status === 'accepted' && f.uid && f.uid !== myUid());
  const [dir, setDir] = useState<'owed' | 'owe'>(old?.dir ?? dir0 ?? 'owed');
  const [name, setName] = useState(old?.name ?? friend?.name ?? '');
  const [fr, setFr] = useState<string | undefined>(old?.friend ?? friend?.uid);
  const [amt, setAmt] = useState(old ? String(old.amt) : '');
  const [note, setNote] = useState(old?.note ?? '');
  const [acct, setAcct] = useState(old ? old.acct ?? '' : d.accounts.some(a => a.id === lastAcct) ? lastAcct! : d.accounts[0]?.id ?? '');
  const [date, setDate] = useState(old?.date ?? today);
  const [due, setDue] = useState(old?.due ?? '');
  const v = roundAmt(num(amt)), a = d.accounts.find(x => x.id === acct);
  const paid = old ? paidOf(old) : 0;
  const draft: Debt = { id: old?.id ?? uid('debt'), ts: old?.ts ?? Date.now(), dir, name: name.trim(), friend: fr, amt: v, date: date || today, due: due || undefined, acct: acct || undefined, note: note.trim() || undefined, pays: old?.pays ?? [] };
  const bad = !name.trim() || !(v > 0) || v < paid - 0.004 || (!!due && due < draft.date);
  const save = () => {
    if (bad) return;
    setData(x => saveDebt(x, draft));
    flash(old ? 'Debt updated' : dir === 'owed' ? `${draft.name} owes you ${fmt(v)}` : `Saved: you owe ${fmt(v)} to ${draft.name}`);
    onDone(draft);
  };
  const owed = dir === 'owed';
  const effect = a && !(v > 0) ? '' : !a ? (owed ? 'Only tracks the debt. Use this if the money already left an account you registered before.' : 'Only tracks the debt. No account balance changes.')
    : owed ? (a.type === 'card' ? `${a.name} will owe ${fmt(v)} more. It isn't counted as your spending.` : `${a.name} goes down ${fmt(v)}. It isn't counted as your spending.`)
      : (a.type === 'card' ? `${a.name} will owe ${fmt(v)} less. It isn't counted as income.` : `${a.name} goes up ${fmt(v)}. It isn't counted as income.`);
  return (
    <SheetFrame title={old ? 'Edit debt' : owed ? 'Someone owes me' : 'I owe someone'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Segmented items={[['owed', 'They owe me'], ['owe', 'I owe them']]} value={dir} onPick={setDir} mt={0} />
        <FieldLabel>{owed ? 'Who owes you' : 'Who you owe'}</FieldLabel>
        {friends.length > 0 && (
          <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px 8px', padding: '0 20px' }}>
            {friends.map(f => {
              const on = fr === f.uid;
              return (
                <button key={f.uid} onClick={() => { setFr(on ? undefined : f.uid); setName(on ? '' : f.name); }} aria-pressed={on} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: 8, height: 44, padding: '0 14px 0 6px', borderRadius: 999, border: `2px solid ${on ? TEXT : 'var(--surface)'}`, background: on ? 'var(--color-neutral-100)' : 'var(--surface)', color: TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                  <Avatar name={f.name} uid={f.uid} size={30} />{f.name}
                </button>
              );
            })}
          </div>
        )}
        <input value={name} onChange={e => { setName(e.target.value); if (fr) setFr(undefined); }} placeholder={friends.length ? 'Or type any name, like Juan' : 'Name, like Juan'} aria-label="Name" style={textInput} />
        <BigAmount value={amt} onChange={setAmt} mt={12} />
        {old && paid > 0 && v < paid - 0.004 && <span style={{ margin: '6px 4px 0', fontSize: 12.5, color: RED }}>{`It can't be less than the ${fmt(paid)} already paid back.`}</span>}
        <FieldLabel>What for (optional)</FieldLabel>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={owed ? 'Concert tickets' : 'Rent help'} aria-label="What for" style={textInput} />
        <FieldLabel>{owed ? 'Paid with' : 'Money went into'}</FieldLabel>
        <AcctPills accts={d.accounts} value={acct} onPick={setAcct} none="No account" />
        {effect && <span style={{ margin: '8px 6px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{effect}</span>}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}><FieldLabel>When</FieldLabel>{dateInput(date, setDate, 'When')}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}><FieldLabel>{owed ? 'Pays you back by' : 'You pay back by'}</FieldLabel>{dateInput(due, setDue, owed ? 'Pays you back by' : 'You pay back by')}</div>
        </div>
        {!!due && due < draft.date && <span style={{ margin: '6px 4px 0', fontSize: 12.5, color: RED }}>The pay-back date is before the debt started.</span>}
        {name.trim() && v > 0 && <div style={{ marginTop: 12 }}><TimingNote d={d} x={draft} today={today} /></div>}
        <PrimaryBtn onClick={save} disabled={bad}>{old ? 'Save changes' : 'Save debt'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

function DebtView({ x, onEdit }: { x: Debt; onEdit: () => void }) {
  const { data: d } = useApp();
  const today = todayISO(), left = leftOf(x), paid = paidOf(x), owed = x.dir === 'owed';
  const acctName = (id?: string) => d.accounts.find(a => a.id === id)?.name;
  const color = left <= 0.004 ? GREEN : owed ? GREEN : RED;
  const pays = [...x.pays].sort((a, b) => (a.date < b.date ? 1 : -1));
  const del = () => {
    if (!confirm(`Delete this debt with ${x.name}? Any account changes it made are undone.`)) return;
    setData(y => deleteDebt(y, x.id)); closeSheet(); flash('Debt deleted');
  };
  return (
    <SheetFrame title={owed ? `${x.name} owes you` : `You owe ${x.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar name={x.name} uid={x.friend} size={40} />
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
              <span translate="no" style={{ fontSize: 16, fontWeight: 700 }}>{x.name}</span>
              <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{x.note ? <span translate="no">{x.note} · </span> : null}{shortDate(x.date)}</span>
            </span>
          </div>
          <span style={{ marginTop: 4, fontSize: 13, color: 'var(--color-neutral-700)' }}>{left > 0.004 ? 'Still owed' : 'Paid back in full'}</span>
          <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', color }}>{fmt(left > 0.004 ? left : x.amt)}</span>
          <Bar pct={`${Math.min(100, (paid / x.amt) * 100)}%`} track="var(--color-neutral-100)" fill={GREEN} />
          <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{`${fmt(paid)} of ${fmt(x.amt)} paid back`}{x.due && left > 0.004 ? ` · ${owed ? 'pays you back by' : 'you pay back by'} ${shortDate(x.due)}` : ''}</span>
          {x.acct && <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)' }}>{owed ? `Paid with ${acctName(x.acct) ?? 'a deleted account'}` : `Went into ${acctName(x.acct) ?? 'a deleted account'}`}</span>}
        </div>
        <TimingNote d={d} x={x} today={today} />
        {left > 0.004 && <PrimaryBtn mt={0} onClick={() => openSheet({ name: 'debtPay', id: x.id })}>{owed ? `${x.name} paid me back` : `I paid ${x.name} back`}</PrimaryBtn>}
        <div style={{ display: 'grid', gridTemplateColumns: x.friend ? '1fr 1fr' : '1fr', gap: 8 }}>
          <button onClick={onEdit} className="hv-n200" style={{ height: 46, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Edit</button>
          {x.friend && <button onClick={() => { closeSheet(); setUI({ page: `dm:${x.friend}` }); }} className="hv-n200" style={{ height: 46, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Message</button>}
        </div>
        {pays.length > 0 && (
          <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '6px 16px' }}>
            {pays.map((p, i) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: i ? `1px solid ${LINE}` : 0 }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{owed ? 'Paid you back' : 'You paid back'}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{shortDate(p.date)}{p.acct ? ` · ${acctName(p.acct) ?? ''}` : ''}</span>
                </span>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{fmt(p.amt)}</span>
                <button onClick={() => { if (confirm('Remove this payment? Its account change is undone.')) setData(y => deleteDebtPay(y, x.id, p.id)); }} aria-label="Remove payment" style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-700)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        )}
        <GhostDanger onClick={del}>Delete debt</GhostDanger>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Paying back ---------------- */
export function DebtPaySheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const x = (d.debts ?? []).find(y => y.id === id);
  const left = x ? leftOf(x) : 0;
  const [amt, setAmt] = useState(String(left));
  // Someone paying you back usually sends it to a bank or cash, even if you lent it with a card.
  const lentWith = d.accounts.find(a => a.id === x?.acct);
  const [acct, setAcct] = useState(x?.dir === 'owed' && lentWith?.type === 'card' ? d.accounts.find(a => a.type !== 'card')?.id ?? lentWith.id : x?.acct ?? d.accounts[0]?.id ?? '');
  const [date, setDate] = useState(todayISO());
  if (!x) return <SheetFrame title="Pay back"><span style={{ fontSize: 14 }}>This debt was deleted.</span></SheetFrame>;
  const owed = x.dir === 'owed', v = roundAmt(num(amt)), a = d.accounts.find(y => y.id === acct);
  const bad = !(v > 0) || v > left + 0.004;
  const save = () => {
    const pay = { id: uid('dp'), ts: Date.now(), amt: v, date: date || todayISO(), acct: acct || undefined };
    if (!addDebtPay(d, x.id, pay)) return;
    setData(y => addDebtPay(y, x.id, pay) ?? {});
    const rest = left - v;
    openSheet({ name: 'debt', id: x.id });
    flash(rest > 0.004 ? `${fmt(rest)} still owed` : owed ? `${x.name} paid you back in full 🎉` : `You paid ${x.name} back in full 🎉`);
  };
  return (
    <SheetFrame title={owed ? `${x.name} paid me back` : `I paid ${x.name} back`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px', fontSize: 13, color: 'var(--color-neutral-700)' }}>{`${fmt(left)} still owed`}</span>
        <BigAmount value={amt} onChange={setAmt} mt={8} />
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button onClick={() => setAmt(String(left))} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{`All of it · ${fmt(left)}`}</button>
          <button onClick={() => setAmt(String(roundAmt(left / 2)))} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Half</button>
        </div>
        {v > left + 0.004 && <span style={{ margin: '6px 4px 0', fontSize: 12.5, color: RED }}>{`That's more than the ${fmt(left)} still owed.`}</span>}
        <FieldLabel>{owed ? 'Money went into' : 'Paid from'}</FieldLabel>
        <AcctPills accts={d.accounts} value={acct} onPick={setAcct} none="No account" />
        <span style={{ margin: '8px 6px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
          {!a || !(v > 0) ? 'Only marks it as paid. No account balance changes.'
            : owed ? (a.type === 'card' ? `${a.name} will owe ${fmt(v)} less. It isn't counted as income.` : `${a.name} goes up ${fmt(v)}. It isn't counted as income.`)
              : (a.type === 'card' ? `${a.name} will owe ${fmt(v)} more. It isn't counted as spending.` : `${a.name} goes down ${fmt(v)}. It isn't counted as spending.`)}
        </span>
        <FieldLabel>When</FieldLabel>
        {dateInput(date, setDate, 'When')}
        <PrimaryBtn onClick={save} disabled={bad}>{`Save ${v > 0 ? fmt(v) : 'payment'}`}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}
