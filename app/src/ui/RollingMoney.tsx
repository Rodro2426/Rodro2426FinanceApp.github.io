// A money amount whose digits roll to the new value when it changes (the "money moves" moment on the
// safe-to-spend card). When it goes down, the amount spent lifts off the card for a moment.
// Quiet on the first render, for 1.5s after mounting (while saved data loads), while amounts are hidden,
// and with Reduce Motion (handled in styles.css).
import { useEffect, useRef, useState } from 'react';
import { fmt } from '../lib/derive';
import { moneyHidden } from '../lib/privacy';

const SR: React.CSSProperties = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

export function RollingMoney({ value }: { value: number }) {
  const text = fmt(value);
  const born = useRef(Date.now());
  const prev = useRef(value);
  const [spent, setSpent] = useState<{ key: number; text: string } | null>(null);
  const quiet = Date.now() - born.current < 1500 || moneyHidden();

  useEffect(() => {
    const before = prev.current;
    prev.current = value;
    if (before === value || Date.now() - born.current < 1500 || moneyHidden()) return;
    if (value < before) setSpent({ key: Date.now(), text: '−' + fmt(before - value).replace(/^[-−]/, '') });
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
      {spent && <span key={spent.key} className="spent-chip" aria-hidden="true" onAnimationEnd={() => setSpent(null)}>{spent.text}</span>}
    </>
  );
}
