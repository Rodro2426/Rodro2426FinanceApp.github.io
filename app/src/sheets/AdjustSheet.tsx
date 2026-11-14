// Adjust balance: type what the account really has, and the difference is saved as a transaction.
import { useState } from 'react';
import { useApp, setData, openSheet, flash } from '../lib/store';
import { TEXT } from '../lib/constants';
import { allStats, ctxOf, fmt, num, roundAmt } from '../lib/derive';
import { adjustBalance, adjustGap } from '../lib/adjust';
import { BigAmount, FieldLabel, PickChip, PrimaryBtn, Toggle, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';

export function AdjustSheet({ id }: { id: string }) {
  const { data: d } = useApp();
  const c = ctxOf(d);
  const a = d.accounts.find(x => x.id === id);
  const [real, setReal] = useState(a ? String(roundAmt(a.bal)) : '');
  const [pocket, setPocket] = useState('');
  const [toPockets, setToPockets] = useState(false);
  const [note, setNote] = useState('');
  if (!a) return <SheetFrame title="Adjust balance"><span style={{ fontSize: 14 }}>This account was deleted.</span></SheetFrame>;
  const card = a.type === 'card', typed = real.trim() !== '', v = roundAmt(num(real));
  const gap = typed ? adjustGap(d, id, v) : 0, spent = gap > 0.004, got = gap < -0.004;
  const pockets = allStats(d, c);
  const save = () => {
    const opts = a.notMine ? { note } : { pocket, toPockets, note };
    if (!adjustBalance(d, c, id, v, opts)) return;
    setData(x => adjustBalance(x, ctxOf(x), id, v, opts) ?? {});
    openSheet({ name: 'acct', id });
    flash(spent ? `${a.name} adjusted: ${fmt(gap)} counted as spent` : `${a.name} adjusted: ${fmt(-gap)} counted as income`);
  };
  const tone = spent ? { bg: 'var(--warn-bg)', ink: 'var(--warn-ink)' } : { bg: 'var(--ok-bg)', ink: 'var(--ok-ink)' };
  return (
    <SheetFrame title="Adjust balance">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ margin: '0 4px', fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>{card ? `Type what ${a.name} really owes now. Pockets has ${fmt(a.bal)}.` : `Type what ${a.name} really has now. Pockets has ${fmt(a.bal)}.`}</span>
        <BigAmount value={real} onChange={setReal} autoFocus mt={10} />
        {(spent || got) && (
          <div style={{ marginTop: 12, background: tone.bg, color: tone.ink, borderRadius: 20, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{spent ? 'Counts as spent' : 'Counts as money you got'}</span>
            <span style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{fmt(Math.abs(gap))}</span>
            <span style={{ fontSize: 12.5, lineHeight: 1.4 }}>{spent ? 'Saved as an expense dated today, so your spending and your pockets stay true.' : 'Saved as an income dated today.'}</span>
          </div>
        )}
        {a.notMine && (spent || got) && <span style={{ margin: '10px 4px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>This account isn't yours, so the difference is saved in its history but doesn't count in your spending or your pockets.</span>}
        {spent && !a.notMine && <>
          <FieldLabel>Take it from a pocket</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pockets.map(x => <PickChip key={x.id} st={x} on={x.id === pocket} hue={x.hue} onClick={() => setPocket(x.id)} />)}
            <button onClick={() => setPocket('')} aria-pressed={pocket === ''} style={{ height: 44, padding: '0 14px', borderRadius: 999, border: pocket === '' ? `2px solid ${TEXT}` : '2px dashed var(--color-neutral-300)', background: pocket === '' ? TEXT : 'transparent', color: pocket === '' ? 'var(--on-text)' : TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>No pocket</button>
          </div>
          <span style={{ margin: '8px 4px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{pocket ? `${pockets.find(x => x.id === pocket)?.name} will have ${fmt(gap)} less left.` : 'With no pocket it still counts as spent this month, but no pocket goes down.'}</span>
        </>}
        {got && !a.notMine && (
          <div style={{ marginTop: 12, background: 'var(--surface)', borderRadius: 20, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, fontWeight: 600 }}>Share it into my pockets</span>
              <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{toPockets ? 'Split between your pockets for this week, by their budgets.' : 'Off: it stays in the account as extra money.'}</span>
            </span>
            <Toggle on={toPockets} onChange={setToPockets} label="Share it into my pockets" />
          </div>
        )}
        {(spent || got) && <>
          <FieldLabel>Note (optional)</FieldLabel>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Balance adjustment" aria-label="Note" style={textInput} />
        </>}
        <PrimaryBtn onClick={save} disabled={!spent && !got}>{spent || got ? `Set ${a.name} to ${fmt(v)}` : 'Type the real balance'}</PrimaryBtn>
        <button onClick={() => openSheet({ name: 'editAcct', id })} style={{ marginTop: 10, border: 0, background: 'transparent', color: 'var(--color-neutral-700)', fontSize: 13, fontWeight: 600, cursor: 'pointer', padding: 8 }}>Only fix the number, with no transaction</button>
      </div>
    </SheetFrame>
  );
}
