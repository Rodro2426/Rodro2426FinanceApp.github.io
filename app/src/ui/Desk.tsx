// The website: on a computer-sized screen the same app gets a sidebar with the Pockets brand and a wide main area.
import { useSyncExternalStore, type ReactNode } from 'react';
import { openSheet, setUI, useApp } from '../lib/store';
import { syncLabel, useSync } from '../sheets/CloudSheet';
import { useSocial } from '../screens/Social';
import { hasUnread } from '../lib/social';
import type { Tab } from '../lib/types';
import * as I from './icons';

const MQ = '(min-width: 1024px) and (min-height: 560px)';
const mq = typeof window !== 'undefined' ? window.matchMedia(MQ) : null;
/** True on a laptop or desktop browser window (wide enough for the sidebar layout). */
export const useDesk = () => useSyncExternalStore(cb => { mq?.addEventListener('change', cb); return () => mq?.removeEventListener('change', cb); }, () => !!mq?.matches, () => false);

const People = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.6c2.6.2 4.5 1.9 5 4.9" /></svg>
);

export function Sidebar({ tabs }: { tabs: [Tab, string, (p: { size?: number; sw?: number }) => ReactNode][] }) {
  const { data: d, ui } = useApp();
  const sync = useSync();
  const so = useSocial();
  const unread = d.notifications.filter(n => !n.read && !n.dismissed).length;
  const chat = so.trips.some(t => hasUnread(t.id)) || so.dms.some(t => hasUnread(t.key));
  const photo = d.settings.profilePhoto;
  const onPage = (p: string) => ui.page === p || (p === 'social' && /^(trip|tripstats|tripchat|dm):/.test(ui.page ?? ''));

  const item = (key: string, label: string, icon: ReactNode, on: boolean, onClick: () => void, badge?: ReactNode) => (
    <button key={key} onClick={onClick} aria-current={on ? 'page' : undefined} className={on ? '' : 'hv-n200'}
      style={{ height: 44, borderRadius: 14, border: 0, background: on ? 'var(--color-accent-100)' : 'transparent', color: on ? 'var(--color-accent-700)' : 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', fontSize: 15, fontWeight: on ? 700 : 600, cursor: 'pointer', textAlign: 'left', width: '100%' }}>
      <span style={{ width: 22, display: 'flex', justifyContent: 'center', color: on ? 'var(--color-accent-700)' : 'var(--color-neutral-700)' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge}
    </button>
  );

  return (
    <aside className="desk-side" aria-label="Pockets">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 10px 18px' }}>
        <img src="./pockets-mark.svg" alt="" width={34} height={41} />
        <span className="wordmark" style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.035em' }}>Pockets</span>
      </div>

      <button onClick={() => openSheet({ name: 'add' })} className="hv-acc600" style={{ height: 48, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 18, boxShadow: '0 8px 20px color-mix(in srgb,var(--color-accent) 30%,transparent)' }}>
        <I.Plus size={20} sw={2.5} /> Add expense
      </button>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tabs.map(([k, label, Icon]) => item(k, label, <Icon size={20} sw={2} />, ui.tab === k && !ui.page, () => setUI({ tab: k, page: null })))}
      </nav>
      <span style={{ margin: '18px 12px 6px', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--color-neutral-600)' }}>More</span>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {item('inv', 'Investments', <I.TrendUp size={19} />, onPage('investments'), () => setUI({ page: 'investments' }))}
        {item('social', 'Trips and friends', <People />, onPage('social'), () => setUI({ page: 'social' }), chat ? <span aria-label="New messages" style={{ width: 8, height: 8, borderRadius: 99, background: 'var(--color-accent)' }} /> : null)}
        {item('search', 'Search', <I.Search size={19} />, false, () => openSheet({ name: 'search' }))}
        {item('notif', 'Notifications', <I.Bell size={19} />, false, () => openSheet({ name: 'notifications' }), unread ? <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: 'var(--color-accent)', color: '#fff', fontSize: 11.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{unread > 9 ? '9+' : unread}</span> : null)}
      </nav>

      <div style={{ flex: 1 }} />
      <button onClick={() => openSheet({ name: 'settings' })} className="hv-n200" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 16, border: 0, background: 'transparent', color: 'var(--color-text)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
        <span style={{ width: 40, height: 40, borderRadius: 999, background: 'var(--color-accent-200)', color: 'var(--color-accent-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, overflow: 'hidden', flex: 'none' }}>
          {photo ? <span style={{ width: '100%', height: '100%', backgroundImage: `url(${photo})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /> : (d.settings.name.trim().charAt(0).toUpperCase() || 'P')}
        </span>
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.settings.name}</span>
          <span style={{ fontSize: 12, color: 'var(--color-neutral-700)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sync.uid ? `☁︎ ${syncLabel(sync)}` : 'Profile and settings'}</span>
        </span>
      </button>
    </aside>
  );
}
