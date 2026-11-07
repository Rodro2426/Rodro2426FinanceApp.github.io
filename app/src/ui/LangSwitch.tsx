// English / Español switch for the welcome screens (the same choice is in Profile).
import { getLang, setLang, type Lang } from '../lib/i18n';

export function LangSwitch({ color = '#232e7a' }: { color?: string }) {
  const cur = getLang();
  const b = (l: Lang, label: string) => (
    <button key={l} onClick={() => l !== cur && setLang(l)} aria-pressed={l === cur} translate="no"
      style={{ border: 0, background: l === cur ? color : 'transparent', color: l === cur ? '#fff' : color, borderRadius: 999, height: 30, padding: '0 12px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  );
  return <div role="group" aria-label="Language" style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 999, background: 'rgba(255,255,255,.6)' }}>{b('en', 'English')}{b('es', 'Español')}</div>;
}
