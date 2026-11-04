import { useEffect, useRef, useState } from 'react';
import { useApp, setData, setUI, openSheet, closeSheet, flash } from '../lib/store';
import { EMOJIS, HUES, LINE, POCKET_CAT, RED, TEXT, ink, tint } from '../lib/constants';
import { DAY_LETTERS, DAY_NAMES, editMove, incomeMoves, moveMax, moveMonth, moveTime, undoMove, allStats, byDateDesc, chargeAccount, ctxOf, curSymbol, dayLabel, dayStats, fmt, monthExpenses, monthStats, num, pctOf, pocketStats, roundAmt, sortedExpenses, uid, weekExpenses, weeksLeft, type DayStats } from '../lib/derive';
import { monthName, relDay, shortDate } from '../lib/dates';
import { pickPhoto } from '../lib/photo';
import { addExtraIncome, coverFirst, monthSummary, splitAmong, type ExtraIncome, type SplitDist, type SplitMode } from '../lib/plan';
import { unitsFor, weekShares } from '../lib/split';
import type { Data, Move, PocketView } from '../lib/types';
import { BigAmount, Bar, ExpRow, FieldLabel, GhostDanger, PickChip, PocketDot, PrimaryBtn, Segmented, SmallAmount, expView, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { SheetFrame } from './Sheet';
import * as I from '../ui/icons';

const pill = (k: string) => ({ fontSize: 12, fontWeight: 600, color: k, background: 'rgba(255,255,255,.7)', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap' }) as const;

function defaultCat(d: Data, pocketId: string): [string, string] {
  if (POCKET_CAT[pocketId]) return POCKET_CAT[pocketId];
  const last = sortedExpenses(d).find(e => e.p === pocketId && e.cat);
  return last ? [last.cat, last.sub] : ['Other', 'Other'];
}

/* ---------------- Search ---------------- */
export function SearchSheet({ tag }: { tag?: string | null }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [q, setQ] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(tag ?? null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Focus after the sheet has slid in, without letting Safari scroll the page.
  useEffect(() => { const t = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 300); return () => clearTimeout(t); }, []);
  const stats = new Map(allStats(d, c).map(x => [x.id, x]));
  const qs = q.trim().toLowerCase().replace(/^#/, '');
  const matches = sortedExpenses(d).filter(e => {
    const tg = e.tags || [];
    if (filterTag && !tg.includes(filterTag)) return false;
    if (!qs) return true;
    const pn = (stats.get(e.p)?.name || '').toLowerCase(), an = (d.accounts.find(a => a.id === e.a)?.name || '').toLowerCase();
    return e.note.toLowerCase().includes(qs) || pn.includes(qs) || an.includes(qs) || tg.some(t => t.includes(qs)) || (e.cat || '').toLowerCase().includes(qs);
  });
  const shown = matches.slice(0, 200).map(e => expView(d, e, c, stats));
  const tagHue = (t: string) => HUES[Math.max(0, d.tags.indexOf(t)) % HUES.length];
  const tagCount = (t: string) => d.expenses.filter(e => (e.tags || []).includes(t)).length;
  const chips = [{ key: '', label: 'All', on: !filterTag, hue: null as number | null, pick: () => setFilterTag(null) },
    ...d.tags.filter(tagCount).map(t => ({ key: t, label: `#${t} · ${tagCount(t)}`, on: filterTag === t, hue: tagHue(t), pick: () => setFilterTag(f => (f === t ? null : t)) }))];

  return (
    <SheetFrame title="Transactions" topOnFocus>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, background: '#fff', borderRadius: 999, padding: '0 16px', height: 50 }}>
          <I.Search size={18} color="var(--color-neutral-500)" />
          <input placeholder="Search by name, pocket or #tag" value={q} onChange={e => setQ(e.target.value)} ref={searchRef} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, color: TEXT, padding: 0, outline: 'none' }} />
          {q && <button onClick={() => setQ('')} aria-label="Clear" style={{ width: 24, height: 24, borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.X size={12} sw={3} /></button>}
        </div>
        <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '12px -20px 0', padding: '0 20px' }}>
          {chips.map(g => (
            <button key={g.key} onClick={g.pick} style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: g.on ? (g.hue != null ? ink(g.hue) : TEXT) : '#fff', color: g.on ? '#fff' : TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>{g.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 4px 8px', fontSize: 13 }}>
          <span style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{matches.length === 1 ? '1 transaction' : `${matches.length} transactions`}</span>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>−{fmt(matches.reduce((a, e) => a + e.amt, 0))}</span>
        </div>
        <div style={{ background: '#fff', borderRadius: 22, padding: '4px 16px' }}>
          {shown.map((v, i) => <ExpRow key={v.key} v={v} size={38} last={i === shown.length - 1} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: v.key, back: { name: 'search', tag: filterTag } })} />)}
          {matches.length === 0 && <div style={{ padding: '18px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>No transactions match.</div>}
          {matches.length > shown.length && <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>Showing the latest {shown.length}. Refine your search to see more.</div>}
        </div>
      </div>
    </SheetFrame>
  );
}

/** The + button: add an expense or register income. */
export function AddSheet({ pocket, mode: mode0 }: { pocket?: string; mode?: 'expense' | 'income' }) {
  const [mode, setMode] = useState<'expense' | 'income'>(mode0 ?? 'expense');
  return (
    <SheetFrame title={mode === 'income' ? 'New income' : 'New expense'}>
      <Segmented items={[['expense', 'Expense'], ['income', 'Income']]} value={mode} onPick={setMode} mt={4} />
      {mode === 'income' ? <IncomeForm /> : <ExpenseForm pocket={pocket} />}
    </SheetFrame>
  );
}

/* ---------------- Register income: save it, or split some of it into pockets ---------------- */
function IncomeForm() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const accounts = d.accounts.filter(a => a.type !== 'card');
  const [amt, setAmt] = useState('');
  const [a, setA] = useState((accounts.find(x => x.type === 'bank') || accounts[0])?.id ?? '');
  const [note, setNote] = useState('');
  const [toP, setToP] = useState('0');
  const [mode, setMode] = useState<SplitMode>('month');
  const [dist, setDist] = useState<SplitDist>('budget');
  const [manual, setManual] = useState<Record<string, string>>({});
  const nWeeks = weeksLeft(c), scale = unitsFor(d.settings.currency);
  const X = roundAmt(num(amt));
  const manualNums = Object.fromEntries(d.pockets.map(p => [p.id, roundAmt(num(manual[p.id]))]));
  const A = dist === 'manual' ? Object.values(manualNums).reduce((s, n) => s + n, 0) : Math.min(X, roundAmt(num(toP)));
  const tooMuch = A > X + 0.004;
  const cant = !(X > 0) || !accounts.some(x => x.id === a) || tooMuch;

  const before = monthSummary(d, c);
  const input: ExtraIncome = { amt: X, acct: a, note, toPockets: A, mode, dist, manual: manualNums };
  const preview = X > 0 && !tooMuch && accounts.some(x => x.id === a) ? { ...d, ...addExtraIncome(d, c, { ...input, id: 'preview' }) } : null;
  const after = preview ? monthSummary(preview, c) : null;
  const parts = A > 0 && !tooMuch ? splitAmong(d, A, dist, manualNums) : {};
  const acctName = accounts.find(x => x.id === a)?.name;
  const cover = coverFirst(d, c, X);

  const quick = (v: number) => { setDist(dd => (dd === 'manual' ? 'budget' : dd)); setToP(String(v)); };
  const save = () => {
    if (cant) return;
    setData(x => addExtraIncome(x, ctxOf(x), input));
    closeSheet();
    const warn = after && after.real > 0.004 ? ` · Your pockets add up to ${fmt(after.real)} more than you have in your accounts` : '';
    flash(`+${fmt(X)} to ${acctName}${A > 0 ? ` · ${fmt(A)} to pockets` : ' · all saved'}${warn}`);
  };
  const chipBtn = (label: string, on: boolean, f: () => void, key?: string) => (
    <button key={key ?? label} onClick={f} className="hv-n200" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--color-neutral-100)', color: on ? '#fff' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
  );
  const row = (label: string, b: number, x: number | undefined, sign = false) => (
    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, padding: '3px 0' }}>
      <span style={{ color: 'var(--color-neutral-700)' }}>{label}</span>
      <span style={{ whiteSpace: 'nowrap' }}>{fmt(b, sign)} → <b style={{ color: x !== undefined && x !== b ? TEXT : 'var(--color-neutral-600)' }}>{x === undefined ? '—' : fmt(x, sign)}</b></span>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <BigAmount value={amt} onChange={setAmt} autoFocus mt={12} />
      <FieldLabel>Goes into</FieldLabel>
      <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
        {accounts.map(x => (
          <button key={x.id} onClick={() => setA(x.id)} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${x.id === a ? ink(x.hue) : '#fff'}`, background: x.id === a ? tint(x.hue) : '#fff', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.name}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{fmt(x.bal)}</span>
          </button>
        ))}
        {accounts.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Add a bank or cash account first, in the Accounts tab.</span>}
      </div>
      <input placeholder="What is it? Freelance, gift, refund…" value={note} onChange={e => setNote(e.target.value)} style={{ ...textInput, marginTop: 16 }} />

      <FieldLabel m="16px 4px 6px">How much goes to pockets?</FieldLabel>
      <div style={{ background: '#fff', borderRadius: 22, padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, background: 'var(--color-neutral-100)', borderRadius: 16, padding: '10px 14px', opacity: dist === 'manual' ? 0.6 : 1 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-neutral-500)' }}>{curSymbol()}</span>
          {dist === 'manual'
            ? <span aria-label="To pockets" style={{ flex: 1, fontSize: 20, fontWeight: 700 }}>{fmt(A).replace(curSymbol(), '')}</span>
            : <MoneyInput value={toP} onChange={setToP} ariaLabel="To pockets" style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 20, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />}
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>of {fmt(X)}</span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {chipBtn('None', dist !== 'manual' && A === 0, () => quick(0))}
          {chipBtn('All', dist !== 'manual' && X > 0 && A === X, () => quick(X))}
          {before.real > 0.004 && chipBtn(`Cover the shortfall first (${fmt(Math.min(X, before.real))})`, dist !== 'manual' && X > 0 && A === cover, () => quick(cover), 'cover')}
        </div>
        <span style={{ fontSize: 12, lineHeight: 1.4, color: tooMuch ? RED : 'var(--color-neutral-700)' }}>
          {tooMuch ? `That's more than the ${fmt(X)} you received.` : `${fmt(Math.max(0, X - A))} stays saved: it adds to this month's income without adding to the plan.`}
          {before.real > 0.004 && !tooMuch ? ` Your pockets already promise ${fmt(before.real)} more than your accounts have; "Cover the shortfall first" saves that much before splitting.` : ''}
        </span>
      </div>

      {(A > 0 || dist === 'manual') && (
        <div style={{ marginTop: 10, background: '#fff', borderRadius: 22, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Segmented items={[['week', 'This week'], ['month', `Rest of ${monthName(c.month)}`]]} value={mode} onPick={setMode} mt={0} h={36} />
          <span style={{ margin: '0 2px', fontSize: 12, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>
            {mode === 'week' ? 'All of it goes to this week. On Monday the pockets start over.' : nWeeks > 1 ? `Shared equally over the ${nWeeks} weeks left in ${monthName(c.month)}, this one included.` : `This is the last week of ${monthName(c.month)}, so it all goes to this week.`}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {chipBtn('By budget', dist === 'budget', () => setDist('budget'))}
            {chipBtn('Evenly', dist === 'even', () => setDist('even'))}
            {chipBtn('Manual', dist === 'manual', () => { setManual(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, String(v)]))); setDist('manual'); })}
          </div>
          {d.pockets.map(p => {
            const ms0 = monthStats(d, p.id, c), part = parts[p.id] ?? 0;
            const perWeek = mode === 'month' ? weekShares(part, nWeeks, scale)[0] : part;
            const st = allStats(d, c).find(x => x.id === p.id)!;
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: `1px solid ${LINE}` }}>
                <PocketDot st={st} size={32} fs={15} bg={tint(p.hue)} color={ink(p.hue)} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Left in month: {fmt(ms0.left)} → <b style={{ color: TEXT }}>{fmt(ms0.left + part)}</b></span>
                  {part > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.45 0.11 150)' }}>{mode === 'month' ? `+${fmt(perWeek)}/week` : `+${fmt(part)} this week`}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, background: tint(p.hue), borderRadius: 14, padding: '8px 10px', width: 116, flex: 'none' }}>
                  <span style={{ fontSize: 14, color: ink(p.hue) }}>{curSymbol()}</span>
                  {dist === 'manual'
                    ? <MoneyInput value={manual[p.id] || ''} onChange={x => setManual(s0 => ({ ...s0, [p.id]: x }))} ariaLabel={`${p.name} share`} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, color: ink(p.hue), padding: 0, outline: 'none', textAlign: 'right' }} />
                    : <span style={{ width: '100%', fontSize: 16, fontWeight: 700, color: ink(p.hue), textAlign: 'right' }}>{fmt(part).replace(curSymbol(), '')}</span>}
                </div>
              </div>
            );
          })}
          {d.pockets.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Create pockets in the Budget tab first.</span>}
        </div>
      )}

      <div aria-label="Preview" style={{ marginTop: 10, background: '#fff', borderRadius: 22, padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Before → after</span>
        {row('Month income', before.income, after?.income)}
        {row('Month plan', before.plan, after?.plan)}
        {row(after && after.planGap < 0 || (!after && before.planGap < 0) ? 'Plan vs income (short)' : 'Plan vs income (free)', before.planGap, after?.planGap, true)}
        {row('Real shortfall', Math.max(0, before.real), after ? Math.max(0, after.real) : undefined)}
        {after && after.real > 0.004 && (
          <div role="alert" style={{ marginTop: 8, background: 'var(--color-accent-100)', borderRadius: 14, padding: '9px 11px', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-accent-900)' }}>
            Your pockets add up to <b>{fmt(after.real)}</b> more than you have in your accounts.
          </div>
        )}
      </div>
      <PrimaryBtn onClick={save} disabled={cant} bg="oklch(0.5 0.12 150)" hover="hv-green">Save income</PrimaryBtn>
    </div>
  );
}

/* ---------------- Add expense ---------------- */
function ExpenseForm({ pocket }: { pocket?: string }) {
  const { data: d, ui } = useApp();
  const c = ctxOf(d);
  const first = [pocket, ui.lastAdd.pocket].find(id => id && d.pockets.some(p => p.id === id)) || d.pockets[0]?.id || '';
  const [amt, setAmt] = useState('');
  const [p, setP] = useState(first);
  const [a, setA] = useState(d.accounts.some(x => x.id === ui.lastAdd.acct) ? ui.lastAdd.acct : d.accounts[0]?.id || '');
  const [note, setNote] = useState('');
  const [tagSel, setTagSel] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [[cat, sub], setCat] = useState<[string, string]>(() => (first ? defaultCat(d, first) : ['Other', 'Other']));
  const [catTouched, setCatTouched] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [newSub, setNewSub] = useState('');

  const all = allStats(d, c), addS = all.find(x => x.id === p), payA = d.accounts.find(x => x.id === a);
  const v = num(amt), after = addS ? addS.left - v : 0;
  let preview = 'Enter an amount and pick a pocket.', previewColor = 'var(--color-neutral-700)';
  if (addS && v > 0) {
    preview = after >= 0 ? `${fmt(after)} will be left in ${addS.name} this week.` : `This puts ${addS.name} ${fmt(-after)} over for the week.`;
    if (after < 0) previewColor = RED;
  }
  if (!d.accounts.length) preview = 'Add an account or card first, in the Accounts tab.';
  const cant = !(v > 0 && addS && payA);
  const tagHue = (t: string) => HUES[Math.max(0, d.tags.indexOf(t)) % HUES.length];
  const curCat = d.cats.find(x => x.name === cat);

  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/^#+/, '');
    if (!t) return;
    if (!d.tags.includes(t)) setData(x => ({ tags: [...x.tags, t] }));
    setTagSel(s => (s.includes(t) ? s : [...s, t])); setNewTag('');
  };
  const addCat = () => {
    const n = newCat.trim(); if (!n) return;
    const ex = d.cats.find(x => x.name.toLowerCase() === n.toLowerCase());
    if (!ex) setData(x => ({ cats: [...x.cats, { name: n, subs: ['General'] }] }));
    setCat(ex ? [ex.name, ex.subs[0] || ''] : [n, 'General']); setNewCat(''); setCatTouched(true);
  };
  const addSub = () => {
    const n = newSub.trim(); if (!n) return;
    setData(x => ({ cats: x.cats.map(k => (k.name === cat && !k.subs.includes(n) ? { ...k, subs: [...k.subs, n] } : k)) }));
    setCat([cat, n]); setNewSub(''); setCatTouched(true);
  };
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } };

  const save = () => {
    if (cant) return;
    const val = roundAmt(v);
    setData(x => ({
      expenses: [{ id: uid('e'), ts: Date.now(), p, a, amt: val, note: note.trim() || addS!.name, date: c.today, tags: tagSel, cat, sub }, ...x.expenses],
      accounts: chargeAccount(x.accounts, a, val)
    }));
    setUI({ sheet: { name: 'saved', id: p }, lastAdd: { pocket: p, acct: a } });
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <BigAmount value={amt} onChange={setAmt} autoFocus mt={10} />
        <FieldLabel m="18px 4px 8px">Pocket</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {all.map(x => <PickChip key={x.id} st={x} on={x.id === p} hue={x.hue} onClick={() => { setP(x.id); if (!catTouched) setCat(defaultCat(d, x.id)); }} />)}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '16px 4px 8px', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>Category</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat + (sub ? ' › ' + sub : '')}</span>
        </div>
        <div style={{ background: '#fff', borderRadius: 22, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
            {d.cats.map(k => {
              const on = k.name === cat;
              return <button key={k.name} onClick={() => { setCat([k.name, k.subs[0] || '']); setCatTouched(true); }} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, border: 0, background: on ? TEXT : '#fff', color: on ? '#fff' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 0 0 1px var(--color-neutral-200)', transition: 'all .15s' }}>{k.name}</button>;
            })}
            <div style={{ flex: 'none', display: 'flex', alignItems: 'center', height: 34, borderRadius: 999, border: '2px dashed var(--color-neutral-300)', padding: '0 4px 0 12px' }}>
              <input placeholder="New category" value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={blurOnEnter} onBlur={addCat} style={{ width: 118, border: 0, background: 'transparent', fontSize: 16, fontWeight: 600, color: TEXT, padding: 0, outline: 'none' }} />
              <button onClick={addCat} aria-label="Add category" style={{ width: 24, height: 24, borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.Plus size={12} sw={3} /></button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid var(--color-neutral-200)' }}>
            {(curCat?.subs || []).map(sname => {
              const on = sname === sub;
              return <button key={sname} onClick={() => { setCat([cat, sname]); setCatTouched(true); }} style={{ height: 30, padding: '0 11px', borderRadius: 999, border: `1.5px solid ${on ? 'var(--color-accent-300)' : 'var(--color-neutral-300)'}`, background: on ? 'var(--color-accent-100)' : 'transparent', color: on ? 'var(--color-accent-800)' : 'var(--color-neutral-700)', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{sname}</button>;
            })}
            <div style={{ display: 'flex', alignItems: 'center', height: 30, borderRadius: 999, border: '1.5px dashed var(--color-neutral-300)', padding: '0 3px 0 10px' }}>
              <input placeholder="Subcategory" value={newSub} onChange={e => setNewSub(e.target.value)} onKeyDown={blurOnEnter} onBlur={addSub} style={{ width: 104, border: 0, background: 'transparent', fontSize: 16, fontWeight: 600, color: TEXT, padding: 0, outline: 'none' }} />
              <button onClick={addSub} aria-label="Add subcategory" style={{ width: 22, height: 22, borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.Plus size={11} sw={3} /></button>
            </div>
          </div>
        </div>
        <FieldLabel>Paid with</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {d.accounts.map(x => (
            <button key={x.id} onClick={() => setA(x.id)} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${x.id === a ? ink(x.hue) : '#fff'}`, background: x.id === a ? tint(x.hue) : '#fff', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{x.type === 'card' ? `${fmt((x.limit || 0) - x.bal)} available` : fmt(x.bal)}</span>
            </button>
          ))}
        </div>
        <input placeholder="What was it for?" value={note} onChange={e => setNote(e.target.value)} style={{ ...textInput, marginTop: 16 }} />
        <FieldLabel>Tags</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {d.tags.map(t => {
            const on = tagSel.includes(t);
            return <button key={t} onClick={() => setTagSel(s => (s.includes(t) ? s.filter(y => y !== t) : [...s, t]))} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: on ? ink(tagHue(t)) : '#fff', color: on ? '#fff' : TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s' }}>#{t}</button>;
          })}
          <div style={{ display: 'flex', alignItems: 'center', height: 34, borderRadius: 999, background: '#fff', border: '2px dashed var(--color-neutral-300)', padding: '0 4px 0 12px' }}>
            <input placeholder="New tag" value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }} style={{ width: 92, border: 0, background: 'transparent', fontSize: 16, fontWeight: 600, color: TEXT, padding: 0, outline: 'none' }} />
            <button onClick={addTag} aria-label="Add tag" style={{ width: 24, height: 24, borderRadius: 999, border: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-700)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.Plus size={13} sw={3} /></button>
          </div>
        </div>
        <div style={{ margin: '14px 4px 0', fontSize: 13, color: previewColor }}>{preview}</div>
        <PrimaryBtn onClick={save} disabled={cant} fs={17}>Save expense</PrimaryBtn>
      </div>
    </>
  );
}

