import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { getData } from '../lib/store';

/**
 * Amount box that shows thousands separators while you type (10.000.000 for COP,
 * 10,000.50 otherwise). `value` and `onChange` use a plain number string ("10000000").
 */
const sep = () => (getData().settings.currency === 'COP' ? { group: '.', dec: ',', decimals: false } : { group: ',', dec: '.', decimals: true });

export function formatTyping(raw: string) {
  const { group, dec, decimals } = sep();
  if (!raw) return '';
  const neg = raw.startsWith('-');
  const [int, frac] = raw.replace('-', '').split('.');
  const g = (int || '0').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return (neg ? '-' : '') + g + (decimals && frac !== undefined ? dec + frac : '');
}

/** Turns what was typed (with separators) back into a plain number string. */
function parseTyping(text: string) {
  const { group, dec, decimals } = sep();
  let s = text.split(group).join('');
  if (decimals) s = s.replace(dec, '.');
  s = s.replace(decimals ? /[^\d.]/g : /[^\d]/g, '');
  if (decimals) { const i = s.indexOf('.'); if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '').slice(0, 2); }
  return s.replace(/^0+(?=\d)/, '');
}

export function MoneyInput({ value, onChange, placeholder = '0', style, autoFocus, ariaLabel }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties; autoFocus?: boolean; ariaLabel?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null); // digits to the left of the caret after an edit
  const shown = formatTyping(value);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || caret.current == null || document.activeElement !== el) return;
    let digits = caret.current, pos = 0;
    while (pos < shown.length && digits > 0) { if (/[\d.,]/.test(shown[pos]) && shown[pos] !== sep().group) digits--; pos++; }
    el.setSelectionRange(pos, pos);
    caret.current = null;
  }, [shown]);

  return (
    <input ref={ref} type="text" inputMode={sep().decimals ? 'decimal' : 'numeric'} placeholder={placeholder} value={shown} autoFocus={autoFocus} aria-label={ariaLabel}
      onChange={e => {
        const t = e.target.value, at = e.target.selectionStart ?? t.length, g = sep().group;
        caret.current = t.slice(0, at).split('').filter(ch => ch !== g && /[\d.,]/.test(ch)).length;
        onChange(parseTyping(t));
      }}
      style={style} />
  );
}
