// The eye: shows or hides every money amount in the app (they turn into $*****).
import { useApp } from '../lib/store';
import { moneyHidden, setMoneyHidden } from '../lib/privacy';

export const EyeIcon = ({ off, size = 19 }: { off: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {off ? <><path d="M10.7 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17.6 17.6 0 0 1-2.6 3.6" /><path d="M6.6 6.6A17.4 17.4 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /><path d="m3 3 18 18" /></>
      : <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>}
  </svg>
);

export function EyeToggle({ size = 44, tone }: { size?: number; tone?: string }) {
  useApp(); // re-draw when it changes
  const off = moneyHidden();
  return (
    <button onClick={() => setMoneyHidden(!off)} aria-label={off ? 'Show amounts' : 'Hide amounts'} aria-pressed={off} title={off ? 'Show amounts' : 'Hide amounts'} className={tone ? 'hv-w75' : 'hv-n200'}
      style={{ width: size, height: size, borderRadius: 999, background: tone ? 'var(--glass)' : 'var(--surface)', border: 0, color: tone ?? 'var(--color-text)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}>
      <EyeIcon off={off} size={Math.round(size * 0.43)} />
    </button>
  );
}