/* ---------------- Pocket detail ---------------- */
export function PocketSheet({ id, view: v0 }: { id: string; view?: PocketView }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const s = pocketStats(d, id, c);
  const [view, setView] = useState<PocketView>(v0 ?? 'week');
  if (!s) return <SheetFrame title="Pocket"><div style={{ fontSize: 14, color: 'var(--color-neutral-700)' }}>This pocket was deleted.</div></SheetFrame>;
  const k = ink(s.hue);
  const ds = dayStats(d, id, c, s), ms = monthStats(d, id, c);
  const list = view === 'day' ? d.expenses.filter(e => e.p === id && e.date === c.today) : view === 'week' ? weekExpenses(d, c).filter(e => e.p === id) : monthExpenses(d, c).filter(e => e.p === id);
  const items = [...list].sort(byDateDesc).map(e => expView(d, e, c));
  const cantMove = s.left <= 0.004;
  const big = (label: string, n: number) => <>
    <span style={{ fontSize: 14, fontWeight: 600, color: k }}>{label}</span>
    <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: n < 0 ? RED : k }}>{fmt(Math.abs(n))}</span>
  </>;
  const empty = view === 'day' ? 'Nothing spent here today.' : view === 'week' ? 'Nothing spent here yet this week.' : `Nothing spent here in ${monthName(c.month)} yet.`;

  return (
    <SheetFrame title={s.name}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Segmented items={[['day', 'Today'], ['week', 'This week'], ['month', monthName(c.month)]]} value={view} onPick={setView} mt={2} />
        <div style={{ marginTop: 10, background: tint(s.hue), borderRadius: 28, padding: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {view === 'day' ? (
            ds.active ? <>
              {big(ds.left < 0 ? 'Over today’s amount by' : 'You can spend today', ds.left)}
              <div style={{ marginTop: 12 }}><Bar pct={pctOf(ds.spentToday, ds.allowance)} track="rgba(255,255,255,.8)" fill={k} /></div>
              <span style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4, color: k }}>
                {fmt(ds.allowance)} for today: {fmt(s.left + ds.spentToday)} left this week ÷ {ds.week.filter(x => x.active && !x.past).length} spending day{ds.week.filter(x => x.active && !x.past).length === 1 ? '' : 's'} left (today included).{ds.spentToday > 0 ? ` Spent ${fmt(ds.spentToday)} so far.` : ''}
              </span>
            </> : <>
              <span style={{ fontSize: 14, fontWeight: 600, color: k }}>Today isn’t a spending day</span>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: ds.spentToday > 0 ? RED : k }}>{ds.spentToday > 0 ? `Spent ${fmt(ds.spentToday)} today` : 'Better not spend today'}</span>
              <span style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4, color: k }}>
                {ds.next ? `Next spending day: ${dayLabel(ds.next.date, c)}, with ${fmt(ds.next.amount)}.` : 'No more spending days this week. It starts over on Monday.'}
                {ds.spentToday > 0 ? ' What you spend today comes out of the days still to come.' : ''}
              </span>
            </>
          ) : view === 'week' ? <>
            {big(s.left < 0 ? 'Over budget this week' : 'Left this week', s.left)}
            <div style={{ marginTop: 12 }}><Bar pct={pctOf(s.spent, s.budget)} track="rgba(255,255,255,.8)" fill={k} /></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={pill(k)}>Planned {fmt(s.weekly)}</span>
              <span style={pill(k)}>Spent {fmt(s.spent)}</span>
              <span style={pill(k)}>Moved {fmt(s.mIn - s.mOut, true)}</span>
            </div>
          </> : <>
            {big(ms.left < 0 ? `Over budget in ${monthName(c.month)}` : `Left in ${monthName(c.month)}`, ms.left)}
            <div style={{ marginTop: 12 }}><Bar pct={pctOf(ms.spent, ms.budget)} track="rgba(255,255,255,.8)" fill={k} /></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={pill(k)}>Planned {fmt(s.weekly * c.weeks)}</span>
              <span style={pill(k)}>Spent {fmt(ms.spent)}</span>
              <span style={pill(k)}>Moved {fmt(ms.extra, true)}</span>
            </div>
            <span style={{ marginTop: 8, fontSize: 12.5, color: k }}>{fmt(s.weekly)} a week × {c.weeks} weeks{ms.extra ? `, ${ms.extra > 0 ? 'plus' : 'minus'} ${fmt(Math.abs(ms.extra))} moved this month` : ''}.</span>
          </>}
        </div>

        {view === 'day' && <DayPlanner id={id} hue={s.hue} ds={ds} />}
        {view !== 'day' && <MovesCard id={id} />}

        <div style={{ marginTop: 12, background: '#fff', borderRadius: 22, padding: '4px 16px' }}>
          {items.map((e, i) => (
            <div key={e.key} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: e.key, back: { name: 'pocket', id, view } })} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === items.length - 1 ? 'transparent' : LINE}`, fontSize: 14, cursor: 'pointer' }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>{e.note}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{e.meta}</span>
                {e.tagLine && <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-700)' }}>{e.tagLine}</span>}
              </span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{e.amtFmt}</span>
            </div>
          ))}
          {items.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>{empty}</div>}
        </div>
        <button onClick={() => openSheet({ name: 'editPocket', id })} className="hv-n200" style={{ marginTop: 12, height: 44, borderRadius: 999, border: 0, background: 'transparent', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <I.Pencil size={15} />Edit pocket
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => openSheet({ name: 'move', id })} disabled={cantMove} className="hv-n200" style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: cantMove ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <I.Swap size={17} />Move leftover
          </button>
          <button onClick={() => openSheet({ name: 'add', pocket: id })} className="hv-acc600" style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Add expense</button>
        </div>
      </div>
    </SheetFrame>
  );
}

/** Every move in or out of a pocket this month, each one editable or reversible. */
function MovesCard({ id }: { id: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [open, setOpen] = useState<string | null>(null);
  const [amt, setAmt] = useState('');
  const [confirmAll, setConfirmAll] = useState(false);
  const list = d.moves.filter(m => (m.to === id || m.from === id) && (moveMonth(m) === c.month || m.week === c.weekStart))
    .sort((a, b) => moveTime(b) - moveTime(a) || (b.week > a.week ? 1 : -1));
  if (!list.length) return null;
  const nameOf = (x: string) => d.pockets.find(p => p.id === x)?.name ?? d.goals.find(g => g.id === x)?.name ?? 'a deleted pocket';
  const incomeOf = (m: Move) => d.incomes.find(t => incomeMoves([m], t).length);
  const label = (m: Move) => m.to === id
    ? (m.from === '_income' ? `From income${incomeOf(m) ? ` · ${incomeOf(m)!.note}` : ''}` : `From ${nameOf(m.from)}`)
    : `To ${nameOf(m.to)}${d.goals.some(g => g.id === m.to) ? ' (goal)' : ''}`;
  const when = (m: Move) => {
    const t = moveTime(m), w = `week of ${shortDate(m.week)}`;
    return [t ? relDay(isoOf(t), c.today) : '', m.month ? `spread over ${m.spread ?? 1} week${(m.spread ?? 1) > 1 ? 's' : ''}` : w].filter(Boolean).join(' · ');
  };
  const net = list.reduce((a, m) => a + (m.to === id ? m.amt : -m.amt), 0);
  const save = (m: Move) => {
    const v = roundAmt(num(amt)), max = moveMax(d, m, c);
    if (v > max + 0.004) { flash(`The most this can be is ${fmt(max)}`); return; }
    setData(x => editMove(x, m.id, v)); setOpen(null); flash(v > 0 ? `Move changed to ${fmt(v)}` : 'Move undone');
  };
  const undo = (m: Move) => { setData(x => undoMove(x, m.id)); setOpen(null); flash(`Undone · ${fmt(m.amt)} ${m.to === id ? `went back to ${m.from === '_income' ? 'your saved income' : nameOf(m.from)}` : `came back to this pocket`}`); };
  const undoAll = () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setData(x => list.reduce<Data>((acc, m) => ({ ...acc, ...undoMove(acc, m.id) }), x));
    setConfirmAll(false); flash(`${list.length === 1 ? '1 move' : `${list.length} moves`} undone`);
  };
  return (
    <div style={{ marginTop: 12, background: '#fff', borderRadius: 22, padding: '12px 16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Moves this month</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: net < 0 ? RED : 'oklch(0.45 0.11 150)' }}>{fmt(net, true)}</span>
      </div>
      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--color-neutral-700)' }}>Tap a move to change it or undo it.</span>
      {list.map((m, i) => {
        const inn = m.to === id, isOpen = open === m.id;
        return (
          <div key={m.id} style={{ borderBottom: `1px solid ${i === list.length - 1 ? 'transparent' : LINE}` }}>
            <button onClick={() => { setOpen(isOpen ? null : m.id); setAmt(String(m.amt)); }} aria-expanded={isOpen}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
              <span style={{ width: 30, height: 30, borderRadius: 999, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', background: inn ? 'oklch(0.95 0.045 155)' : 'var(--color-accent-100)', color: inn ? 'oklch(0.42 0.09 155)' : 'var(--color-accent-700)', fontSize: 15, fontWeight: 800 }}>{inn ? '↓' : '↑'}</span>
              <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label(m)}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{when(m)}</span>
              </span>
              <span style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', color: inn ? 'oklch(0.45 0.11 150)' : RED }}>{inn ? '+' : '−'}{fmt(m.amt)}</span>
            </button>
            {isOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <div style={{ ...textInput, flex: 1, display: 'flex', alignItems: 'baseline', gap: 4, padding: '11px 14px', background: 'var(--color-neutral-100)' }}>
                    <span style={{ fontWeight: 700, color: 'var(--color-neutral-500)' }}>{curSymbol()}</span>
                    <MoneyInput value={amt} onChange={setAmt} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
                  </div>
                  <button onClick={() => save(m)} style={{ height: 46, padding: '0 16px', borderRadius: 16, border: 0, background: TEXT, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                </div>
                <button onClick={() => undo(m)} style={{ height: 42, borderRadius: 999, border: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Undo this move</button>
                <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
                  {m.from === '_income' ? 'Undoing it takes the money out of this pocket; the income stays in your account, just not assigned to a pocket.'
                    : inn ? `Undoing it gives the money back to ${nameOf(m.from)}.` : `Undoing it brings the money back to this pocket${d.goals.some(g => g.id === m.to) ? ' and takes it off the goal' : ''}.`} Moves never change your account balances.
                </span>
              </div>
            )}
          </div>
        );
      })}
      <button onClick={undoAll} style={{ width: '100%', marginTop: 4, height: 40, border: 0, borderRadius: 999, background: confirmAll ? 'var(--color-accent-100)' : 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
        {confirmAll ? `Tap again to undo all ${list.length} and reset this pocket to its plan` : 'Undo all moves (reset pocket)'}
      </button>
    </div>
  );
}
const isoOf = (t: number) => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/** Saves a pocket's spending days; every day = no restriction. Keeps at least one day. */
export const setPocketDays = (id: string, days: number[]) => setData(x => ({ pockets: x.pockets.map(p => (p.id === id ? { ...p, days: days.length === 7 ? undefined : [...days].sort() } : p)) }));

/** Tap the days this pocket is used on; each day shows what it gets this week. */
function DayPlanner({ id, hue, ds }: { id: string; hue: number; ds: DayStats }) {
  const on = ds.week.filter(x => x.active).map(x => x.wd);
  const toggle = (wd: number) => {
    const next = on.includes(wd) ? on.filter(x => x !== wd) : [...on, wd];
    if (!next.length) { flash('Keep at least one spending day'); return; }
    setPocketDays(id, next);
  };
  const k = ink(hue);
  return (
    <div style={{ marginTop: 12, background: '#fff', borderRadius: 22, padding: '14px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0 4px' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Spending days</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Tap a day to turn it on or off</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
        {ds.week.map(x => (
          <button key={x.date} onClick={() => toggle(x.wd)} aria-pressed={x.active} aria-label={`${DAY_NAMES[x.wd]}: ${x.active ? 'spending day' : 'no spending'}`}
            style={{ border: 0, borderRadius: 14, padding: '8px 0 7px', cursor: 'pointer', background: x.active ? tint(hue) : 'var(--color-neutral-100)', boxShadow: x.today ? `inset 0 0 0 2px ${k}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: x.active ? k : 'var(--color-neutral-500)', opacity: x.past ? 0.6 : 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{DAY_LETTERS[x.wd]}</span>
            <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{x.past ? (x.spent ? compactAmt(x.spent) : '–') : x.active ? compactAmt(x.amount) : '0'}</span>
          </button>
        ))}
      </div>
      <span style={{ padding: '0 4px', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
        The week's money is shared only by the days you turn on, and days that are off get $0. Past days show what you spent; today and the days ahead show what each one gets. Whatever you don't spend today moves on to the next spending day.
      </span>
    </div>
  );
}
/** 18.000 → 18k, 1.250.000 → 1,3M, for the small day tiles. */
const compactAmt = (n: number) => { const a = Math.abs(n); return a >= 1e6 ? `${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })}M` : a >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)); };

