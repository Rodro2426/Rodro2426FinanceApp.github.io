import { useEffect, useRef, type ReactNode } from 'react';
import { useApp, setUI, openSheet, setData, getData } from './lib/store';
import { runSchedule, trmNeeded } from './lib/schedule';
import { ensureTrm } from './lib/trm';
import { runInterest } from './lib/interest';
import type { Data } from './lib/types';

/** Interest first (it uses yesterday's balance), then scheduled items and notifications. */
function runAutomations(d: Data) {
  const a = runInterest(d), d1 = a ? { ...d, ...a } : d;
  const b = runSchedule(d1);
  return a || b ? { ...(a || {}), ...(b || {}) } : null;
}
import { todayISO } from './lib/dates';
import type { Sheet, Tab } from './lib/types';
import Home from './screens/Home';
import Accounts from './screens/Accounts';
import Budget from './screens/Budget';
import Insights from './screens/Insights';
import CalendarScreen from './screens/Calendar';
import Investments from './screens/Investments';
import { HoldingSheet, PriceSettingsSheet, TradeSheet } from './sheets/InvestSheets';
import { BackupNowButton, NOTIF_TONE, NotifIcon, NotificationsSheet, ScheduleSheet } from './sheets/ScheduleSheets';
import { CropperHost } from './ui/Cropper';
import { AddSheet, EditPocketSheet, MoveSheet, PocketSheet, SavedSheet, SearchSheet } from './sheets/PocketSheets';
import { AcctSheet, AddAcctSheet, EditAcctSheet, ExportSheet, GoalSheet, NewGoalSheet, PaySheet, SettingsSheet } from './sheets/MoneySheets';
import * as I from './ui/icons';

const TABS: [Tab, string, (p: { size?: number; sw?: number }) => ReactNode][] = [
  ['home', 'Home', I.Home], ['accounts', 'Accounts', I.Card], ['budget', 'Budget', I.Wallet], ['insights', 'Insights', I.Chart], ['calendar', 'Calendar', I.Calendar]
];

function SheetRouter({ sheet }: { sheet: Sheet }) {
  switch (sheet.name) {
    case 'search': return <SearchSheet tag={sheet.tag} />;
    case 'add': return <AddSheet pocket={sheet.pocket} />;
    case 'pocket': return <PocketSheet id={sheet.id} />;
    case 'saved': return <SavedSheet id={sheet.id} />;
    case 'move': return <MoveSheet id={sheet.id} to={sheet.to} />;
    case 'editPocket': return <EditPocketSheet id={sheet.id} />;
    case 'export': return <ExportSheet acct={sheet.acct} />;
    case 'acct': return <AcctSheet id={sheet.id} />;
    case 'editAcct': return <EditAcctSheet id={sheet.id} />;
    case 'addAcct': return <AddAcctSheet />;
    case 'pay': return <PaySheet id={sheet.id} />;
    case 'goal': return <GoalSheet id={sheet.id} />;
    case 'newGoal': return <NewGoalSheet />;
    case 'settings': return <SettingsSheet />;
    case 'schedule': return <ScheduleSheet id={sheet.id} day={sheet.day} kind={sheet.kind} />;
    case 'notifications': return <NotificationsSheet />;
    case 'trade': return <TradeSheet ticker={sheet.ticker} side={sheet.side} />;
    case 'holding': return <HoldingSheet ticker={sheet.ticker} />;
    case 'priceSettings': return <PriceSettingsSheet />;
  }
}

