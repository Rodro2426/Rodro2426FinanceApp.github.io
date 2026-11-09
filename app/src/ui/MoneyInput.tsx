import { STARS, moneyHidden } from '../lib/privacy';
import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
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

/**
 * iPhones set to Colombia or Europe show a comma as the decimal key. In dollars, euros or pounds the box
 * shows commas between thousands, so a comma just typed (one new character, and no decimal point yet)
 * is turned into the decimal point. Commas already shown between thousands are left alone.
 */
export function typedComma(prev: string, next: string, at: number, decimals: boolean) {
  if (!decimals || next.length !== prev.length + 1 || next[at - 1] !== ',' || next.includes('.')) return next;
  return next.slice(0, at - 1) + '.' + next.slice(at);
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
  const fresh = useRef(false); // just focused: the first mouseup must not clear the selection
  // With amounts hidden (the eye), a filled box shows ***** until you tap into it to edit.
  const [focused, setFocused] = useState(false);
  const masked = moneyHidden() && !focused && !!value;
  const shown = masked ? STARS : formatTyping(value);

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
      // Tapping a box selects the whole amount, so typing replaces it (no need to select and erase first).
      // iOS places the caret after focus, so the selection is made a moment later, and the mouseup that would undo it is skipped once.
      onFocus={e => { setFocused(true); fresh.current = true; const el = e.currentTarget; setTimeout(() => { if (document.activeElement === el) el.setSelectionRange(0, el.value.length); }, 0); }}
      onMouseUp={e => { if (fresh.current) { e.preventDefault(); fresh.current = false; } }}
      onBlur={() => { setFocused(false); fresh.current = false; }}
      onChange={e => {
        fresh.current = false;
        const at = e.target.selectionStart ?? e.target.value.length, g = sep().group;
        const t = typedComma(shown, e.target.value, at, sep().decimals);
        caret.current = t.slice(0, at).split('').filter(ch => ch !== g && /[\d.,]/.test(ch)).length;
        onChange(parseTyping(t));
      }}
      style={style} />
  );
}
