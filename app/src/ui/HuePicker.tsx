// Color for a pocket or account. Colors are hues: the app turns each one into a soft background and a readable
// text color, in light and dark mode, so any choice stays easy to read.
import { ink, mid, tint } from '../lib/constants';

export const HUE_SWATCHES: [number, string][] = [
  [25, 'Red'], [50, 'Orange'], [80, 'Yellow'], [120, 'Lime'], [150, 'Green'], [175, 'Teal'],
  [200, 'Sky'], [230, 'Blue'], [260, 'Indigo'], [290, 'Purple'], [320, 'Pink'], [350, 'Rose']
];

export function HuePicker({ value, onChange, label = 'Color' }: { value: number; onChange: (h: number) => void; label?: string }) {
  const custom = !HUE_SWATCHES.some(([h]) => h === value);
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
      <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap' }}>{custom ? 'Custom' : 'Fine-tune'}</span>
        <input type="range" min={0} max={359} value={value} onChange={e => onChange(Number(e.target.value))} aria-label={`${label}: custom`}
          className="hue-range" style={{ flex: 1, minWidth: 0 }} />
        <span style={{ width: 28, height: 28, borderRadius: 10, background: tint(value), boxShadow: `inset 0 0 0 3px ${mid(value)}`, flex: 'none' }} />
      </label>
    </div>
  );
}