export default function App() {
  const { ui, data } = useApp();
  const scroll = useRef<HTMLDivElement>(null);
  const brand = useRef<HTMLDivElement>(null);
  // Pull down at the top (iPhone rubber-band) to reveal the logo behind the content.
  const onScroll = () => {
    const el = scroll.current, b = brand.current;
    if (!el || !b) return;
    const pull = Math.max(0, -el.scrollTop), t = Math.min(1, Math.max(0, (pull - 14) / 70));
    b.style.opacity = String(t);
    b.style.transform = `translateY(${Math.min(0, pull * 0.45 - 40)}px) scale(${0.86 + 0.14 * t})`;
  };

  // Run scheduled income/bills and build notifications whenever data changes,
  // when the app comes back to the foreground, and once a minute (to catch midnight).
  useEffect(() => { ensureTrm(trmNeeded(data)); const p = runAutomations(data); if (p) setData(p); }, [data]);
  useEffect(() => {
    const tick = () => { if (document.visibilityState === 'visible') { const p = runAutomations(getData()); if (p) setData(p); } };
    document.addEventListener('visibilitychange', tick);
    const t = setInterval(tick, 60000);
    return () => { document.removeEventListener('visibilitychange', tick); clearInterval(t); };
  }, []);

  // Today's newest notification shows as a banner at the top until dismissed or it times out.
  const banner = data.notifications.find(n => n.date === todayISO() && !n.dismissed && !n.bannered);
  useEffect(() => {
    if (!banner || banner.kind === 'backup') return;
    const t = setTimeout(() => setData(x => ({ notifications: x.notifications.map(n => (n.id === banner.id ? { ...n, bannered: true } : n)) })), 7000);
    return () => clearTimeout(t);
  }, [banner?.id]);
  const patchNotif = (id: string, p: { dismissed?: boolean; bannered?: boolean }) => setData(x => ({ notifications: x.notifications.map(n => (n.id === id ? { ...n, ...p } : n)) }));

  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); if (ui.page) setUI({ page: null }); }, [ui.tab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUI({ sheet: null }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <div ref={brand} className="brand-reveal" aria-hidden="true">
        <img src="./pockets-mark.svg" alt="" width={50} height={57} />
        <span>Pockets</span>
      </div>
      <div ref={scroll} onScroll={onScroll} className="noscroll scroller" style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
        <div className="scroll-body" style={{ padding: `var(--top) 18px calc(var(--tb) + 100px)`, boxSizing: 'border-box' }}>
        {ui.tab === 'home' && <Home />}
        {ui.tab === 'accounts' && <Accounts />}
        {ui.tab === 'budget' && <Budget />}
        {ui.tab === 'insights' && <Insights />}
        {ui.tab === 'calendar' && <CalendarScreen />}
        </div>
      </div>

      {ui.toast && (
        <div role="status" style={{ position: 'absolute', left: 18, right: 18, bottom: 'calc(var(--tb) + 82px)', zIndex: 30, background: 'var(--color-text)', color: '#fff', padding: '14px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
          <I.Check size={16} sw={2.5} />
          <span>{ui.toast}</span>
        </div>
      )}

      {banner && !ui.sheet && (
        <div className="banner" role="alert" onClick={() => { patchNotif(banner.id, { bannered: true }); openSheet({ name: 'notifications' }); }}
          style={{ position: 'absolute', left: 12, right: 12, top: 'calc(var(--top) - 10px)', zIndex: 35, background: 'rgba(255,255,255,.96)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 22, padding: '12px 10px 12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(45,43,43,.18),0 0 0 1px rgba(45,43,43,.05)', cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: NOTIF_TONE[banner.kind].bg, color: NOTIF_TONE[banner.kind].fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><NotifIcon kind={banner.kind} /></div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{banner.title}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', lineHeight: 1.3 }}>{banner.body}</span>
            {banner.kind === 'backup' && <BackupNowButton id={banner.id} />}
          </div>
          <button onClick={e => { e.stopPropagation(); patchNotif(banner.id, { dismissed: true }); }} aria-label="Dismiss notification" style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.X size={14} /></button>
        </div>
      )}

      <div className="tabbar" style={{ position: 'absolute', left: 14, right: 14, bottom: 'var(--tb)', zIndex: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <nav style={{ flex: 1, display: 'flex', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 999, padding: 5, boxShadow: '0 8px 24px rgba(45,43,43,.12),0 0 0 1px rgba(45,43,43,.04)' }}>
          {TABS.map(([k, label, Icon]) => {
            const on = ui.tab === k;
            return (
              <button key={k} onClick={() => setUI({ tab: k })} aria-label={label} aria-current={on ? 'page' : undefined}
                style={{ flex: on ? 2.3 : 1, minWidth: 0, height: 52, borderRadius: 999, border: 0, background: on ? 'var(--color-accent-100)' : 'transparent', color: on ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'flex .25s ease,background .2s', overflow: 'hidden' }}>
                <Icon size={21} sw={2} />
                {on && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              </button>
            );
          })}
        </nav>
        <button onClick={() => openSheet({ name: 'add' })} aria-label="Add expense" className="hv-acc600 pr92" style={{ width: 62, height: 62, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', boxShadow: '0 8px 20px color-mix(in srgb,var(--color-accent) 35%,transparent)', transition: 'transform .15s' }}>
          <I.Plus size={26} sw={2.5} />
        </button>
      </div>

      {ui.page === 'investments' && <Investments />}

      {ui.sheet && <SheetRouter key={JSON.stringify(ui.sheet)} sheet={ui.sheet} />}
      <CropperHost />
    </div>
  );
}
