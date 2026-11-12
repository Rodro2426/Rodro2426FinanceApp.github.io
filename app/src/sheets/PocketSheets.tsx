import { moneyHidden } from '../lib/privacy';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useApp, setData, setUI, openSheet, closeSheet, flash } from '../lib/store';
import { EMOJIS, HUES, LINE, RED, TEXT, ink, tint } from '../lib/constants';
import { DAY_LETTERS, DAY_NAMES, catOf, editMove, incomeMoves, moveInPeriod, moveMax, moveMonth, moveTime, undoMove, allStats, byDateDesc, chargeAccount, ctxOf, curSymbol, isCOP, dayLabel, dayStats, fmt, isHalf, monthExpenses, monthPlanOf, monthStats, num, pctOf, periodAt, pocketCtx, pocketStats, weekdayOf, roundAmt, sortedExpenses, uid, weekExpenses, weeksLeft, type DayStats, myExpenses } from '../lib/derive';
import { addDays, monthName, relDay, shortDate } from '../lib/dates';
import { pickPhoto } from '../lib/photo';
import { COVER, NEXT, addExtraIncome, coverFirst, coverWith, leftovers, monthSummary, splitAmong, suggestCover, transferLeftover, type ExtraIncome, type SplitDist, type SplitMode } from '../lib/plan';
import { largestRemainder, unitsFor, weekShares } from '../lib/split';
import { incomeCatList } from '../lib/reports';
import type { Data, Move, PocketView } from '../lib/types';
import { BigAmount, Fill, Toggle, Bar, ExpRow, FieldLabel, GhostDanger, PctSlider, PickChip, PocketDot, PrimaryBtn, Segmented, SmallAmount, expView, textInput } from '../ui/bits';
import { MoneyInput } from '../ui/MoneyInput';
import { HuePicker } from '../ui/HuePicker';
import { CategoryPicker, type CatPick } from '../ui/CategoryPicker';
import { SheetFrame } from './Sheet';
import { SwipeRow } from '../ui/SwipeRow';
import * as I from '../ui/icons';

const pill = (k: string) => ({ fontSize: 12, fontWeight: 600, color: k, background: 'var(--glass)', padding: '5px 10px', borderRadius: 999, whiteSpace: 'nowrap' }) as const;

