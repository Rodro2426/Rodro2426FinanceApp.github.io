// Color for a pocket, account or goal: ready-made colors that adapt to light/dark mode, or any exact color from
// the system color palette or a typed code (#RRGGBB), like Profile > Appearance > Background color.
import { useEffect, useState } from 'react';
import { colorFromHex, hexOfColor, ink, isCustomColor, mid, textOn, tint } from '../lib/constants';
import { normHex } from '../lib/bg';

export const HUE_SWATCHES: [number, string][] = [
  [25, 'Red'], [50, 'Orange'], [80, 'Yellow'], [120, 'Lime'], [150, 'Green'], [175, 'Teal'],
  [200, 'Sky'], [230, 'Blue'], [260, 'Indigo'], [290, 'Purple'], [320, 'Pink'], [350, 'Rose']
];

/** The color as a #rrggbb code, for the palette and the code box (a ready-made color shows its current look). */
function hexOf(value: number): string {
  if (isCustomColor(value)) return hexOfColor(value);
  try {
    const c = document.createElement('canvas'); c.width = c.height = 1;
    const g = c.getContext('2d')!;
    const probe = document.createElement('span'); probe.style.color = tint(value); document.body.appendChild(probe);
    g.fillStyle = getComputedStyle(probe).color; probe.remove();
    g.fillRect(0, 0, 1, 1);
    const [r, gg, b] = g.getImageData(0, 0, 1, 1).data;
    return '#' + [r, gg, b].map(x => x.toString(16).padStart(2, '0')).join('');
  } catch { return '#cccccc'; }
}

export function HuePicker({ value, onChange, label = 'Color' }: { value: number; onChange: (h: number) => void; label?: string }) {
  const custom = isCustomColor(value);
  const hex = hexOf(value);
  const [code, setCode] = useState(custom ? hex.toUpperCase() : '');
  useEffect(() => { setCode(custom ? hexOfColor(value).toUpperCase() : ''); }, [value, custom]);
  const typed = normHex(code);
  const pick = (h: string) => { const n = normHex(h); if (n) onChange(colorFromHex(n)); };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', borderRadius: 22, padding: 12 }}>
      <div role="radiogroup" aria-label={label} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
        {HUE_SWATCHES.map(([h, name]) => {
          const on = value === h;
          return (
            <button key={h} role="radio" aria-checked={on} aria-label={name} title={name} onClick={() => onChange(h)}
              style={{ height: 40, borderRadius: 14, border: 0, background: tint(h), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: on ? `0 0 0 2px var(--surface), 0 0 0 4px ${ink(h)}` : 'none' }}>
              <span style={{ width: 16, height: 16, borderRadius: 99, background: mid(h) }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* The system color palette (on iPhone it opens the iOS color picker). */}
        <label title="Pick any color" style={{ position: 'relative', width: 44, height: 44, flex: 'none', borderRadius: 999, cursor: 'pointer', background: 'conic-gradient(#f44, #fd4, #4d6, #4cf, #64f, #f4c, #f44)', boxShadow: custom ? '0 0 0 2px var(--surface), 0 0 0 4px var(--color-text), inset 0 0 0 3px var(--surface)' : 'inset 0 0 0 3px var(--surface)' }}>
          <input type="color" value={hex} onChange={e => pick(e.target.value)} aria-label={`${label}: pick any color`} style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0, padding: 0 }} />
        </label>
        <input value={code} onChange={e => { setCode(e.target.value); pick(e.target.value); }} aria-label={`${label}: color code`} placeholder={hex.toUpperCase()} maxLength={7} spellCheck={false} autoCapitalize="characters"
          style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 14, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-text)', padding: '0 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16, letterSpacing: '0.04em', outline: typed || !code ? 'none' : '2px solid var(--color-accent)' }} />
        <span aria-hidden="true" style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: tint(value), color: custom ? textOn(hex) : ink(value), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, boxShadow: 'inset 0 0 0 1px rgba(128,128,128,.3)' }}>Aa</span>
      </div>
      {!typed && code && <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>Type a color code like #FF5A5F.</span>}
      <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{custom ? 'Your own color looks the same in light and dark mode; the text turns white or dark so it stays readable.' : 'These colors adjust to light and dark mode. Use the palette or type a code for an exact color.'}</span>
    </div>
  );
}
