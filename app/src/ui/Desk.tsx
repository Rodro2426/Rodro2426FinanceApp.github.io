// The website: on a computer-sized screen the app gets a slim top bar and one calm reading column
// ("Tu semana" in .impeccable/surfaces/app-src-ui-desk-tsx.md). Details open in a side panel on the right.
import { moneyHidden, setMoneyHidden } from '../lib/privacy';
import { EyeIcon } from './EyeToggle';
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { openSheet, setUI, useApp } from '../lib/store';
import { syncLabel, useSync } from '../sheets/CloudSheet';
import { useSocial } from '../screens/Social';
import { hasUnread } from '../lib/social';
import type { Tab } from '../lib/types';
import * as I from './icons';
import { Fill } from './bits';

const MQ = '(min-width: 1024px) and (min-height: 560px)';
const mq = typeof window !== 'undefined' ? window.matchMedia(MQ) : null;
/** True on a laptop or desktop browser window (wide enough for the sidebar layout). */
export const useDesk = () => useSyncExternalStore(cb => { mq?.addEventListener('change', cb); return () => mq?.removeEventListener('change', cb); }, () => !!mq?.matches, () => false);

const People = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16.5 14.6c2.6.2 4.5 1.9 5 4.9" /></svg>
);

export function TopBar({ tabs }: { tabs: [Tab, string, (p: { size?: number; sw?: number }) => ReactNode][] }) {
  const { data: d, ui } = useApp();
  const sync = useSync();
  const so = useSocial();
  const unread = d.notifications.filter(n => !n.read && !n.dismissed).length;
  const chat = so.trips.some(t => hasUnread(t.id)) || so.dms.some(t => hasUnread(t.key));
  const photo = d.settings.profilePhoto;
  const onPage = (p: string) => ui.page === p || (p === 'social' && /^(trip|tripstats|tripchat|dm):/.test(ui.page ?? '')) || (p === 'reports' && !!ui.page?.startsWith('report:'));
  const [more, setMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const moreOn = ['investments', 'social', 'categories', 'reports'].some(onPage);

  // The "More" menu closes on a click outside or Escape; Cmd/Ctrl+K opens search from anywhere.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSheet({ name: 'search' }); }
      if (e.key === 'Escape') setMore(false);
    };
    const down = (e: PointerEvent) => { if (!moreRef.current?.contains(e.target as Node)) setMore(false); };
    window.addEventListener('keydown', key);
    document.addEventListener('pointerdown', down);
    return () => { window.removeEventListener('keydown', key); document.removeEventListener('pointerdown', down); };
  }, []);

  const go = (page: string) => { setMore(false); setUI({ page: page as never, sheet: null }); };
  const moreItem = (page: string, label: string, icon: ReactNode, dot?: boolean) => (
    <button key={page} role="menuitem" onClick={() => go(page)} className={'top-more-item' + (onPage(page) ? ' on' : '')}>
      <span className="top-more-ico">{icon}</span><span style={{ flex: 1 }}>{label}</span>
      {dot && <span className="top-dot" aria-label="New messages" />}
    </button>
  );

  return (
    <header className="topbar" aria-label="Pockets">
      <div className="topbar-in">
        <button className="top-brand" onClick={() => setUI({ tab: 'home', page: null, sheet: null })} aria-label="Pockets, home">
          <img src="./pockets-mark.svg" alt="" width={26} height={32} />
          <span className="wordmark">Pockets</span>
        </button>
        <nav className="top-tabs" aria-label="Sections">
          {tabs.map(([k, label]) => {
            const on = ui.tab === k && !ui.page;
            return <button key={k} data-tour={`tab-${k}`} onClick={() => setUI({ tab: k, page: null })} aria-current={on ? 'page' : undefined} className={'top-tab' + (on ? ' on' : '')}>{label}</button>;
          })}
          <div ref={moreRef} className="top-more-wrap">
            <button onClick={() => setMore(m => !m)} aria-expanded={more} aria-haspopup="menu" className={'top-tab' + (moreOn ? ' on' : '')}>
              More{chat && <span className="top-dot" aria-hidden="true" />}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: more ? 'rotate(180deg)' : 'none', transition: 'transform .2s var(--ease-out)' }}><path d="m6 9 6 6 6-6" /></svg>
            </button>
            {more && <div role="menu" className="top-more">
              {moreItem('investments', 'Investments', <I.TrendUp size={18} />)}
              {moreItem('social', 'Friends & trips', <People size={18} />, chat)}
              {moreItem('categories', 'Categories', <I.Target size={18} />)}
              {moreItem('reports', 'Reports', <I.Chart size={18} />)}
            </div>}
          </div>
        </nav>
        <div className="top-tools">
          <button onClick={() => openSheet({ name: 'search' })} className="top-search" aria-label="Search transactions">
            <I.Search size={17} /><span>Search</span><kbd>⌘K</kbd>
          </button>
          <button onClick={() => setMoneyHidden(!moneyHidden())} className="top-icon" aria-label={moneyHidden() ? 'Show amounts' : 'Hide amounts'} aria-pressed={moneyHidden()} title={moneyHidden() ? 'Show amounts' : 'Hide amounts'}><EyeIcon off={moneyHidden()} /></button>
          <button data-tour="bell" onClick={() => openSheet({ name: 'notifications' })} className="top-icon" aria-label={unread ? `Notifications, ${unread} new` : 'Notifications'}>
            <I.Bell size={19} />{unread > 0 && <span className="top-badge">{unread}</span>}
          </button>
          <button data-tour="add" onClick={() => openSheet({ name: 'add' })} className="top-add hv-acc600"><I.Plus size={18} sw={2.6} /> Add</button>
          <button data-tour="profile" onClick={() => openSheet({ name: 'settings' })} className="top-avatar" aria-label="Profile and settings" title={sync.uid ? syncLabel(sync) : 'Profile and settings'}>
            {photo ? <Fill src={photo} /> : (d.settings.name.trim().charAt(0).toUpperCase() || 'P')}
          </button>
        </div>
      </div>
    </header>
  );
}
