import { useState } from 'react';
import { useApp, setData, closeSheet, openSheet, flash } from '../lib/store';
import { HUES, TEXT, ink, tint } from '../lib/constants';
import { fmt, num, roundAmt, uid } from '../lib/derive';
import { todayISO } from '../lib/dates';
import { groupValue } from '../lib/networth';
import type { AssetGroup, AssetItem } from '../lib/types';
import { FieldLabel, GhostDanger, PrimaryBtn, Segmented, Toggle, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SheetFrame } from './Sheet';

const EMOJI = ['🏠', '🏢', '🚗', '🏍️', '💎', '🖼️', '⌚', '🪙', '📦', '🐄', '🌳', '💼'];
const TEMPLATES: [string, string][] = [['Real estate', '🏠'], ['Vehicles', '🚗'], ['Valuables', '💎'], ['Business', '💼'], ['Other assets', '📦']];

/* ---------------- Create / edit a group ---------------- */
export function GroupSheet({ id }: { id: string | null }) {
  const { data: d } = useApp();
  const base = id ? (d.groups ?? []).find(g => g.id === id) : undefined;
  const [name, setName] = useState(base?.name ?? '');
  const [emoji, setEmoji] = useState(base?.emoji ?? '🏠');
  const [hue, setHue] = useState(base?.hue ?? HUES[(d.groups?.length ?? 0) % HUES.length]);
  const [inNW, setInNW] = useState(base?.inNetWorth ?? true);
  const [confirm, setConfirm] = useState(false);
  const cant = !name.trim();
  const save = () => {
    if (cant) return;
    if (base) setData(x => ({ groups: (x.groups ?? []).map(g => (g.id === base.id ? { ...g, name: name.trim(), emoji, hue, inNetWorth: inNW } : g)) }));
    else setData(x => ({ groups: [...(x.groups ?? []), { id: uid('g'), name: name.trim(), emoji, hue, inNetWorth: inNW, items: [] }] }));
    closeSheet(); flash(base ? `${name.trim()} updated` : `${name.trim()} created · now add what's in it`);
  };
  const remove = () => {
    if (!confirm) return setConfirm(true);
    setData(x => ({ groups: (x.groups ?? []).filter(g => g.id !== base!.id) }));
    closeSheet(); flash(`${base!.name} deleted`);
  };
  return (
    <SheetFrame title={base ? 'Edit group' : 'New group'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {!base && <>
          <span style={{ margin: '0 4px 8px', fontSize: 13, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Groups hold things you own, or owe, outside your bank accounts: an apartment, a car, a loan. You set their value by hand.</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TEMPLATES.map(([n, e]) => <button key={n} onClick={() => { setName(n); setEmoji(e); }} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: name === n ? TEXT : '#fff', color: name === n ? '#fff' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{e} {n}</button>)}
          </div>
        </>}
        <FieldLabel m="14px 4px 6px">Name</FieldLabel>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Real estate" aria-label="Group name" style={textInput} />
        <FieldLabel m="14px 4px 6px">Icon</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 4, background: '#fff', borderRadius: 20, padding: 8 }}>
          {EMOJI.map(e => <button key={e} onClick={() => setEmoji(e)} aria-label={e} style={{ aspectRatio: '1', borderRadius: 12, border: 0, background: emoji === e ? tint(hue) : 'transparent', fontSize: 22, cursor: 'pointer' }}>{e}</button>)}
        </div>
        <FieldLabel m="14px 4px 6px">Color</FieldLabel>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {HUES.map(h => <button key={h} onClick={() => setHue(h)} aria-label={`Color ${h}`} style={{ width: 36, height: 36, borderRadius: 999, border: hue === h ? `3px solid ${ink(h)}` : '3px solid transparent', background: tint(h), cursor: 'pointer' }} />)}
        </div>
        <div style={{ marginTop: 14, background: '#fff', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 15, fontWeight: 600 }}>Count in net worth</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{inNW ? 'Its total adds to your net worth' : 'Shown here, but left out of your net worth'}</span>
          </span>
          <Toggle on={inNW} onChange={setInNW} label="Count in net worth" />
        </div>
        <PrimaryBtn onClick={save} disabled={cant} mt={18}>{base ? 'Save changes' : 'Create group'}</PrimaryBtn>
        {base && <GhostDanger onClick={remove}>{confirm ? `Tap again to delete it and its ${base.items.length} item${base.items.length === 1 ? '' : 's'}` : 'Delete group'}</GhostDanger>}
      </div>
    </SheetFrame>
  );
}

