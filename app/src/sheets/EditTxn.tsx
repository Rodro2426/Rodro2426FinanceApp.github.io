import { useState } from 'react';
import { useApp, setData, setUI, flash } from '../lib/store';
import { HUES, TEXT, ink, tint } from '../lib/constants';
import { chargeAccount, fmt, incomeMoves, num, roundAmt } from '../lib/derive';
import type { Account, Sheet } from '../lib/types';
import { BigAmount, FieldLabel, GhostDanger, PickChip, PrimaryBtn, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';

/** Money in (+) to an account; cards owe less. */
const credit = (accts: Account[], id: string, amt: number) => accts.map(a => (a.id !== id ? a : { ...a, bal: a.type === 'card' ? a.bal - amt : a.bal + amt }));
const chip = (on: boolean) => ({ background: on ? TEXT : '#fff', color: on ? '#fff' : TEXT });
const acctBtn = (on: boolean, hue: number) => ({ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${on ? ink(hue) : '#fff'}`, background: on ? tint(hue) : '#fff', cursor: 'pointer', textAlign: 'left', color: TEXT }) as const;

/** Edit or delete an expense or income after it was added; balances follow the changes. */
export function EditTxnSheet({ kind, id, back }: { kind: 'expense' | 'income'; id: string; back?: Sheet }) {
  const { data: d } = useApp();
  const done = () => setUI({ sheet: back ?? null });
  const e = kind === 'expense' ? d.expenses.find(x => x.id === id) : undefined;
  const inc = kind === 'income' ? d.incomes.find(x => x.id === id) : undefined;
  const t = e || inc;

  const [amt, setAmt] = useState(t ? String(roundAmt(t.amt)) : '');
  const [note, setNote] = useState(t?.note ?? '');
  const [date, setDate] = useState(t?.date ?? '');
  const [acct, setAcct] = useState(t?.a ?? '');
  const [pocket, setPocket] = useState(e?.p ?? '');
  const [[cat, sub], setCat] = useState<[string, string]>([e?.cat || 'Other', e?.sub || '']);
  const [tags, setTags] = useState<string[]>(e?.tags ?? []);
  const [confirmDel, setConfirmDel] = useState(false);

  if (!t) return <SheetFrame title="Transaction"><span style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>This transaction no longer exists.</span></SheetFrame>;
  if (inc?.interest) {
    return (
      <SheetFrame title="Interest">
        <span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>
          This is the interest {d.accounts.find(a => a.id === inc.a)?.name || 'the account'} earned this month ({fmt(inc.amt)}). It's calculated automatically from the account's % E.A., so it can't be edited. To change it, edit the account's annual return.
        </span>
      </SheetFrame>
    );
  }

  const accounts = kind === 'income' ? d.accounts.filter(a => a.type !== 'card' || a.id === t.a) : d.accounts;
  const linked = inc ? incomeMoves(d.moves, inc) : [];
  const splitTotal = linked.reduce((a, m) => a + m.amt, 0);
  const splitNames = linked.map(m => d.pockets.find(p => p.id === m.to)?.name).filter(Boolean).join(', ');
  const v = num(amt);
  const cant = !(v > 0) || !date || !d.accounts.some(a => a.id === acct);
  const curCat = d.cats.find(c => c.name === cat);
  const tagHue = (x: string) => HUES[Math.max(0, d.tags.indexOf(x)) % HUES.length];

  const save = () => {
    if (cant) return;
    const val = roundAmt(v);
    if (e) {
      setData(x => {
        // Undo the old charge, then apply the new one (handles account changes too).
        const accounts = chargeAccount(chargeAccount(x.accounts, e.a, -e.amt), acct, val);
        return { accounts, expenses: x.expenses.map(y => (y.id === e.id ? { ...y, amt: val, note: note.trim() || y.note, date, a: acct, p: pocket, cat, sub, tags, orig: val === roundAmt(y.amt) ? y.orig : undefined } : y)) };
      });
    } else if (inc) {
      setData(x => {
        // If the income is now smaller than what was split from it, shrink each pocket's share to fit.
        const linked = incomeMoves(x.moves, inc), split = linked.reduce((a, m) => a + m.amt, 0);
        const f = split > val ? val / split : 1;
        // Scale each share, then put the rounding difference on the last one so they add up to exactly `val`.
        const scaled = new Map(linked.map(m => [m.id, roundAmt(m.amt * f)]));
        if (f < 1 && linked.length) { const diff = roundAmt(val - [...scaled.values()].reduce((a, n) => a + n, 0)); const lastId = linked[linked.length - 1].id; scaled.set(lastId, roundAmt(scaled.get(lastId)! + diff)); }
        const ids = new Set(linked.map(m => m.id));
        return {
          accounts: credit(credit(x.accounts, inc.a, -inc.amt), acct, val),
          incomes: x.incomes.map(y => (y.id === inc.id ? { ...y, amt: val, note: note.trim() || y.note, date, a: acct, orig: val === roundAmt(y.amt) ? y.orig : undefined } : y)),
          moves: f < 1 ? x.moves.map(m => (ids.has(m.id) ? { ...m, amt: scaled.get(m.id)!, income: inc.id } : m)) : x.moves
        };
      });
    }
    flash('Transaction updated'); done();
  };
  const remove = () => {
    if (!confirmDel) return setConfirmDel(true);
    if (e) setData(x => ({ accounts: chargeAccount(x.accounts, e.a, -e.amt), expenses: x.expenses.filter(y => y.id !== e.id) }));
    else if (inc) setData(x => {
      // Money this income added to pockets goes away with it.
      const ids = new Set(incomeMoves(x.moves, inc).map(m => m.id));
      return { accounts: credit(x.accounts, inc.a, -inc.amt), incomes: x.incomes.filter(y => y.id !== inc.id), moves: x.moves.filter(m => !ids.has(m.id)) };
    });
    flash(splitTotal > 0 ? `${t.note} deleted · ${fmt(splitTotal)} taken back out of your pockets` : `${t.note} deleted`); done();
  };

  return (
    <SheetFrame title={kind === 'income' ? 'Edit income' : 'Edit expense'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <BigAmount value={amt} onChange={setAmt} mt={6} />
        {t.orig && <span style={{ margin: '6px 4px 0', fontSize: 12, color: 'var(--color-neutral-700)' }}>Converted from US${t.orig.amt.toLocaleString('es-CO', { minimumFractionDigits: 2 })} at {fmt(t.orig.rate)}. Changing the amount drops the dollar note.</span>}
        <FieldLabel m="14px 4px 6px">Description</FieldLabel>
        <input value={note} onChange={x => setNote(x.target.value)} style={textInput} />
        <FieldLabel m="14px 4px 6px">Date</FieldLabel>
        <input type="date" value={date} onChange={x => setDate(x.target.value)} style={{ ...textInput, fontWeight: 600, minHeight: 52, WebkitAppearance: 'none', appearance: 'none' }} />

        {e && <>
          <FieldLabel>Pocket</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.pockets.map(p => <PickChip key={p.id} st={{ name: p.name, initial: p.photo ? '' : p.emoji || p.name.charAt(0), photoBg: p.photo ? `url(${p.photo})` : 'none' }} on={p.id === pocket} hue={p.hue} onClick={() => setPocket(p.id)} />)}
            <button onClick={() => setPocket('')} style={{ height: 44, padding: '0 14px', borderRadius: 999, border: 0, ...chip(pocket === ''), fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>No pocket</button>
          </div>
        </>}

        <FieldLabel>{kind === 'income' ? 'Went into' : 'Paid with'}</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {accounts.map(a => (
            <button key={a.id} onClick={() => setAcct(a.id)} style={acctBtn(a.id === acct, a.hue)}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{a.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{a.type === 'card' ? `${fmt(a.bal)} owed` : fmt(a.bal)}</span>
            </button>
          ))}
        </div>

        {e && <>
          <FieldLabel>Category</FieldLabel>
          <div style={{ background: '#fff', borderRadius: 22, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {d.cats.map(k => <button key={k.name} onClick={() => setCat([k.name, k.subs[0] || ''])} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, border: 0, ...chip(k.name === cat), fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 0 0 1px var(--color-neutral-200)' }}>{k.name}</button>)}
            </div>
            {(curCat?.subs.length ?? 0) > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--color-neutral-200)' }}>
                {curCat!.subs.map(sname => {
                  const on = sname === sub;
                  return <button key={sname} onClick={() => setCat([cat, sname])} style={{ height: 30, padding: '0 11px', borderRadius: 999, border: `1.5px solid ${on ? 'var(--color-accent-300)' : 'var(--color-neutral-300)'}`, background: on ? 'var(--color-accent-100)' : 'transparent', color: on ? 'var(--color-accent-800)' : 'var(--color-neutral-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{sname}</button>;
                })}
              </div>
            )}
          </div>
          {d.tags.length > 0 && <>
            <FieldLabel>Tags</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {d.tags.map(x => {
                const on = tags.includes(x);
                return <button key={x} onClick={() => setTags(s => (s.includes(x) ? s.filter(y => y !== x) : [...s, x]))} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: on ? ink(tagHue(x)) : '#fff', color: on ? '#fff' : TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>#{x}</button>;
              })}
            </div>
          </>}
        </>}

        {(e?.ruleId || inc?.ruleId) && <span style={{ margin: '12px 4px 0', fontSize: 12, color: 'var(--color-neutral-600)' }}>This came from a scheduled item. Editing it only changes this one; deleting it won't charge it again.</span>}
        {splitTotal > 0 && (
          <div style={{ marginTop: 14, background: 'oklch(0.95 0.045 155)', borderRadius: 16, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, color: 'oklch(0.36 0.08 155)' }}>
            {fmt(splitTotal)} of this income was split into {splitNames || 'your pockets'}. Deleting it takes that money back out of those pockets{num(amt) > 0 && num(amt) < splitTotal ? `. With ${fmt(num(amt))}, each pocket's share is reduced to match` : ''}.
          </div>
        )}
        <PrimaryBtn onClick={save} disabled={cant} mt={18}>Save changes</PrimaryBtn>
        <GhostDanger onClick={remove}>{confirmDel ? (splitTotal > 0 ? `Tap again to delete (and remove ${fmt(splitTotal)} from pockets)` : 'Tap again to delete') : `Delete ${kind}`}</GhostDanger>
      </div>
    </SheetFrame>
  );
}