/* ---------------- Saved confirmation ---------------- */
export function SavedSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const s = pocketStats(d, id);
  if (!s) return null;
  const k = ink(s.hue), cantMove = s.left <= 0.004;
  return (
    <SheetFrame title="Saved">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginTop: 10, background: tint(s.hue), borderRadius: 28, padding: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: k }}>{s.name} · {s.left < 0 ? 'Over budget this week' : 'Left this week'}</span>
          <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: s.left < 0 ? RED : k }}>{fmt(Math.abs(s.left))}</span>
          <div style={{ marginTop: 12 }}><Bar pct={pctOf(s.spent, s.budget)} track="rgba(255,255,255,.8)" fill={k} /></div>
          <span style={{ marginTop: 8, fontSize: 13, color: k }}>{fmt(s.spent)} spent of {fmt(s.budget)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => openSheet({ name: 'move', id })} disabled={cantMove} className="hv-n200" style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: '#fff', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: cantMove ? 0.45 : 1 }}>Move leftover</button>
          <button onClick={closeSheet} style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: TEXT, color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Move leftover ---------------- */
export function MoveSheet({ id, to }: { id: string; to?: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const all = allStats(d, c), s = all.find(x => x.id === id);
  const [amt, setAmt] = useState(() => (s ? String(d.settings.currency === 'COP' ? Math.floor(Math.max(0, s.left)) : Math.floor(Math.max(0, s.left) * 100) / 100) : ''));
  const [dest, setDest] = useState<string | undefined>(to || all.find(x => x.id !== id)?.id || d.goals[0]?.id);
  if (!s) return null;
  const v = num(amt), tgtP = all.find(x => x.id === dest && x.id !== id), tgtG = d.goals.find(g => g.id === dest);
  const tgtName = tgtP?.name || tgtG?.name || null;
  const tooMuch = v > s.left + 0.004, cant = v <= 0 || tooMuch || !tgtName;
  const hint = tooMuch ? `You can move up to ${fmt(Math.max(0, s.left))}.`
    : tgtP && v > 0 ? `${tgtP.name} will have ${fmt(tgtP.left + v)} left this week.`
    : tgtG && v > 0 ? `${tgtG.name} goes to ${fmt(tgtG.saved + v)} of ${fmt(tgtG.target)}.` : 'Choose where the money should go.';
  const confirm = () => {
    if (cant) return;
    const val = roundAmt(v);
    setData(x => ({ moves: [...x.moves, { id: uid('m'), week: c.weekStart, from: id, to: dest!, amt: val }], goals: tgtG ? x.goals.map(g => (g.id === tgtG.id ? { ...g, saved: g.saved + val } : g)) : x.goals }));
    closeSheet(); flash(`Moved ${fmt(val)} to ${tgtName}`);
  };
  return (
    <SheetFrame title="Move money">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px', fontSize: 13, color: 'var(--color-neutral-700)' }}>{fmt(s.left)} left in {s.name} this week</span>
        <BigAmount value={amt} onChange={setAmt} />
        <FieldLabel m="18px 4px 8px">To a pocket</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {all.filter(x => x.id !== id).map(x => <PickChip key={x.id} st={x} on={x.id === dest} hue={x.hue} onClick={() => setDest(x.id)} />)}
        </div>
        {d.goals.length > 0 && <>
          <FieldLabel>Or save it</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.goals.map(g => <PickChip key={g.id} st={g} on={g.id === dest} hue={g.hue} onClick={() => setDest(g.id)} icon={<I.Target size={13} />} />)}
          </div>
        </>}
        <div style={{ margin: '16px 4px 0', fontSize: 13, color: tooMuch ? RED : 'var(--color-neutral-700)' }}>{hint}</div>
        <PrimaryBtn onClick={confirm} disabled={cant}>{tgtName ? `Move ${fmt(v)} to ${tgtName}` : 'Move'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Edit / new pocket ---------------- */
export function EditPocketSheet({ id }: { id: string | null }) {
  const { data: d } = useApp();
  const base = id ? d.pockets.find(p => p.id === id) : undefined;
  const isNew = !base;
  const [name, setName] = useState(base?.name ?? '');
  const [weekly, setWeekly] = useState(base?.weeklyStr ?? '');
  const [emoji, setEmoji] = useState(base ? base.emoji || '' : '💪');
  const [photo, setPhoto] = useState<string | null>(base?.photo ?? null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [days, setDays] = useState<number[]>(base?.days?.length ? base.days : [0, 1, 2, 3, 4, 5, 6]);
  const hue = base ? base.hue : HUES[d.pockets.length % HUES.length];
  const w = num(weekly), cant = !name.trim();
  const icon = photo ? '' : emoji || name.trim().charAt(0).toUpperCase() || '·';

  const save = () => {
    if (cant) return;
    const patch = { name: name.trim(), weeklyStr: String(w), emoji, photo, days: days.length === 7 ? undefined : [...days].sort() };
    if (isNew) { setData(x => ({ pockets: [...x.pockets, { id: uid('p'), hue: HUES[x.pockets.length % HUES.length], ...patch }] })); closeSheet(); }
    else { setData(x => ({ pockets: x.pockets.map(p => (p.id === id ? { ...p, ...patch } : p)) })); openSheet({ name: 'pocket', id: id! }); }
    flash(isNew ? `${patch.name} created` : 'Pocket updated');
  };
  const remove = () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setData(x => ({ pockets: x.pockets.filter(p => p.id !== id), moves: x.moves.filter(m => m.from !== id && m.to !== id) }));
    closeSheet(); flash(`${name || 'Pocket'} deleted`);
  };

  return (
    <SheetFrame title={isNew ? 'New pocket' : 'Edit pocket'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: '#fff', borderRadius: 22, padding: 14 }}>
          <div style={{ width: 68, height: 68, borderRadius: 999, backgroundColor: tint(hue), backgroundImage: photo ? `url(${photo})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center', color: ink(hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32, flex: 'none' }}>{icon}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <button onClick={() => pickPhoto().then(p => p && setPhoto(p))} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <I.Image size={14} />{photo ? 'Change image' : 'Upload image'}
            </button>
            {photo && <button onClick={() => setPhoto(null)} style={{ padding: '0 4px', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Use emoji instead</button>}
          </div>
        </div>
        <FieldLabel m="14px 4px 6px">Emoji</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,minmax(0,1fr))', gap: 4, background: '#fff', borderRadius: 22, padding: 8 }}>
          {EMOJIS.map(m => <button key={m} onClick={() => { setEmoji(m); setPhoto(null); }} style={{ aspectRatio: '1', borderRadius: 12, border: 0, background: !photo && emoji === m ? tint(hue) : 'transparent', fontSize: 20, cursor: 'pointer', padding: 0, transition: 'background .15s' }}>{m}</button>)}
        </div>
        <FieldLabel m="14px 4px 6px">Name</FieldLabel>
        <input value={name} placeholder="Gym" onChange={e => setName(e.target.value)} style={textInput} />
        <FieldLabel m="14px 4px 6px">Weekly budget</FieldLabel>
        <SmallAmount value={weekly} onChange={setWeekly} />
        <span style={{ margin: '8px 4px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>{fmt(w * d.settings.weeks)} a month over {d.settings.weeks} weeks</span>
        <FieldLabel m="14px 4px 6px">Spending days</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
          {DAY_LETTERS.map((l, wd) => {
            const on = days.includes(wd);
            return <button key={wd} aria-pressed={on} aria-label={DAY_NAMES[wd]} onClick={() => setDays(on ? (days.length > 1 ? days.filter(x => x !== wd) : days) : [...days, wd])}
              style={{ height: 42, borderRadius: 14, border: 0, background: on ? tint(hue) : '#fff', color: on ? ink(hue) : 'var(--color-neutral-500)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{l}</button>;
          })}
        </div>
        <span style={{ margin: '8px 4px 0', fontSize: 13, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
          {days.length === 7 ? 'Every day. The Today view shares the week’s money across the days left.' : `Only ${days.slice().sort().map(x => DAY_NAMES[x]).join(', ')}${w > 0 ? `: about ${fmt(w / days.length)} each` : ''}. Other days show that you shouldn’t spend from this pocket.`}
        </span>
        <PrimaryBtn onClick={save} disabled={cant} mt={18}>{isNew ? 'Create pocket' : 'Save changes'}</PrimaryBtn>
        {!isNew && <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete pocket'}</GhostDanger>}
      </div>
    </SheetFrame>
  );
}
