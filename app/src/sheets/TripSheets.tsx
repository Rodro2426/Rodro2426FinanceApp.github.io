import { useState } from 'react';
import { useApp, setData, closeSheet, setUI, flash } from '../lib/store';
import { RED, TEXT } from '../lib/constants';
import { chargeAccount, fmt, num, roundAmt, uid as newId } from '../lib/derive';
import { todayISO } from '../lib/dates';
import { addPeople, createTrip, deleteItem, getSocial, myUid, saveItem, tripMembers } from '../lib/social';
import { groupWideItems, personTotals, relinkPerson, sharesOf, splitProblem, withMorePeople, type SplitMode, type TripItem } from '../lib/settle';
import { BigAmount, FieldLabel, GhostDanger, PrimaryBtn, Segmented, Toggle, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SheetFrame } from './Sheet';
import { useSocial } from '../screens/Social';

const EMOJI = ['✈️', '🏖️', '🏔️', '🍽️', '🎉', '🏠', '🚗', '⚽', '🎁', '🛒'];
const chip = (on: boolean) => ({ height: 36, padding: '0 13px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--surface)', color: on ? 'var(--surface)' : TEXT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const, boxShadow: on ? 'none' : 'inset 0 0 0 1px var(--color-neutral-200)' });

/* ---------------- New trip ---------------- */
export function TripNewSheet() {
  const so = useSocial();
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('✈️');
  const [sel, setSel] = useState<string[]>([]);
  const [guests, setGuests] = useState<string[]>([]);
  const [guest, setGuest] = useState('');
  const [busy, setBusy] = useState(false);
  const friends = so.friends.filter(f => f.status === 'accepted');
  const create = async () => {
    setBusy(true);
    const id = await createTrip(name, emoji, sel, guests);
    setBusy(false);
    if (id) { closeSheet(); setUI({ page: `trip:${id}` }); flash(`${name.trim()} created`); } else flash(getSocial().error ?? 'Couldn\'t create the trip');
  };
  return (
    <SheetFrame title="New shared trip">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <FieldLabel m="4px 4px 6px">Name</FieldLabel>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Cartagena 2027" aria-label="Trip name" style={textInput} />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>{EMOJI.map(e => <button key={e} onClick={() => setEmoji(e)} aria-label={e} style={{ width: 42, height: 42, borderRadius: 12, border: 0, background: emoji === e ? 'var(--color-neutral-200)' : 'transparent', fontSize: 22, cursor: 'pointer' }}>{e}</button>)}</div>
        <FieldLabel>Friends</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {friends.map(f => { const on = sel.includes(f.uid); return <button key={f.uid} onClick={() => setSel(s => (on ? s.filter(x => x !== f.uid) : [...s, f.uid]))} aria-pressed={on} style={chip(on)}>{on ? '✓ ' : ''}{f.name}</button>; })}
          {!friends.length && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)' }}>No friends yet. Add them in the Friends tab, or add guests below.</span>}
        </div>
        <FieldLabel>Guests without an account (optional)</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={guest} onChange={e => setGuest(e.target.value)} placeholder="Name" aria-label="Guest name" style={{ ...textInput, flex: 1 }} />
          <button onClick={() => { if (guest.trim()) { setGuests(g => [...g, guest.trim()]); setGuest(''); } }} style={{ height: 52, padding: '0 16px', borderRadius: 18, border: 0, background: TEXT, color: 'var(--surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </div>
        {guests.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{guests.map((g, i) => <button key={g + i} onClick={() => setGuests(x => x.filter((_, j) => j !== i))} style={chip(true)}>{g} ✕</button>)}</div>}
        <PrimaryBtn onClick={create} disabled={!name.trim() || busy} mt={18}>{busy ? 'Creating…' : 'Create trip'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Add people to a trip that already exists ---------------- */
export function TripPeopleSheet({ trip }: { trip: string }) {
  const so = useSocial();
  const t = so.trips.find(x => x.id === trip);
  const [sel, setSel] = useState<string[]>([]);
  const [guests, setGuests] = useState<string[]>([]);
  const [guest, setGuest] = useState('');
  const [links, setLinks] = useState<Record<string, string>>({});
  const [splitPast, setSplitPast] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!t) return <SheetFrame title="Add people"><span style={{ fontSize: 14 }}>This trip isn't available anymore.</span></SheetFrame>;
  const me = myUid();
  const friends = so.friends.filter(f => f.status === 'accepted' && !t.members.includes(f.uid));
  const linkable = friends.filter(f => !sel.includes(f.uid));
  const items = so.items[t.id] ?? [];
  const people = tripMembers(t).map(m => m.id);
  // Preview of what "split past expenses" would do, with the same rules the save uses.
  const linked = Object.entries(links).filter(([, f]) => f);
  const relinked = linked.reduce((its, [g, f]) => its.map(i => relinkPerson(i, g, f)), items);
  const peopleNow = people.map(id => links[id] || id);
  const joining = [...sel, ...guests.map((_, i) => `new:${i}`)];
  const wide = groupWideItems(relinked, peopleNow);
  const after = splitPast && joining.length ? relinked.map(i => (wide.includes(i) ? withMorePeople(i, joining) : i)) : relinked;
  const shareNow = personTotals(me, items).share, shareAfter = personTotals(me, after).share;
  const count = sel.length + guests.length + linked.length;
  const exps = items.filter(i => i.kind === 'expense').length;
  const save = async () => {
    setBusy(true);
    const e = await addPeople(t, { friends: sel, guests, links, splitPast });
    setBusy(false);
    if (e) { flash(e); return; }
    closeSheet(); flash(count === 1 ? 'Added to the trip' : `${count} people added`);
  };
  return (
    <SheetFrame title={`Add people to ${t.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <FieldLabel m="4px 4px 6px">Friends</FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {friends.filter(f => !Object.values(links).includes(f.uid)).map(f => { const on = sel.includes(f.uid); return <button key={f.uid} onClick={() => setSel(s => (on ? s.filter(x => x !== f.uid) : [...s, f.uid]))} aria-pressed={on} style={chip(on)}>{on ? '✓ ' : ''}{f.name}</button>; })}
          {!friends.length && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', lineHeight: 1.4 }}>{so.friends.some(f => f.status === 'accepted') ? 'All your friends are already in this trip.' : 'No friends yet.'} To add someone new, add them as a friend by email first (Trips and friends → Friends), then come back here.</span>}
        </div>

        <FieldLabel>Guests without an account</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <input value={guest} onChange={e => setGuest(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && guest.trim()) { setGuests(g => [...g, guest.trim()]); setGuest(''); } }} placeholder="Name" aria-label="Guest name" style={{ ...textInput, flex: 1 }} />
          <button onClick={() => { if (guest.trim()) { setGuests(g => [...g, guest.trim()]); setGuest(''); } }} style={{ height: 52, padding: '0 16px', borderRadius: 18, border: 0, background: TEXT, color: 'var(--surface)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Add</button>
        </div>
        {guests.length > 0 && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>{guests.map((g, i) => <button key={g + i} onClick={() => setGuests(x => x.filter((_, j) => j !== i))} style={chip(true)}>{g} ✕</button>)}</div>}

        {t.guests.length > 0 && (linkable.length > 0 || linked.length > 0) && <>
          <FieldLabel>A guest joined Pockets?</FieldLabel>
          <span style={{ margin: '-2px 4px 8px', fontSize: 12.5, color: 'var(--color-neutral-700)', lineHeight: 1.4 }}>Link the guest to their account: everything they paid and owe moves to them, and they see the trip in their app.</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {t.guests.map(g => (
              <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--surface)', borderRadius: 16, padding: '8px 8px 8px 14px' }}>
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600 }}>{g.name}</span>
                <select value={links[g.id] ?? ''} onChange={e => setLinks(l => ({ ...l, [g.id]: e.target.value }))} aria-label={`Link ${g.name} to a friend`}
                  style={{ height: 38, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 14, fontWeight: 600, padding: '0 10px', maxWidth: 180 }}>
                  <option value="">Keep as guest</option>
                  {friends.filter(f => !sel.includes(f.uid) && (links[g.id] === f.uid || !Object.values(links).includes(f.uid))).map(f => <option key={f.uid} value={f.uid}>Is {f.name}</option>)}
                </select>
              </label>
            ))}
          </div>
        </>}

        {joining.length > 0 && exps > 0 && (
          <div style={{ marginTop: 16, background: 'var(--surface)', borderRadius: 20, padding: '14px 14px 14px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>Split past expenses with them too</span>
                <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', lineHeight: 1.35 }}>{wide.length ? `${wide.length} of ${exps} expenses were split equally with the whole group; they'd include the new ${joining.length === 1 ? 'person' : 'people'} too.` : 'None of the past expenses were split equally with the whole group, so nothing would change.'}</span>
              </span>
              <Toggle on={splitPast} onChange={setSplitPast} label="Split past expenses with them too" />
            </div>
            {splitPast && wide.length > 0 && <span style={{ fontSize: 13, fontWeight: 600 }}>Your share: {fmt(shareNow)} → {fmt(shareAfter)}</span>}
            <span style={{ fontSize: 12, color: 'var(--color-neutral-600)', lineHeight: 1.35 }}>Expenses split by amount, by percent, or among only some people stay as they are. New expenses include everyone by default.</span>
          </div>
        )}

        <PrimaryBtn onClick={save} disabled={!count || busy} mt={18}>{busy ? 'Saving…' : count ? `Add ${count === 1 ? '1 person' : `${count} people`}` : 'Choose who to add'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Add / edit an expense or payment ---------------- */
export function TripItemSheet({ trip, id, payment }: { trip: string; id: string | null; payment?: { from: string; to: string; amount: number } }) {
  const so = useSocial();
  const { data: d } = useApp();
  const t = so.trips.find(x => x.id === trip);
  const base = id ? (so.items[trip] ?? []).find(x => x.id === id) : undefined;
  const me = myUid();
  const members = t ? tripMembers(t) : [];
  const [kind, setKind] = useState<'expense' | 'payment'>(base?.kind ?? (payment ? 'payment' : 'expense'));
  const [amt, setAmt] = useState(base ? String(base.amount) : payment ? String(payment.amount) : '');
  const [desc, setDesc] = useState(base?.desc ?? '');
  const [paidBy, setPaidBy] = useState(base?.paidBy ?? payment?.from ?? me);
  const [to, setTo] = useState(base?.to ?? payment?.to ?? members.find(m => m.id !== me)?.id ?? '');
  const [mode, setMode] = useState<SplitMode>(base?.split?.mode ?? 'equal');
  const [among, setAmong] = useState<string[]>(base?.split?.among ?? members.map(m => m.id));
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(Object.entries(base?.split?.values ?? {}).map(([k, v]) => [k, String(v)])));
  const [date, setDate] = useState(base?.date ?? todayISO());
  const [log, setLog] = useState(false);
  const [cat, setCat] = useState('');
  const [pocket, setPocket] = useState('');
  const [acct, setAcct] = useState(d.accounts[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  if (!t) return <SheetFrame title="Trip"><span>This trip isn't available.</span></SheetFrame>;
  const nameOf = (x: string) => (x === me ? 'You' : members.find(m => m.id === x)?.name ?? '?');
  const v = roundAmt(num(amt));
  const values = Object.fromEntries(Object.entries(vals).map(([k, x]) => [k, num(x)]));
  const problem = kind === 'expense' ? splitProblem(v, mode, among, values) : paidBy === to ? 'Pick two different people.' : null;
  const draft: TripItem = { id: base?.id ?? 'draft', kind, desc: desc.trim() || (kind === 'payment' ? 'Payment' : 'Expense'), amount: v, date, createdBy: base?.createdBy ?? me, createdAt: base?.createdAt ?? Date.now(), paidBy, ...(kind === 'payment' ? { to } : { split: { mode, among, values: mode === 'equal' ? undefined : values } }) };
  const myShare = kind === 'expense' && !problem ? sharesOf(draft)[me] ?? 0 : 0;
  const key = `${trip}:${base?.id ?? ''}`, alreadyLogged = !!base && (d.tripLogged ?? []).includes(key);
  const cant = !(v > 0) || !!problem || busy || (log && !cat);

  const save = async () => {
    if (cant) return;
    setBusy(true);
    const { id: _drop, ...body } = draft;
    const e = await saveItem(trip, base ? { ...body, id: base.id } : body);
    setBusy(false);
    if (e) { flash(e); return; }
    if (log && myShare > 0) {
      // Your share counts as your own spending, in the category (and pocket) you choose.
      const items = getSocial().items[trip] ?? [];
      const saved = base ?? items.find(x => x.createdAt === draft.createdAt && x.amount === v);
      setData(x => ({
        expenses: [{ id: newId('e'), ts: Date.now(), p: pocket, a: acct, amt: myShare, note: `${t.name}: ${draft.desc}`, date, tags: [], cat, sub: '' }, ...x.expenses],
        accounts: chargeAccount(x.accounts, acct, myShare),
        tripLogged: saved ? [...(x.tripLogged ?? []), `${trip}:${saved.id}`] : x.tripLogged
      }));
    }
    closeSheet(); flash(kind === 'payment' ? 'Payment recorded' : base ? 'Expense updated' : `Added · your share ${fmt(myShare)}${log ? ' · in your budget' : ''}`);
  };
  const remove = async () => { if (!confirmDel) { setConfirmDel(true); return; } const e = await deleteItem(trip, base!.id); closeSheet(); flash(e ?? 'Deleted'); };

  return (
    <SheetFrame title={base ? (kind === 'payment' ? 'Payment' : 'Edit expense') : kind === 'payment' ? 'Record a payment' : 'Add an expense'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {!base && !payment && <Segmented items={[['expense', 'Expense'], ['payment', 'Payment']]} value={kind} onPick={setKind} mt={2} />}
        <BigAmount value={amt} onChange={setAmt} mt={12} />
        {kind === 'expense' && <>
          <FieldLabel m="14px 4px 6px">What was it?</FieldLabel>
          <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Dinner, hotel, taxi…" aria-label="Description" style={textInput} />
        </>}
        <FieldLabel>{kind === 'payment' ? 'Who paid' : 'Paid by'}</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>{members.map(m => <button key={m.id} onClick={() => setPaidBy(m.id)} aria-pressed={paidBy === m.id} style={{ ...chip(paidBy === m.id), flex: 'none' }}>{nameOf(m.id)}</button>)}</div>
        {kind === 'payment' ? <>
          <FieldLabel>To</FieldLabel>
          <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>{members.filter(m => m.id !== paidBy).map(m => <button key={m.id} onClick={() => setTo(m.id)} aria-pressed={to === m.id} style={{ ...chip(to === m.id), flex: 'none' }}>{nameOf(m.id)}</button>)}</div>
        </> : <>
          <FieldLabel>Split</FieldLabel>
          <Segmented items={[['equal', 'Equally'], ['amounts', 'By amount'], ['percent', 'By %']]} value={mode} onPick={setMode} mt={0} h={36} />
          <div style={{ marginTop: 8, background: 'var(--surface)', borderRadius: 20, padding: '4px 12px' }}>
            {members.map((m, i) => {
              const on = among.includes(m.id), share = on && !problem ? sharesOf(draft)[m.id] ?? 0 : 0;
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--color-neutral-200)' : 0 }}>
                  <button onClick={() => setAmong(s => (on ? s.filter(x => x !== m.id) : [...s, m.id]))} aria-pressed={on} aria-label={`Include ${nameOf(m.id)}`} style={{ width: 26, height: 26, borderRadius: 8, border: on ? 0 : '2px solid var(--color-neutral-300)', background: on ? TEXT : 'transparent', color: 'var(--surface)', fontSize: 14, fontWeight: 800, cursor: 'pointer', flex: 'none' }}>{on ? '✓' : ''}</button>
                  <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, opacity: on ? 1 : 0.5 }}>{nameOf(m.id)}</span>
                  {on && mode !== 'equal' && <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, background: 'var(--color-neutral-100)', borderRadius: 12, padding: '6px 10px', width: 110 }}>
                    {mode === 'amounts' && <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>$</span>}
                    {mode === 'amounts'
                      ? <MoneyInput value={vals[m.id] ?? ''} onChange={x => setVals(s => ({ ...s, [m.id]: x }))} ariaLabel={`${nameOf(m.id)} amount`} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 15, fontWeight: 700, color: TEXT, padding: 0, outline: 'none', textAlign: 'right' }} />
                      : <input inputMode="decimal" value={vals[m.id] ?? ''} onChange={e => setVals(s => ({ ...s, [m.id]: e.target.value.replace(',', '.').replace(/[^\d.]/g, '') }))} aria-label={`${nameOf(m.id)} percent`} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 15, fontWeight: 700, color: TEXT, padding: 0, outline: 'none', textAlign: 'right' }} />}
                    {mode === 'percent' && <span style={{ fontSize: 13, color: 'var(--color-neutral-600)' }}>%</span>}
                  </div>}
                  {on && <span style={{ width: 84, textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: 'var(--color-neutral-700)' }}>{problem ? '—' : fmt(share)}</span>}
                </div>
              );
            })}
          </div>
        </>}
        <FieldLabel m="14px 4px 6px">Date</FieldLabel>
        <input type="date" value={date} onChange={e => setDate(e.target.value || todayISO())} style={{ ...textInput, fontWeight: 600, minHeight: 52, WebkitAppearance: 'none', appearance: 'none' }} />
        {problem && v > 0 && <span role="alert" style={{ margin: '10px 4px 0', fontSize: 13, color: RED }}>{problem}</span>}

        {kind === 'expense' && myShare > 0 && !alreadyLogged && (
          <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14.5, fontWeight: 700 }}>Add my share ({fmt(myShare)}) to my budget</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Counts it as your own spending. Only your share, not the whole bill.</span>
              </span>
              <Toggle on={log} onChange={setLog} label="Add my share to my budget" />
            </div>
            {log && <>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: cat ? 'var(--color-neutral-700)' : RED }}>Category{cat ? '' : ' · required'}</span>
              <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>{d.cats.map(k => <button key={k.name} onClick={() => setCat(k.name)} style={{ ...chip(cat === k.name), flex: 'none', height: 32, fontSize: 12.5 }}>{k.name}</button>)}</div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Pocket</span>
              <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>{[{ id: '', name: 'No pocket' }, ...d.pockets].map(p => <button key={p.id} onClick={() => setPocket(p.id)} style={{ ...chip(pocket === p.id), flex: 'none', height: 32, fontSize: 12.5 }}>{p.name}</button>)}</div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Paid with</span>
              <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>{d.accounts.map(a => <button key={a.id} onClick={() => setAcct(a.id)} style={{ ...chip(acct === a.id), flex: 'none', height: 32, fontSize: 12.5 }}>{a.name}</button>)}</div>
            </>}
          </div>
        )}
        {alreadyLogged && <span style={{ margin: '12px 4px 0', fontSize: 12.5, color: 'var(--color-neutral-700)' }}>Your share of this is already in your budget.</span>}
        <PrimaryBtn onClick={save} disabled={cant} mt={16}>{busy ? 'Saving…' : base ? 'Save changes' : kind === 'payment' ? `Record ${v > 0 ? fmt(v) : 'payment'}` : 'Add expense'}</PrimaryBtn>
        {base && <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete it for everyone' : 'Delete'}</GhostDanger>}
        <span style={{ margin: '8px 4px 0', fontSize: 12, color: 'var(--color-neutral-600)', textAlign: 'center' }}>Everyone in the trip sees this. {kind === 'payment' ? 'It doesn\'t move money in your accounts.' : ''}</span>
      </div>
    </SheetFrame>
  );
}