/* ---------------- Add / edit an item in a group ---------------- */
export function GroupItemSheet({ group, id }: { group: string; id: string | null }) {
  const { data: d } = useApp();
  const g = (d.groups ?? []).find(x => x.id === group);
  const base = id ? g?.items.find(x => x.id === id) : undefined;
  const [name, setName] = useState(base?.name ?? '');
  const [value, setValue] = useState(base ? String(base.value) : '');
  const [debt, setDebt] = useState(!!base?.debt);
  const [note, setNote] = useState(base?.note ?? '');
  const [confirm, setConfirm] = useState(false);
  if (!g) return <SheetFrame title="Item"><span>This group was deleted.</span></SheetFrame>;
  const v = roundAmt(num(value)), cant = !name.trim() || !(v >= 0) || value === '';
  const after = groupValue({ ...g, items: [...g.items.filter(x => x.id !== id), { id: 'x', name, value: v || 0, debt, updated: '' }] as AssetItem[] } as AssetGroup);
  const save = () => {
    if (cant) return;
    const item: AssetItem = { id: base?.id ?? uid('ai'), name: name.trim(), value: v, debt: debt || undefined, note: note.trim() || undefined, updated: todayISO() };
    setData(x => ({ groups: (x.groups ?? []).map(gg => (gg.id === g.id ? { ...gg, items: base ? gg.items.map(it => (it.id === base.id ? item : it)) : [...gg.items, item] } : gg)) }));
    closeSheet(); flash(base ? `${item.name} updated` : `${item.name} added to ${g.name}`);
  };
  const remove = () => {
    if (!confirm) return setConfirm(true);
    setData(x => ({ groups: (x.groups ?? []).map(gg => (gg.id === g.id ? { ...gg, items: gg.items.filter(it => it.id !== base!.id) } : gg)) }));
    closeSheet(); flash(`${base!.name} removed`);
  };
  return (
    <SheetFrame title={base ? 'Edit item' : `Add to ${g.name}`}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Segmented items={[['asset', 'I own it'], ['debt', 'I owe it']]} value={debt ? 'debt' : 'asset'} onPick={k => setDebt(k === 'debt')} mt={4} />
        <FieldLabel m="14px 4px 6px">Name</FieldLabel>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={debt ? 'Mortgage with Bancolombia' : 'Apartment in Chapinero'} aria-label="Item name" style={textInput} />
        <FieldLabel m="14px 4px 6px">{debt ? 'How much you still owe' : 'What it is worth today'}</FieldLabel>
        <div style={{ ...textInput, display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-400)' }}>$</span>
          <MoneyInput value={value} onChange={setValue} ariaLabel="Value" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 18, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
        </div>
        <FieldLabel m="14px 4px 6px">Note (optional)</FieldLabel>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder={debt ? '120 months left' : 'Appraisal 2026'} aria-label="Note" style={textInput} />
        <span style={{ margin: '10px 4px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>
          {g.name} total: <b style={{ color: TEXT }}>{fmt(groupValue(g))} → {fmt(after)}</b>{g.inNetWorth ? ', counted in your net worth.' : ' (not counted in net worth).'} Update the value whenever it changes.
        </span>
        <PrimaryBtn onClick={save} disabled={cant} mt={16}>{base ? 'Save changes' : 'Add item'}</PrimaryBtn>
        {base && <GhostDanger onClick={remove}>{confirm ? 'Tap again to remove' : 'Remove item'}</GhostDanger>}
        {!base && g.items.length === 0 && <button onClick={() => openSheet({ name: 'group', id: g.id })} style={{ marginTop: 10, border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Edit the group instead</button>}
      </div>
    </SheetFrame>
  );
}
