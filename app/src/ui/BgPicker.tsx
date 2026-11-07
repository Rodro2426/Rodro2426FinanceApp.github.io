// Profile > Appearance > Background color: preset swatches, the system color palette, or a typed hex code.
import { useEffect, useState } from 'react';
import { setData, useApp } from '../lib/store';
import { DEFAULT_BG, PRESETS, normHex, readable, type Mode } from '../lib/bg';

const currentMode = (): Mode => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light');

export function BgPicker() {
  const { data: d } = useApp();
  const mode = currentMode();
  const chosen = d.settings.bg?.[mode];
  const value = chosen ?? DEFAULT_BG[mode];
  const [hex, setHex] = useState(value.toUpperCase());
  useEffect(() => { setHex(value.toUpperCase()); }, [value]);
  const set = (c: string | undefined) => setData(x => {
    const bg = { ...(x.settings.bg ?? {}) };
    if (c && c !== DEFAULT_BG[mode]) bg[mode] = c; else delete bg[mode];
    return { settings: { ...x.settings, bg: bg.light || bg.dark ? bg : undefined } };
  });
  const typed = normHex(hex);
  const ok = readable(value, mode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8, background: 'var(--surface)', borderRadius: 20, padding: 14 }}>
      <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>Background color</span>
        <span style={{ fontSize: 12, color: 'var(--color-neutral-700)' }}>{mode === 'light' ? 'For light mode' : 'For dark mode'}</span>
      </span>
      <div role="radiogroup" aria-label="Background color presets" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))', gap: 8 }}>
        {PRESETS[mode].map(([c, name]) => {
          const on = value === c;
          return <button key={c} role="radio" aria-checked={on} aria-label={name} title={name} onClick={() => set(c)}
            style={{ aspectRatio: '1', width: '100%', borderRadius: 999, border: 0, background: c, cursor: 'pointer', padding: 0, boxShadow: on ? '0 0 0 2px var(--surface), 0 0 0 4px var(--color-text)' : 'inset 0 0 0 1px rgba(128,128,128,.35)' }} />;
        })}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* The system color palette (on iPhone it opens the iOS color picker). */}
        <label title="Pick any color" style={{ position: 'relative', width: 44, height: 44, flex: 'none', borderRadius: 999, cursor: 'pointer', background: 'conic-gradient(#f44, #fd4, #4d6, #4cf, #64f, #f4c, #f44)', boxShadow: 'inset 0 0 0 3px var(--surface)' }}>
          <input type="color" value={value} onChange={e => set(e.target.value)} aria-label="Pick any color" style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 0, padding: 0 }} />
        </label>
        <input value={hex} onChange={e => { setHex(e.target.value); const h = normHex(e.target.value); if (h) set(h); }} aria-label="Color code" placeholder="#F7F5F3" maxLength={7} spellCheck={false} autoCapitalize="characters"
          style={{ flex: 1, minWidth: 0, height: 44, borderRadius: 14, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-text)', padding: '0 14px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 16, letterSpacing: '0.04em', outline: typed || !hex ? 'none' : '2px solid var(--color-accent)' }} />
        <span aria-hidden="true" style={{ width: 44, height: 44, flex: 'none', borderRadius: 14, background: value, boxShadow: 'inset 0 0 0 1px rgba(128,128,128,.35)' }} />
      </div>
      {!typed && hex && <span style={{ fontSize: 12, color: 'var(--color-accent-700)' }}>Type a color code like #EEF0FB.</span>}
      {!ok && <span role="alert" style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-accent-700)' }}>{mode === 'light' ? 'Text may be hard to read on this color in light mode. Try a lighter one.' : 'Text may be hard to read on this color in dark mode. Try a darker one.'}</span>}
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Light and dark mode each keep their own color. Switch Appearance to set the other one.</span>
        {chosen && <button onClick={() => set(undefined)} style={{ border: 0, background: 'transparent', color: 'var(--color-accent-700)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 4, whiteSpace: 'nowrap' }}>Reset</button>}
      </span>
    </div>
  );
}
