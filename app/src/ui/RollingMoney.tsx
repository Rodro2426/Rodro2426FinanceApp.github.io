// "La plata se mueve": the safe-to-spend amount's digits roll to the new value when it changes, and the
// amount that moved lifts off the card for a moment (−$18.000 for an expense, +$50.000 for an income).
//
// The change is held back while a sheet is open (the expense or income you're adding covers the card) and
// plays a beat after the sheet has dropped away, so you actually see it. `useSettled` does that holding;
// the card uses it for the number and the bar, so both move together.
// Quiet on the first render, for 1.5s after mounting (while saved data loads), while amounts are hidden,
// and with Reduce Motion (handled in styles.css).
import { useEffect, useRef, useState } from 'react';
import { fmt } from '../lib/derive';
import { moneyHidden } from '../lib/privacy';
import { useApp } from '../lib/store';

/** How long after a sheet starts closing before the card shows the change (the close takes 220ms). */
const AFTER_SHEET = 420;

const SR: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/** The value to show: follows `value`, but waits while a sheet is open and for a beat after it closes. */
export function useSettled<T>(value: T): T {
  const { ui } = useApp();
  const open = !!ui.sheet;
  const [shown, setShown] = useState(value);
  const closedAt = useRef(0);
  const wasOpen = useRef(open);
  if (wasOpen.current && !open) closedAt.current = Date.now();
  wasOpen.current = open;

  useEffect(() => {
    if (Object.is(value, shown) || open) return;
    const wait = Math.max(0, AFTER_SHEET - (Date.now() - closedAt.current));
    if (!wait) { setShown(value); return; }
    const t = setTimeout(() => setShown(value), wait);
    return () => clearTimeout(t);
  }, [value, open, shown]);
  return shown;
}

export function RollingMoney({ value }: { value: number }) {
  const text = fmt(value);
  const born = useRef(Date.now());
  const prev = useRef(value);
  const [moved, setMoved] = useState<{ key: number; text: string } | null>(null);
  const quiet = Date.now() - born.current < 1500 || moneyHidden();

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === value || Date.now() - born.current < 1500 || moneyHidden()) return;
    const diff = fmt(Math.abs(before - value)).replace(/^[-−]/, '');
    setMoved({ key: Date.now(), text: (value < before ? '−' : '+') + diff });
  }, [value]);

  // Digits are keyed by their place from the right, so 1.000.000 → 999.000 keeps the columns lined up.
  const chars = text.split('');
  const n = chars.length;
  return (
    <>
      <span className={'roll' + (quiet ? ' still' : '')} aria-hidden="true">
        {chars.map((ch, i) => {
          const place = n - i;
          if (!/\d/.test(ch)) return <span key={'c' + place + ch}>{ch}</span>;
          return (
            <span key={'d' + place} className="roll-d">
              <span style={{ transform: `translateY(${-1.05 * Number(ch)}em)` }}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(k => <i key={k}>{k}</i>)}
              </span>
            </span>
          );
        })}
      </span>
      <span style={SR}>{text}</span>
      {moved && <span key={moved.key} className="spent-chip" aria-hidden="true" onAnimationEnd={() => setMoved(null)}>{moved.text}</span>}
    </>
  );
}