/* ---------------- Search ---------------- */
export function SearchSheet({ tag, cat }: { tag?: string | null; cat?: string | null }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const [q, setQ] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(tag ?? null);
  const [filterCat, setFilterCat] = useState<string | null>(cat ?? null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Focus after the sheet has slid in, without letting Safari scroll the page.
  useEffect(() => { const t = setTimeout(() => searchRef.current?.focus({ preventScroll: true }), 300); return () => clearTimeout(t); }, []);
  const stats = new Map(allStats(d, c).map(x => [x.id, x]));
  const qs = q.trim().toLowerCase().replace(/^#/, '');
  const matches = sortedExpenses(d).filter(e => {
    const tg = e.tags || [];
    if (filterTag && !tg.includes(filterTag)) return false;
    if (filterCat && catOf(e)[0] !== filterCat) return false;
    if (!qs) return true;
    const pn = (stats.get(e.p)?.name || '').toLowerCase(), an = (d.accounts.find(a => a.id === e.a)?.name || '').toLowerCase();
    return e.note.toLowerCase().includes(qs) || pn.includes(qs) || an.includes(qs) || tg.some(t => t.includes(qs)) || catOf(e).join(' ').toLowerCase().includes(qs);
  });
  const shown = matches.slice(0, 200).map(e => expView(d, e, c, stats));
  const tagHue = (t: string) => HUES[Math.max(0, d.tags.indexOf(t)) % HUES.length];
  const tagCount = (t: string) => d.expenses.filter(e => (e.tags || []).includes(t)).length;
  const catCount = (k: string) => d.expenses.filter(e => catOf(e)[0] === k).length;
  const catNames = [...new Set([...d.cats.map(k => k.name), ...d.expenses.map(e => catOf(e)[0])])].filter(catCount).sort((a, b) => catCount(b) - catCount(a));
  const chips = [{ key: '', label: 'All tags', on: !filterTag, hue: null as number | null, pick: () => setFilterTag(null) },
    ...d.tags.filter(tagCount).map(t => ({ key: t, label: `#${t} · ${tagCount(t)}`, on: filterTag === t, hue: tagHue(t), pick: () => setFilterTag(f => (f === t ? null : t)) }))];

  return (
    <SheetFrame title="Transactions" topOnFocus>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 560 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6, background: 'var(--surface)', borderRadius: 999, padding: '0 16px', height: 50 }}>
          <I.Search size={18} color="var(--color-neutral-500)" />
          <input placeholder="Search by name, category, pocket or #tag" value={q} onChange={e => setQ(e.target.value)} ref={searchRef} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 16, color: TEXT, padding: 0, outline: 'none' }} />
          {q && <button onClick={() => setQ('')} aria-label="Clear" style={{ width: 24, height: 24, borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><I.X size={12} sw={3} /></button>}
        </div>
        <div className="noscroll" aria-label="Filter by category" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '12px -20px 0', padding: '0 20px' }}>
          {[{ k: '', label: 'All categories' }, ...catNames.map(k => ({ k, label: `${k} · ${catCount(k)}` }))].map(g => {
            const on = g.k ? filterCat === g.k : !filterCat;
            return <button key={'c' + g.k} onClick={() => setFilterCat(g.k ? (filterCat === g.k ? null : g.k) : null)} style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{g.label}</button>;
          })}
        </div>
        <div className="noscroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '8px -20px 0', padding: '0 20px' }}>
          {chips.map(g => (
            <button key={g.key} onClick={g.pick} style={{ flex: 'none', height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: g.on ? (g.hue != null ? ink(g.hue) : TEXT) : 'var(--surface)', color: g.on ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease' }}>{g.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '16px 4px 8px', fontSize: 13 }}>
          <span style={{ color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{matches.length === 1 ? '1 transaction' : `${matches.length} transactions`}</span>
          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>−{fmt(matches.reduce((a, e) => a + e.amt, 0))}</span>
        </div>
        <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '4px 16px' }}>
          {shown.map((v, i) => <SwipeRow key={v.key} kind="expense" id={v.key} back={{ name: 'search', tag: filterTag, cat: filterCat }}><ExpRow v={v} size={38} last={i === shown.length - 1} onClick={() => openSheet({ name: 'txn', kind: 'expense', id: v.key, back: { name: 'search', tag: filterTag, cat: filterCat } })} /></SwipeRow>)}
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
  const [incCat, setIncCat] = useState('');
  const [toP, setToP] = useState('0');
  const [mode, setMode] = useState<SplitMode>('month');
  const [dist, setDist] = useState<SplitDist>('budget');
  const [manual, setManual] = useState<Record<string, string>>({});
  const nWeeks = weeksLeft(c), scale = unitsFor(d.settings.currency);
  const X = roundAmt(num(amt));
  const manualNums = Object.fromEntries(d.pockets.map(p => [p.id, roundAmt(num(manual[p.id]))]));
  const A = dist === 'manual' ? Object.values(manualNums).reduce((s, n) => s + n, 0) : Math.min(X, roundAmt(num(toP)));
  const tooMuch = A > X + 0.004;
  const cant = !(X > 0) || !accounts.some(x => x.id === a) || tooMuch || !incCat;

  const before = monthSummary(d, c);
  const input: ExtraIncome = { amt: X, acct: a, note, toPockets: A, mode, dist, manual: manualNums, cat: incCat };
  const preview = X > 0 && !tooMuch && accounts.some(x => x.id === a) ? { ...d, ...addExtraIncome(d, c, { ...input, id: 'preview' }) } : null;
  const after = preview ? monthSummary(preview, c) : null;
  const parts = A > 0 && !tooMuch ? splitAmong(d, A, dist, manualNums) : {};
  const acctName = accounts.find(x => x.id === a)?.name;
  const cover = coverFirst(d, c, X);

  const quick = (v: number) => { setDist(dd => (dd === 'manual' ? 'budget' : dd)); setToP(String(v)); };
  /** Tapping a pocket puts everything going to pockets there (the whole income if nothing was chosen yet). */
  const allTo = (id: string) => { setManual({ [id]: String(A > 0 && !tooMuch ? A : X) }); setDist('manual'); };
  /** What each pocket gets right now (typed, or from By budget / Evenly). */
  const cur: Record<string, number> = dist === 'manual' ? manualNums : parts;
  /** Sliding a pocket switches to Manual, keeping what the other pockets already had. */
  const slide = (id: string, amt: number) => {
    setManual({ ...Object.fromEntries(Object.entries(cur).filter(([, v]) => v > 0).map(([k, v]) => [k, String(v)])), [id]: amt > 0 ? String(amt) : '' });
    setDist('manual');
  };
  const save = () => {
    if (cant) return;
    setData(x => addExtraIncome(x, ctxOf(x), input));
    closeSheet();
    const warn = after && after.real > 0.004 ? ` · Your pockets add up to ${fmt(after.real)} more than you have in your accounts` : '';
    flash(`+${fmt(X)} to ${acctName}${A > 0 ? ` · ${fmt(A)} to pockets` : ' · all saved'}${warn}`);
  };
  const chipBtn = (label: string, on: boolean, f: () => void, key?: string) => (
    <button key={key ?? label} onClick={f} className="hv-n200" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: on ? TEXT : 'var(--color-neutral-100)', color: on ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}</button>
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
      <FieldLabel m="14px 4px 6px">Name of the transaction</FieldLabel>
      <input placeholder="e.g. Freelance, gift, refund" aria-label="Name of the transaction" value={note} onChange={e => setNote(e.target.value)} style={textInput} />
      <FieldLabel m="14px 4px 6px">Category {!incCat && <span style={{ color: RED, fontWeight: 700 }}>· required</span>}</FieldLabel>
      <div className="noscroll" aria-label="Income category" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
        {incomeCatList(d).map(k => <button key={k} onClick={() => setIncCat(k)} aria-pressed={incCat === k} style={{ flex: 'none', height: 34, padding: '0 13px', borderRadius: 999, border: 0, background: incCat === k ? TEXT : 'var(--surface)', color: incCat === k ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: 'inset 0 0 0 1px var(--color-neutral-200)' }}>{k}</button>)}
      </div>
      <FieldLabel>Goes into</FieldLabel>
      <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
        {accounts.map(x => (
          <button key={x.id} onClick={() => setA(x.id)} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${x.id === a ? ink(x.hue) : 'var(--surface)'}`, background: x.id === a ? tint(x.hue) : 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
            <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.name}</span>
            <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{fmt(x.bal)}</span>
          </button>
        ))}
        {accounts.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Add a bank or cash account first, in the Accounts tab.</span>}
      </div>

      <FieldLabel m="16px 4px 6px">How much goes to pockets?</FieldLabel>
      <div style={{ background: 'var(--surface)', borderRadius: 22, padding: '12px 12px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
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

      {(X > 0 || dist === 'manual') && (
        <div style={{ marginTop: 10, background: 'var(--surface)', borderRadius: 22, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Segmented items={[['week', 'This week'], ['month', `Rest of ${monthName(c.month)}`]]} value={mode} onPick={setMode} mt={0} h={36} />
          <span style={{ margin: '0 2px', fontSize: 12, lineHeight: 1.35, color: 'var(--color-neutral-700)' }}>
            {mode === 'week' ? 'All of it goes to this week. On Monday the pockets start over.' : nWeeks > 1 ? `Shared equally over the ${nWeeks} weeks left in ${monthName(c.month)}, this one included.` : `This is the last week of ${monthName(c.month)}, so it all goes to this week.`}
          </span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
            {chipBtn('By budget', dist === 'budget', () => setDist('budget'))}
            {chipBtn('Evenly', dist === 'even', () => setDist('even'))}
            {chipBtn('Manual', dist === 'manual', () => { setManual(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, String(v)]))); setDist('manual'); })}
          </div>
          {d.pockets.length > 0 && <span style={{ margin: '0 2px', fontSize: 12, color: 'var(--color-neutral-700)' }}>Tap a pocket to put it all there, or slide to choose a percent.</span>}
          {d.pockets.map(p => {
            const ms0 = monthStats(d, p.id, c), part = parts[p.id] ?? 0;
            const perWeek = mode === 'month' ? weekShares(part, nWeeks, scale)[0] : part;
            const st = allStats(d, c).find(x => x.id === p.id)!;
            return (
              <div key={p.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '6px 0', borderTop: `1px solid ${LINE}` }}>
                <button onClick={() => allTo(p.id)} aria-label={`Put all in ${p.name}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'transparent', padding: 0, margin: 0, color: TEXT, font: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                  <PocketDot st={st} size={32} fs={15} bg={tint(p.hue)} color={ink(p.hue)} />
                  <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Left in month: {fmt(ms0.left)} → <b style={{ color: TEXT }}>{fmt(ms0.left + part)}</b></span>
                    {part > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.45 0.11 150)' }}>{mode === 'month' ? `+${fmt(perWeek)}/week` : `+${fmt(part)} this week`}</span>}
                  </span>
                </button>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, background: tint(p.hue), borderRadius: 14, padding: '8px 10px', width: 116, flex: 'none' }}>
                  <span style={{ fontSize: 14, color: ink(p.hue) }}>{curSymbol()}</span>
                  {dist === 'manual'
                    ? <MoneyInput value={manual[p.id] || ''} onChange={x => setManual(s0 => ({ ...s0, [p.id]: x }))} ariaLabel={`${p.name} share`} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, color: ink(p.hue), padding: 0, outline: 'none', textAlign: 'right' }} />
                    : <span style={{ width: '100%', fontSize: 16, fontWeight: 700, color: ink(p.hue), textAlign: 'right' }}>{fmt(part).replace(curSymbol(), '')}</span>}
                </div>
                <PctSlider amount={cur[p.id] || 0} total={X} max={X - Object.entries(cur).reduce((t, [k, v]) => (k === p.id ? t : t + v), 0)} hue={p.hue} label={`Percent for ${p.name}`} onChange={v => slide(p.id, v)} />
              </div>
            );
          })}
          {d.pockets.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '6px 0' }}>Create pockets in the Budget tab first.</span>}
        </div>
      )}

      <div aria-label="Preview" style={{ marginTop: 10, background: 'var(--surface)', borderRadius: 22, padding: '12px 14px', display: 'flex', flexDirection: 'column' }}>
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
  // Every expense needs a category: nothing is picked until you choose one.
  const [[cat, sub], setCat] = useState<[string, string]>(['', '']);
  // Split: one purchase shared between categories (each part is saved as its own transaction, linked together).
  const [split, setSplit] = useState(false);
  const [parts, setParts] = useState<{ id: string; cat: CatPick; amt: string }[]>([]);

  const all = allStats(d, c), addS = all.find(x => x.id === p), payA = d.accounts.find(x => x.id === a);
  const v = num(amt), after = addS ? addS.left - v : 0;
  let preview = 'Enter an amount, a category and a pocket.', previewColor = 'var(--color-neutral-700)';
  if (!p && v > 0) preview = `Not in any pocket: it won't touch your weekly budgets, but it still counts in ${monthName(c.month)}'s spending and comes out of ${payA?.name ?? 'the account'}.`;
  if (addS && v > 0) {
    preview = after >= 0 ? `${fmt(after)} will be left in ${addS.name} this week.` : `This puts ${addS.name} ${fmt(-after)} over for the week.`;
    if (after < 0) previewColor = RED;
  }
  if (!d.accounts.length) preview = 'Add an account or card first, in the Accounts tab.';
  const partNums = parts.map(x => roundAmt(num(x.amt)));
  const assigned = partNums.reduce((s0, n) => s0 + n, 0), rest = roundAmt(v - assigned);
  const splitOk = split && parts.length >= 2 && parts.every((x, i) => x.cat[0] && partNums[i] > 0) && Math.abs(rest) < 0.005;
  const cant = !(v > 0 && (addS || p === '') && payA && (split ? splitOk : cat));
  if (v > 0 && !split && !cat) { preview = 'Pick a category to save it.'; previewColor = RED; }
  if (v > 0 && split && !splitOk) { preview = Math.abs(rest) >= 0.005 ? (rest > 0 ? `${fmt(rest)} still needs a category.` : `The parts add up to ${fmt(-rest)} more than the total.`) : 'Pick a category for each part.'; previewColor = RED; }
  const startSplit = () => {
    setSplit(true);
    setParts([{ id: uid('pt'), cat: cat ? [cat, sub] : ['', ''], amt: v > 0 ? String(roundAmt(v)) : '' }, { id: uid('pt'), cat: ['', ''], amt: '' }]);
  };
  const tagHue = (t: string) => HUES[Math.max(0, d.tags.indexOf(t)) % HUES.length];

  const addTag = () => {
    const t = newTag.trim().toLowerCase().replace(/^#+/, '');
    if (!t) return;
    if (!d.tags.includes(t)) setData(x => ({ tags: [...x.tags, t] }));
    setTagSel(s => (s.includes(t) ? s : [...s, t])); setNewTag('');
  };

  const save = () => {
    if (cant) return;
    const val = roundAmt(v), ts = Date.now();
    if (split) {
      const group = uid('split'), name = note.trim() || parts.map(x => x.cat[0]).join(' + ');
      const rows = parts.map((x, i) => ({ id: uid('e') + i, ts: ts + i, p, a, amt: partNums[i], note: name, date: c.today, tags: tagSel, cat: x.cat[0], sub: x.cat[1], split: group }));
      setData(x => ({ expenses: [...rows, ...x.expenses], accounts: chargeAccount(x.accounts, a, val) }));
    } else setData(x => ({
      expenses: [{ id: uid('e'), ts, p, a, amt: val, note: note.trim() || (sub && sub !== 'General' ? sub : cat), date: c.today, tags: tagSel, cat, sub }, ...x.expenses],
      accounts: chargeAccount(x.accounts, a, val)
    }));
    if (p) setUI({ sheet: { name: 'saved', id: p }, lastAdd: { pocket: p, acct: a } });
    else { setUI(u => ({ sheet: null, lastAdd: { ...u.lastAdd, acct: a } })); flash(`−${fmt(val)} · ${split ? `split in ${parts.length} categories` : cat + (sub ? ' › ' + sub : '')} · no pocket`); }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <BigAmount value={amt} onChange={setAmt} autoFocus mt={10} />
        <FieldLabel m="14px 4px 6px">Name of the transaction</FieldLabel>
        <input placeholder="e.g. Lunch at Crepes & Waffles" aria-label="Name of the transaction" value={note} onChange={e => setNote(e.target.value)} style={textInput} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '16px 4px 8px', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-neutral-700)' }}>{split ? 'Categories' : 'Category'} {!split && !cat && <span style={{ color: RED, fontWeight: 700 }}>· required</span>}</span>
          <button onClick={() => (split ? (setSplit(false), setCat(parts[0]?.cat[0] ? parts[0].cat : [cat, sub])) : startSplit())} style={{ border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{split ? 'Use one category' : 'Split into categories'}</button>
        </div>
        {!split ? <CategoryPicker value={[cat, sub]} onChange={setCat} /> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {parts.map((x, i) => (
              <div key={x.id} style={{ background: 'var(--color-neutral-100)', borderRadius: 20, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-neutral-700)', padding: '0 4px', whiteSpace: 'nowrap', flex: 'none' }}>Part {i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 2, background: 'var(--surface)', borderRadius: 12, padding: '8px 12px' }}>
                    <span style={{ fontSize: 15, color: 'var(--color-neutral-500)', fontWeight: 700 }}>{curSymbol()}</span>
                    <MoneyInput value={x.amt} onChange={val => setParts(ps => ps.map(y => (y.id === x.id ? { ...y, amt: val } : y)))} ariaLabel={`Part ${i + 1} amount`} style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontSize: 17, fontWeight: 700, color: TEXT, padding: 0, outline: 'none' }} />
                  </div>
                  {rest > 0.004 && <button onClick={() => setParts(ps => ps.map(y => (y.id === x.id ? { ...y, amt: String(roundAmt(num(y.amt) + rest)) } : y)))} style={{ height: 34, padding: '0 10px', borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>+ rest</button>}
                  {parts.length > 2 && <button onClick={() => setParts(ps => ps.filter(y => y.id !== x.id))} aria-label={`Remove part ${i + 1}`} style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: 'var(--surface)', color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.X size={14} /></button>}
                </div>
                <CategoryPicker compact value={x.cat} onChange={cv => setParts(ps => ps.map(y => (y.id === x.id ? { ...y, cat: cv } : y)))} />
              </div>
            ))}
            <button onClick={() => setParts(ps => [...ps, { id: uid('pt'), cat: ['', ''], amt: rest > 0 ? String(rest) : '' }])} style={{ height: 44, borderRadius: 999, border: '2px dashed var(--color-neutral-300)', background: 'transparent', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><I.Plus size={15} sw={2.5} />Add another category</button>
            <span style={{ margin: '0 4px', fontSize: 12.5, fontWeight: 600, color: Math.abs(rest) < 0.005 ? 'oklch(0.5 0.12 150)' : RED }}>{Math.abs(rest) < 0.005 ? `✓ All ${fmt(v)} has a category` : rest > 0 ? `${fmt(rest)} left to assign` : `${fmt(-rest)} more than the total`}</span>
          </div>
        )}
        <FieldLabel>Pocket</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {all.map(x => <PickChip key={x.id} st={x} on={x.id === p} hue={x.hue} onClick={() => setP(x.id)} />)}
          <button onClick={() => setP('')} aria-pressed={p === ''} style={{ height: 44, padding: '0 14px', borderRadius: 999, border: p === '' ? `2px solid ${TEXT}` : '2px dashed var(--color-neutral-300)', background: p === '' ? TEXT : 'transparent', color: p === '' ? 'var(--on-text)' : TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>No pocket</button>
        </div>
        <FieldLabel>Paid with</FieldLabel>
        <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
          {d.accounts.map(x => (
            <button key={x.id} onClick={() => setA(x.id)} style={{ flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1, padding: '10px 14px', borderRadius: 18, border: `2px solid ${x.id === a ? ink(x.hue) : 'var(--surface)'}`, background: x.id === a ? tint(x.hue) : 'var(--surface)', cursor: 'pointer', textAlign: 'left', color: TEXT }}>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' }}>{x.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{x.type === 'card' ? `${fmt((x.limit || 0) - x.bal)} available` : fmt(x.bal)}</span>
            </button>
          ))}
        </div>
        {d.accounts.find(x => x.id === a)?.notMine && <span style={{ margin: '6px 4px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>This card or account isn't yours: the expense is saved on it, but it isn't counted as your spending or taken from your pockets.</span>}
        <FieldLabel>Tags</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          {d.tags.map(t => {
            const on = tagSel.includes(t);
            return <button key={t} onClick={() => setTagSel(s => (s.includes(t) ? s.filter(y => y !== t) : [...s, t]))} style={{ height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: on ? ink(tagHue(t)) : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background-color .15s ease, color .15s ease, border-color .15s ease, box-shadow .15s ease' }}>#{t}</button>;
          })}
          <div style={{ display: 'flex', alignItems: 'center', height: 34, borderRadius: 999, background: 'var(--surface)', border: '2px dashed var(--color-neutral-300)', padding: '0 4px 0 12px' }}>
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
  const pk = d.pockets.find(x => x.id === id), half = isHalf(pk), until = `Until ${shortDate(s.to)}`;
  const list = view === 'day' ? myExpenses(d).filter(e => e.p === id && e.date === c.today) : view === 'week' ? weekExpenses(d, pocketCtx(pk, c)).filter(e => e.p === id) : monthExpenses(d, c).filter(e => e.p === id);
  const items = [...list].sort(byDateDesc).map(e => expView(d, e, c));
  const cantMove = s.left <= 0.004;
  const big = (label: string, n: number) => <>
    <span style={{ fontSize: 14, fontWeight: 600, color: k }}>{label}</span>
    <span style={{ fontSize: 42, fontWeight: 700, letterSpacing: '-0.035em', lineHeight: 1.05, color: n < 0 ? RED : k }}>{fmt(Math.abs(n))}</span>
  </>;
  const empty = view === 'day' ? 'Nothing spent here today.' : view === 'week' ? (half ? 'Nothing spent here yet this quincena.' : 'Nothing spent here yet this week.') : `Nothing spent here in ${monthName(c.month)} yet.`;

  return (
    <SheetFrame title={s.name}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <Segmented items={[['day', 'Today'], ['week', half ? until : 'This week'], ['month', monthName(c.month)]]} value={view} onPick={setView} mt={2} />
        <div style={{ marginTop: 10, background: tint(s.hue), borderRadius: 28, padding: 22, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {view === 'day' ? (
            ds.active ? <>
              {big(ds.left < 0 ? 'Over today’s amount by' : 'You can spend today', ds.left)}
              <div style={{ marginTop: 12 }}><Bar pct={pctOf(ds.spentToday, ds.allowance)} track="var(--glass)" fill={k} /></div>
              <span style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4, color: k }}>
                {fmt(ds.allowance)} for today: {fmt(s.left + ds.spentToday)} {half ? `left until ${shortDate(s.to)}` : 'left this week'} ÷ {ds.week.filter(x => x.active && !x.past).length} {ds.week.filter(x => x.active && !x.past).length === 1 ? 'spending day' : 'spending days'} left (today included).{ds.spentToday > 0 ? ` Spent ${fmt(ds.spentToday)} so far.` : ''}
              </span>
            </> : <>
              <span style={{ fontSize: 14, fontWeight: 600, color: k }}>Today isn’t a spending day</span>
              <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, color: ds.spentToday > 0 ? RED : k }}>{ds.spentToday > 0 ? `Spent ${fmt(ds.spentToday)} today` : 'Better not spend today'}</span>
              <span style={{ marginTop: 8, fontSize: 13, lineHeight: 1.4, color: k }}>
                {ds.next ? `Next spending day: ${dayLabel(ds.next.date, c)}, with ${fmt(ds.next.amount)}.` : (half ? `No more spending days until ${shortDate(s.to)}. It starts over on ${shortDate(addDays(s.to, 1))}.` : 'No more spending days this week. It starts over on Monday.')}
                {ds.spentToday > 0 ? ' What you spend today comes out of the days still to come.' : ''}
              </span>
            </>
          ) : view === 'week' ? <>
            {big(half ? (s.left < 0 ? `Over budget until ${shortDate(s.to)}` : `Left until ${shortDate(s.to)}`) : s.left < 0 ? 'Over budget this week' : 'Left this week', s.left)}
            <div style={{ marginTop: 12 }}><Bar pct={pctOf(s.spent, s.budget)} track="var(--glass)" fill={k} /></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={pill(k)}>Planned {fmt(s.weekly)}</span>
              <span style={pill(k)}>Spent {fmt(s.spent)}</span>
              <span style={pill(k)}>Moved {fmt(s.mIn - s.mOut, true)}</span>
              {s.carry !== 0 && <span style={pill(k)}>Carried {fmt(s.carry, true)}</span>}
            </div>
          </> : <>
            {big(ms.left < 0 ? `Over budget in ${monthName(c.month)}` : `Left in ${monthName(c.month)}`, ms.left)}
            <div style={{ marginTop: 12 }}><Bar pct={pctOf(ms.spent, ms.budget)} track="var(--glass)" fill={k} /></div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={pill(k)}>Planned {fmt(monthPlanOf(pk, c))}</span>
              <span style={pill(k)}>Spent {fmt(ms.spent)}</span>
              <span style={pill(k)}>Moved {fmt(ms.extra, true)}</span>
            </div>
            <span style={{ marginTop: 8, fontSize: 12.5, color: k }}>{half ? `${fmt(num(pk?.weeklyStr))} every 15 days × 2` : `${fmt(num(pk?.weeklyStr))} a week × ${c.weeks} weeks`}{ms.extra ? `, ${ms.extra > 0 ? 'plus' : 'minus'} ${fmt(Math.abs(ms.extra))} moved this month` : ''}.</span>
          </>}
        </div>

        {view === 'day' && <DayPlanner id={id} hue={s.hue} ds={ds} />}
        {view !== 'day' && <MovesCard id={id} />}

        <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '4px 16px' }}>
          {items.map((e, i) => (
            <SwipeRow key={e.key} kind="expense" id={e.key} back={{ name: 'pocket', id, view }}><div onClick={() => openSheet({ name: 'txn', kind: 'expense', id: e.key, back: { name: 'pocket', id, view } })} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '12px 0', borderBottom: `1px solid ${i === items.length - 1 ? 'transparent' : LINE}`, fontSize: 14, cursor: 'pointer' }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 600 }}>{e.note}</span>
                <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{e.meta}</span>
                {e.tagLine && <span className="tagline" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-accent-700)' }}>{e.tagLine}</span>}
              </span>
              <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{e.amtFmt}</span>
            </div></SwipeRow>
          ))}
          {items.length === 0 && <div style={{ padding: '14px 0', fontSize: 14, color: 'var(--color-neutral-700)' }}>{empty}</div>}
        </div>
        <button onClick={() => openSheet({ name: 'editPocket', id })} className="hv-n200" style={{ marginTop: 12, height: 44, borderRadius: 999, border: 0, background: 'transparent', color: TEXT, fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <I.Pencil size={15} />Edit pocket
        </button>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => openSheet({ name: 'move', id })} disabled={cantMove} className="hv-n200" style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: cantMove ? 0.45 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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
  const pk = d.pockets.find(x => x.id === id), half = isHalf(pk);
  const prevEnd = addDays(periodAt(pk, c.today)[0], -1), prevC = { ...c, today: prevEnd, weekStart: periodAt(pk, prevEnd)[0] };
  const nextOut = (m: Move) => !!m.next && moveInPeriod(m, pk, c);
  const nextIn = (m: Move) => !!m.next && !nextOut(m);
  const list = d.moves.filter(m => (m.to === id || m.from === id) && (moveMonth(m) === c.month || m.week === c.weekStart || (m.next && moveInPeriod(m, pk, prevC))))
    .sort((a, b) => moveTime(b) - moveTime(a) || (b.week > a.week ? 1 : -1));
  if (!list.length) return null;
  const nameOf = (x: string) => (x === COVER ? 'cover the shortfall' : d.pockets.find(p => p.id === x)?.name ?? d.goals.find(g => g.id === x)?.name ?? 'a deleted pocket');
  const incomeOf = (m: Move) => d.incomes.find(t => incomeMoves([m], t).length);
  const label = (m: Move) => m.next ? (nextOut(m) ? (half ? 'To next quincena' : 'To next week') : (half ? 'From last quincena' : 'From last week')) : m.to === id
    ? (m.from === '_income' ? `From income${incomeOf(m) ? ` · ${incomeOf(m)!.note}` : ''}` : `From ${nameOf(m.from)}`)
    : `To ${nameOf(m.to)}${d.goals.some(g => g.id === m.to) ? ' (goal)' : ''}`;
  const when = (m: Move) => {
    const t = moveTime(m), w = `week of ${shortDate(m.week)}`;
    return [t ? relDay(isoOf(t), c.today) : '', m.month ? `spread over ${m.spread ?? 1} week${(m.spread ?? 1) > 1 ? 's' : ''}` : w].filter(Boolean).join(' · ');
  };
  const isIn = (m: Move) => m.next ? nextIn(m) : m.to === id;
  const net = list.reduce((a, m) => a + (isIn(m) ? m.amt : -m.amt), 0);
  const save = (m: Move) => {
    const v = roundAmt(num(amt)), max = moveMax(d, m, c);
    if (v > max + 0.004) { flash(`The most this can be is ${fmt(max)}`); return; }
    setData(x => editMove(x, m.id, v)); setOpen(null); flash(v > 0 ? `Move changed to ${fmt(v)}` : 'Move undone');
  };
  const undo = (m: Move) => { setData(x => undoMove(x, m.id)); setOpen(null); flash(m.next ? `Undone · ${fmt(m.amt)} came back to this pocket` : `Undone · ${fmt(m.amt)} ${m.to === id ? `went back to ${m.from === '_income' ? 'your saved income' : nameOf(m.from)}` : `came back to this pocket`}`); };
  const undoAll = () => {
    if (!confirmAll) { setConfirmAll(true); return; }
    setData(x => list.reduce<Data>((acc, m) => ({ ...acc, ...undoMove(acc, m.id) }), x));
    setConfirmAll(false); flash(`${list.length === 1 ? '1 move' : `${list.length} moves`} undone`);
  };
  return (
    <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '12px 16px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Moves this month</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: net < 0 ? RED : 'oklch(0.45 0.11 150)' }}>{fmt(net, true)}</span>
      </div>
      <span style={{ display: 'block', marginTop: 2, fontSize: 12, color: 'var(--color-neutral-700)' }}>Tap a move to change it or undo it.</span>
      {list.map((m, i) => {
        const inn = isIn(m), isOpen = open === m.id;
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
                  <button onClick={() => save(m)} style={{ height: 46, padding: '0 16px', borderRadius: 16, border: 0, background: TEXT, color: 'var(--on-text)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                </div>
                <button onClick={() => undo(m)} style={{ height: 42, borderRadius: 999, border: 0, background: 'var(--color-accent-100)', color: 'var(--color-accent-800)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Undo this move</button>
                <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
                  {m.from === '_income' ? 'Undoing it takes the money out of this pocket; the income stays in your account, just not assigned to a pocket.'
                    : m.next ? (inn ? 'Undoing it takes the money back out of this pocket and returns it to the period it left.' : 'Undoing it brings the money back to this pocket.') : inn ? `Undoing it gives the money back to ${nameOf(m.from)}.` : `Undoing it brings the money back to this pocket${d.goals.some(g => g.id === m.to) ? ' and takes it off the goal' : ''}.`} Moves never change your account balances.
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
    <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '14px 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, padding: '0 4px' }}>
        <span style={{ fontSize: 15, fontWeight: 700 }}>Spending days</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Tap a day to turn it on or off</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${ds.week.length > 7 ? 8 : 7},minmax(0,1fr))`, gap: 4 }}>
        {ds.week.map(x => (
          <button key={x.date} onClick={() => toggle(x.wd)} aria-pressed={x.active} aria-label={`${DAY_NAMES[x.wd]}: ${x.active ? 'spending day' : 'no spending'}`}
            style={{ border: 0, borderRadius: 14, padding: '8px 0 7px', cursor: 'pointer', background: x.active ? tint(hue) : 'var(--color-neutral-100)', boxShadow: x.today ? `inset 0 0 0 2px ${k}` : 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: x.active ? k : 'var(--color-neutral-500)', opacity: x.past ? 0.6 : 1, minWidth: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 800 }}>{DAY_LETTERS[x.wd]}</span>
            {ds.week.length > 7 && <span style={{ fontSize: 10, fontWeight: 600, opacity: 0.75 }}>{Number(x.date.slice(8))}</span>}
            <span style={{ fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap' }}>{x.past ? (x.spent ? compactAmt(x.spent) : '–') : x.active ? compactAmt(x.amount) : '0'}</span>
          </button>
        ))}
      </div>
      <span style={{ padding: '0 4px', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
        {ds.week.length > 7 ? "The quincena's money is shared only by the days you turn on, and days that are off get nothing. Past days show what you spent; today and the days ahead show what each one gets. Whatever you don't spend today moves on to the next spending day." : "The week's money is shared only by the days you turn on, and days that are off get nothing. Past days show what you spent; today and the days ahead show what each one gets. Whatever you don't spend today moves on to the next spending day."}
      </span>
    </div>
  );
}
const startChip = (on: boolean, hue: number): CSSProperties => ({ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: on ? tint(hue) : 'var(--color-neutral-100)', color: on ? ink(hue) : TEXT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' });
/** 18.000 → 18k, 1.250.000 → 1,3M, for the small day tiles. */
const compactAmt = (n: number) => {
  const a = Math.abs(n), loc = isCOP() ? 'es-CO' : 'en-US';
  if (moneyHidden() && n) return '***';
  // Pesos have no cents; in $, € and £ small amounts keep them (0.60, 12.5).
  return a >= 1e6 ? `${(n / 1e6).toLocaleString(loc, { maximumFractionDigits: 1 })}M` : a >= 1e3 ? `${Math.round(n / 1e3)}k` : n.toLocaleString(loc, { maximumFractionDigits: isCOP() ? 0 : 2 });
};

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
          <div style={{ marginTop: 12 }}><Bar pct={pctOf(s.spent, s.budget)} track="var(--glass)" fill={k} /></div>
          <span style={{ marginTop: 8, fontSize: 13, color: k }}>{fmt(s.spent)} spent of {fmt(s.budget)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button onClick={() => openSheet({ name: 'move', id })} disabled={cantMove} className="hv-n200" style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: 'var(--surface)', color: TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer', opacity: cantMove ? 0.45 : 1 }}>Move leftover</button>
          <button onClick={closeSheet} style={{ flex: 1, height: 54, borderRadius: 999, border: 0, background: TEXT, color: 'var(--on-text)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>Done</button>
        </div>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Move leftover ---------------- */
/** Split what's left in a pocket this week among other pockets and goals. Only a transfer: no new money. */
export function MoveSheet({ id, to }: { id: string; to?: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const all = allStats(d, c), s = all.find(x => x.id === id);
  const others = all.filter(x => x.id !== id);
  const leftover = s ? Math.max(0, roundAmt(s.left)) : 0;
  const half = isHalf(d.pockets.find(p => p.id === id));
  const shortfall = Math.max(0, roundAmt(monthSummary(d, c).real));
  /** Everything to one place (for the shortfall, only as much as it needs). */
  const allTo = (key: string): Record<string, string> => {
    const v = key === COVER ? Math.min(leftover, shortfall) : leftover;
    return v > 0 ? { [key]: String(d.settings.currency === 'COP' ? Math.floor(v) : v) } : {};
  };
  const [parts, setParts] = useState<Record<string, string>>(() => (to ? allTo(to) : {}));
  if (!s) return null;
  const nums = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, roundAmt(num(v))]));
  const total = Object.values(nums).reduce((a, n) => a + n, 0);
  const remaining = roundAmt(leftover - total), tooMuch = remaining < -0.004;
  const patch = !tooMuch && total > 0 ? transferLeftover(d, c, id, nums) : null;
  const after = patch ? { ...d, ...patch } : d;
  const sumB = monthSummary(d, c), sumA = monthSummary(after, c);
  const weekLeftAfter = (pid: string) => pocketStats(after, pid, c)?.left ?? 0;
  const onlyNext = nums[NEXT] > 0 && Object.entries(nums).every(([k2, v]) => k2 === NEXT || !(v > 0));
  const k = ink(s.hue);
  const fill = (how: 'even' | 'budget' | 'clear') => {
    if (how === 'clear' || !others.length) return setParts({});
    const shares = largestRemainder(leftover, others.map(o => (how === 'budget' ? o.weekly : 1)), unitsFor(d.settings.currency));
    setParts(Object.fromEntries(others.map((o, i) => [o.id, shares[i] ? String(shares[i]) : ''])));
  };
  const confirm = () => {
    if (!patch) return;
    setData(x => transferLeftover(x, ctxOf(x), id, nums) ?? {});
    const n = Object.values(nums).filter(v => v > 0).length;
    closeSheet(); flash(n === 1 && nums[NEXT] > 0 ? (half ? `${fmt(total)} moves to ${s.name}'s next quincena` : `${fmt(total)} moves to ${s.name}'s next week`) : n === 1 && nums[COVER] > 0 ? `${fmt(total)} from ${s.name} now covers the shortfall` : `Moved ${fmt(total)} from ${s.name} to ${n === 1 ? (d.pockets.find(p => nums[p.id] > 0)?.name ?? d.goals.find(g => nums[g.id] > 0)?.name) : `${n} places`} · just for this week`);
  };
  const destRow = (key: string, name: string, hue: number, sub: string, st?: { initial: string; photoBg: string }) => (
    <div key={key} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 10px', padding: '8px 0', borderTop: `1px solid ${LINE}` }}>
      <button onClick={() => setParts(allTo(key))} disabled={!leftover} aria-label={`Move all to ${name}`} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, border: 0, background: 'transparent', padding: 0, margin: 0, color: TEXT, font: 'inherit', textAlign: 'left', cursor: leftover ? 'pointer' : 'default' }}>
        {st ? <PocketDot st={st} size={32} fs={15} bg={tint(hue)} color={ink(hue)} /> : <span style={{ width: 32, height: 32, borderRadius: 999, background: tint(hue), color: ink(hue), display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><I.Target size={15} /></span>}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{sub}</span>
        </span>
      </button>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, background: tint(hue), borderRadius: 14, padding: '8px 10px', width: 116, flex: 'none' }}>
        <span style={{ fontSize: 14, color: ink(hue) }}>{curSymbol()}</span>
        <MoneyInput value={parts[key] || ''} onChange={x => setParts(p0 => ({ ...p0, [key]: x }))} ariaLabel={`To ${name}`} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, color: ink(hue), padding: 0, outline: 'none', textAlign: 'right' }} />
      </div>
      <PctSlider amount={nums[key] || 0} total={leftover} max={Math.min(key === COVER ? shortfall : leftover, leftover - (total - (nums[key] || 0)))} hue={hue} label={`Percent for ${name}`} onChange={v => setParts(p0 => ({ ...p0, [key]: v > 0 ? String(v) : '' }))} />
    </div>
  );

  return (
    <SheetFrame title="Move leftover">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: tint(s.hue), borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: k }}>Left in {s.name} this week</span>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: k }}>{fmt(leftover)}</span>
          <span style={{ fontSize: 13, color: tooMuch ? RED : k }}>{tooMuch ? `That's ${fmt(-remaining)} more than ${s.name} has left.` : total > 0 ? `${fmt(total)} moves · ${fmt(remaining)} stays in ${s.name}` : 'Tap a pocket to move it all, or slide to choose a percent.'}</span>
        </div>

        <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '10px 12px 4px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingBottom: 8 }}>
            {[['Evenly', () => fill('even')], ['By budget', () => fill('budget')], ['Clear', () => fill('clear')]].map(([l, f]) => (
              <button key={l as string} onClick={f as () => void} disabled={!leftover || !others.length} className="hv-n200" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{l as string}</button>
            ))}
          </div>
          {destRow(NEXT, half ? 'Next quincena' : 'Next week', s.hue, half ? `${s.name} next quincena · only this once` : `${s.name} next week · only this once`, s)}
          {(sumB.real > 0.004 || nums[COVER] > 0) && destRow(COVER, 'Cover the shortfall', 25, `Shortfall: ${fmt(Math.max(0, sumB.real))} → ${fmt(Math.max(0, sumA.real))}`)}
          {others.map(o => destRow(o.id, o.name, o.hue, `Week: ${fmt(o.left)} → ${fmt(nums[o.id] ? weekLeftAfter(o.id) : o.left)} left`, o))}
          {d.goals.map(g => destRow(g.id, g.name, g.hue, `Goal: ${fmt(g.saved)} → ${fmt(g.saved + (nums[g.id] || 0))} of ${fmt(g.target)}`))}
          {others.length === 0 && d.goals.length === 0 && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '8px 0' }}>Create another pocket or a savings goal first.</span>}
        </div>

        <div aria-label="Move check" style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>{onlyNext ? 'Only moved in time' : nums[COVER] > 0 ? 'Only for this week' : 'Only a transfer for this week'}</span>
          <span style={{ lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{onlyNext ? `Nothing is created or lost: this money leaves ${s.name} now and is added to it when the next ${half ? 'quincena' : 'week'} starts. Your month income and plan stay the same.` : nums[COVER] > 0 ? <>Money given up to the shortfall leaves {s.name} for this week and stays in your account. Your month income and plan stay the same, and next Monday every pocket starts again from its own budget.</> : <>No new money is created: what {s.name} gives, the others get. Your month income and plan stay the same, and next Monday every pocket starts again from its own budget.</>}</span>
          {sumB.real > 0.004 && <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><span style={{ color: 'var(--color-neutral-700)' }}>Real shortfall</span><span style={{ whiteSpace: 'nowrap' }}>{fmt(Math.max(0, sumB.real))} → <b style={{ color: sumA.real > 0.004 ? RED : 'oklch(0.5 0.12 150)' }}>{fmt(Math.max(0, sumA.real))}</b></span></div>}
          {[['Month income', sumB.income, sumA.income], ['Month plan', sumB.plan, sumA.plan], ['All pockets this week', all.reduce((a, x) => a + x.budget, 0), allStats(after, c).reduce((a, x) => a + x.budget, 0)]].map(([l, b, a]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ color: 'var(--color-neutral-700)' }}>{l as string}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{fmt(b as number)} → <b>{fmt(a as number)}</b>{a === b ? ' ✓' : ''}</span>
            </div>
          ))}
          {d.goals.some(g => (nums[g.id] || 0) > 0) && <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>Money sent to a goal leaves the pockets and is saved there.</span>}
        </div>
        <PrimaryBtn onClick={confirm} disabled={!patch}>{total > 0 && !tooMuch ? `Move ${fmt(total)}` : 'Move'}</PrimaryBtn>
      </div>
    </SheetFrame>
  );
}

/* ---------------- Cover the shortfall with this week's leftovers ---------------- */
export function CoverSheet() {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const all = allStats(d, c), left = leftovers(d, c);
  const [parts, setParts] = useState<Record<string, string>>(() => Object.fromEntries(Object.entries(suggestCover(d, c)).map(([k, v]) => [k, String(v)])));
  const nums = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, roundAmt(num(v))]));
  const total = Object.values(nums).reduce((a, n) => a + n, 0);
  const patch = total > 0 ? coverWith(d, c, nums) : null;
  const before = monthSummary(d, c), after = patch ? monthSummary({ ...d, ...patch }, c) : before;
  const over = left.find(x => (nums[x.id] || 0) > x.left + 0.004);
  const confirm = () => {
    if (!patch) return;
    setData(x => coverWith(x, ctxOf(x), nums) ?? {});
    closeSheet(); flash(after.real > 0.004 ? `${fmt(total)} covered · ${fmt(after.real)} still short` : `Shortfall covered with ${fmt(total)} of leftovers`);
  };
  return (
    <SheetFrame title="Cover the shortfall">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: before.real > 0.004 ? 'var(--color-accent-100)' : 'oklch(0.95 0.045 155)', borderRadius: 24, padding: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: before.real > 0.004 ? 'var(--color-accent-800)' : 'oklch(0.42 0.09 155)' }}>Your pockets promise more than you have</span>
          <span style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.03em', color: before.real > 0.004 ? 'var(--color-accent-900)' : 'oklch(0.3 0.07 155)' }}>{fmt(Math.max(0, before.real))}</span>
          <span style={{ fontSize: 13, color: before.real > 0.004 ? 'var(--color-accent-800)' : 'oklch(0.42 0.09 155)' }}>{total > 0 ? <>After this: <b>{after.real > 0.004 ? `${fmt(after.real)} short` : 'covered ✓'}</b></> : 'Give up some of this week\'s leftovers to close it.'}</span>
        </div>
        <span style={{ margin: '12px 6px 0', fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Money you didn't spend this week stays in your account instead of being promised to the pocket. Only this week changes: next Monday every pocket starts again from its own budget.</span>
        <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: '10px 12px 4px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 8 }}>
            <button onClick={() => setParts(Object.fromEntries(Object.entries(suggestCover(d, c)).map(([k, v]) => [k, String(v)])))} className="hv-n200" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Just enough</button>
            <button onClick={() => setParts(Object.fromEntries(left.map(x => [x.id, String(x.left)])))} className="hv-n200" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>All leftovers</button>
            <button onClick={() => setParts({})} className="hv-n200" style={{ height: 32, padding: '0 12px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Clear</button>
          </div>
          {left.map(x => {
            const st = all.find(a => a.id === x.id)!;
            return (
              <div key={x.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${LINE}` }}>
                <PocketDot st={st} size={32} fs={15} bg={tint(st.hue)} color={ink(st.hue)} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.name}</span>
                  <span style={{ fontSize: 12, color: (nums[x.id] || 0) > x.left + 0.004 ? RED : 'var(--color-neutral-700)' }}>{fmt(x.left)} left this week{nums[x.id] ? ` → ${fmt(Math.max(0, x.left - nums[x.id]))}` : ''}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, background: tint(st.hue), borderRadius: 14, padding: '8px 10px', width: 116, flex: 'none' }}>
                  <span style={{ fontSize: 14, color: ink(st.hue) }}>{curSymbol()}</span>
                  <MoneyInput value={parts[x.id] || ''} onChange={v => setParts(p0 => ({ ...p0, [x.id]: v }))} ariaLabel={`From ${st.name}`} style={{ width: '100%', minWidth: 0, border: 0, background: 'transparent', fontSize: 16, fontWeight: 700, color: ink(st.hue), outline: 'none', padding: 0 }} />
                </div>
              </div>
            );
          })}
          {!left.length && <span style={{ fontSize: 13, color: 'var(--color-neutral-700)', padding: '8px 0 10px' }}>No pocket has money left this week.</span>}
        </div>
        {over && <span style={{ margin: '8px 6px 0', fontSize: 12.5, color: RED }}>That's more than {all.find(a => a.id === over.id)?.name} has left this week.</span>}
        <PrimaryBtn onClick={confirm} disabled={!patch}>{total > 0 && patch ? `Use ${fmt(total)} of leftovers` : 'Choose how much to use'}</PrimaryBtn>
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
  const [hue, setHue] = useState(base ? base.hue : HUES[d.pockets.length % HUES.length]);
  const [period, setPeriod] = useState<'week' | 'half'>(base?.period ?? 'week');
  const [startStr, setStartStr] = useState<string | null>(null);
  const [resetCarry, setResetCarry] = useState(false);
  const [carry, setCarry] = useState(!!base?.carry);
  const w = num(weekly), cant = !name.trim();
  const half = period === 'half';
  // Starting partway through a week or quincena: the first period only gets the days that are left.
  const c = ctxOf(d), [ps, pe] = periodAt({ period }, c.today);
  const spendDays = (a: string, b: string) => { let n = 0; for (let x = a; x <= b; x = addDays(x, 1)) if (days.includes(weekdayOf(x))) n++; return n; };
  const mid = isNew && c.today > ps;
  const suggested = roundAmt(w * spendDays(c.today, pe) / Math.max(1, spendDays(ps, pe)));
  const startAmt = startStr === null ? suggested : num(startStr);
  const switchPeriod = (v: 'week' | 'half') => {
    if (v === period) return;
    // Keep the same money per month: weekly × weeks = per 15 days × 2.
    if (w > 0) setWeekly(String(roundAmt(v === 'half' ? w * d.settings.weeks / 2 : w * 2 / d.settings.weeks)));
    setPeriod(v); setStartStr(null); setResetCarry(true);
  };
  const icon = photo ? '' : emoji || name.trim().charAt(0).toUpperCase() || '·';

  const save = () => {
    if (cant) return;
    const patch = { name: name.trim(), weeklyStr: String(w), emoji, photo, hue, days: days.length === 7 ? undefined : [...days].sort(), period: half ? 'half' as const : undefined, carry: carry ? (base?.carry && !resetCarry ? base.carry : periodAt({ period: half ? 'half' : undefined }, c.today)[0]) : undefined };
    const start = mid && Math.abs(startAmt - w) > 0.004 ? { from: ps, amt: Math.max(0, startAmt) } : undefined;
    if (isNew) { setData(x => ({ pockets: [...x.pockets, { id: uid('p'), ...patch, ...(start ? { start } : {}) }] })); closeSheet(); }
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'var(--surface)', borderRadius: 22, padding: 14 }}>
          <div style={{ width: 68, height: 68, borderRadius: 999, backgroundColor: tint(hue), position: 'relative', overflow: 'hidden', color: ink(hue), display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 32, flex: 'none' }}>{icon}<Fill src={photo} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
            <button onClick={() => pickPhoto().then(p => p && setPhoto(p))} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-neutral-200)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
              <I.Image size={14} />{photo ? 'Change image' : 'Upload image'}
            </button>
            {photo && <button onClick={() => setPhoto(null)} style={{ padding: '0 4px', border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Use emoji instead</button>}
          </div>
        </div>
        <FieldLabel m="14px 4px 6px">Color</FieldLabel>
        <HuePicker value={hue} onChange={setHue} label="Pocket color" />
        <FieldLabel m="14px 4px 6px">Emoji</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8,minmax(0,1fr))', gap: 4, background: 'var(--surface)', borderRadius: 22, padding: 8 }}>
          {EMOJIS.map(m => <button key={m} onClick={() => { setEmoji(m); setPhoto(null); }} style={{ aspectRatio: '1', borderRadius: 12, border: 0, background: !photo && emoji === m ? tint(hue) : 'transparent', fontSize: 20, cursor: 'pointer', padding: 0, transition: 'background .15s' }}>{m}</button>)}
        </div>
        <FieldLabel m="14px 4px 6px">Name</FieldLabel>
        <input value={name} placeholder="Gym" onChange={e => setName(e.target.value)} style={textInput} />
        <FieldLabel m="14px 4px 6px">Starts over</FieldLabel>
        <Segmented items={[['week', 'Every week'], ['half', 'Every 15 days']]} value={period} onPick={v => switchPeriod(v as 'week' | 'half')} />
        <span style={{ margin: '6px 4px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
          {half ? 'Every quincena: from the 1st to the 15th, and from the 16th to the end of the month.' : 'Every week, Monday to Sunday.'}
        </span>
        <FieldLabel m="14px 4px 6px">{half ? 'Budget for 15 days' : 'Weekly budget'}</FieldLabel>
        <SmallAmount value={weekly} onChange={v => { setWeekly(v); setStartStr(null); }} />
        <span style={{ margin: '8px 4px 0', fontSize: 13, color: 'var(--color-neutral-700)' }}>{half ? `${fmt(w * 2)} a month over 2 quincenas` : `${fmt(w * d.settings.weeks)} a month over ${d.settings.weeks} weeks`}</span>
        {mid && w > 0 && <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 22, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{half ? 'This quincena is already underway' : 'This week is already underway'}</span>
          <span style={{ fontSize: 13, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{half ? 'For this quincena only, it starts with:' : 'For this week only, it starts with:'}</span>
          <SmallAmount value={startStr ?? String(suggested)} onChange={setStartStr} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setStartStr(null)} aria-pressed={startStr === null} style={startChip(startStr === null, hue)}>Days left · {fmt(suggested)}</button>
            <button onClick={() => setStartStr(String(w))} aria-pressed={startStr !== null && num(startStr) === w} style={startChip(startStr !== null && num(startStr) === w, hue)}>Full amount · {fmt(w)}</button>
          </div>
          <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
            {half ? `Until ${shortDate(pe)}. From ${shortDate(addDays(pe, 1))} it gets the full ${fmt(w)}.` : `Until Sunday. From Monday it gets the full ${fmt(w)}.`} Type what you actually have left if it's different.
          </span>
        </div>}
        <FieldLabel m="14px 4px 6px">Spending days</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
          {DAY_LETTERS.map((l, wd) => {
            const on = days.includes(wd);
            return <button key={wd} aria-pressed={on} aria-label={DAY_NAMES[wd]} onClick={() => setDays(on ? (days.length > 1 ? days.filter(x => x !== wd) : days) : [...days, wd])}
              style={{ height: 42, borderRadius: 14, border: 0, background: on ? tint(hue) : 'var(--surface)', color: on ? ink(hue) : 'var(--color-neutral-500)', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>{l}</button>;
          })}
        </div>
        <span style={{ margin: '8px 4px 0', fontSize: 13, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>
          {days.length === 7 ? (half ? 'Every day. The Today view shares the quincena’s money across the days left.' : 'Every day. The Today view shares the week’s money across the days left.') : `Only ${days.slice().sort().map(x => DAY_NAMES[x]).join(', ')}${w > 0 ? `: about ${fmt(w / days.length)} each` : ''}. Other days show that you shouldn’t spend from this pocket.`}
        </span>
        <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 22, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{half ? 'Carry over to next quincena' : 'Carry over to next week'}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>What you don't spend is added to the next one, and overspending is taken from it.</span>
          </div>
          <Toggle on={carry} onChange={setCarry} label={half ? 'Carry over to next quincena' : 'Carry over to next week'} />
        </div>
        <PrimaryBtn onClick={save} disabled={cant} mt={18}>{isNew ? 'Create pocket' : 'Save changes'}</PrimaryBtn>
        {!isNew && <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete pocket'}</GhostDanger>}
      </div>
    </SheetFrame>
  );
}
