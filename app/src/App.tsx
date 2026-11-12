import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { getLang } from './lib/i18n';
import { useApp, setUI, openSheet, setData, getData, replaceData, isPersisting, onPersist } from './lib/store';
import { markDirty, startCloud, syncNow } from './lib/cloud';
import { TopBar, useDesk } from './ui/Desk';
import { applyBg } from './lib/bg';
import { registerSW, syncReminders } from './lib/push';
import { LockGate } from './ui/LockScreen';
import { openTripLink, pollTrips } from './lib/tripNotify';
import { publishPhoto, syncDebts } from './lib/social';
import { useSync } from './sheets/CloudSheet';
import { CloudSheet, ConflictChoice } from './sheets/CloudSheet';
import { runSchedule, trmNeeded } from './lib/schedule';
import { ensureTrm } from './lib/trm';
import { runInterest } from './lib/interest';
import { runCdts } from './lib/cdt';
import type { Data } from './lib/types';

/** Interest first (it uses yesterday's balance), then scheduled items and notifications. */
function runAutomations(d: Data) {
  const a = runInterest(d), d1 = a ? { ...d, ...a } : d;
  const b = runSchedule(d1), d2 = b ? { ...d1, ...b } : d1;
  const c = runCdts(d2);
  return a || b || c ? { ...(a || {}), ...(b || {}), ...(c || {}) } : null;
}
import { todayISO } from './lib/dates';
import type { Sheet, Tab } from './lib/types';
import Home from './screens/Home';
import Accounts from './screens/Accounts';
import Budget from './screens/Budget';
import Insights from './screens/Insights';
import CalendarScreen from './screens/Calendar';
import Welcome from './screens/Welcome';
import Tour from './screens/Tour';
import InstallGuide, { shouldShowInstallGuide } from './screens/InstallGuide';
import Investments from './screens/Investments';
import ReportPage, { ReportsIndex } from './screens/Reports';
import CategoriesPage from './screens/Categories';
import SocialPage, { TripPage } from './screens/Social';
import { DmPage, TripChatPage, TripStatsPage } from './screens/TripExtras';
import { TripItemSheet, TripNewSheet, TripPeopleSheet } from './sheets/TripSheets';
import { HoldingSheet, PriceSettingsSheet, TradeSheet } from './sheets/InvestSheets';
import { CdtInfoSheet, CdtSheet } from './sheets/CdtSheets';
import { FundInfoSheet, FundMoveSheet, FundSheet } from './sheets/FundSheets';
import { ReconcileSheet } from './sheets/ReconcileSheet';
import { DebtPaySheet, DebtSheet } from './sheets/DebtSheets';
import { GroupItemSheet, GroupSheet } from './sheets/GroupSheets';
import { BackupNowButton, NOTIF_TONE, NotifIcon, NotificationsSheet, ScheduleSheet } from './sheets/ScheduleSheets';
import { CropperHost } from './ui/Cropper';
import { tookSwipe, useSwipeNav, type Peek } from './ui/swipe';
import { EditTxnSheet } from './sheets/EditTxn';
import { AddSheet, CoverSheet, EditPocketSheet, MoveSheet, PocketSheet, SavedSheet, SearchSheet } from './sheets/PocketSheets';
import { AcctSheet, AddAcctSheet, EditAcctSheet, ExportSheet, GoalSheet, NewGoalSheet, PaySheet, SettingsSheet } from './sheets/MoneySheets';
import * as I from './ui/icons';

const TABS: [Tab, string, (p: { size?: number; sw?: number }) => ReactNode][] = [
  ['home', 'Home', I.Home], ['accounts', 'Accounts', I.Card], ['budget', 'Budget', I.Wallet], ['insights', 'Insights', I.Chart], ['calendar', 'Calendar', I.Calendar]
];

function TabView({ tab }: { tab: Tab }) {
  if (tab === 'home') return <Home />;
  if (tab === 'accounts') return <Accounts />;
  if (tab === 'budget') return <Budget />;
  if (tab === 'insights') return <Insights />;
  return <CalendarScreen />;
}

function SheetRouter({ sheet }: { sheet: Sheet }) {
  switch (sheet.name) {
    case 'search': return <SearchSheet tag={sheet.tag} cat={sheet.cat} />;
    case 'add': return <AddSheet pocket={sheet.pocket} mode={sheet.mode} />;
    case 'pocket': return <PocketSheet id={sheet.id} view={sheet.view} />;
    case 'saved': return <SavedSheet id={sheet.id} />;
    case 'move': return <MoveSheet id={sheet.id} to={sheet.to} />;
    case 'cover': return <CoverSheet />;
    case 'fund': return <FundSheet id={sheet.id} />;
    case 'fundInfo': return <FundInfoSheet id={sheet.id} />;
    case 'fundMove': return <FundMoveSheet id={sheet.id} kind={sheet.kind} />;
    case 'editPocket': return <EditPocketSheet id={sheet.id} />;
    case 'export': return <ExportSheet acct={sheet.acct} />;
    case 'acct': return <AcctSheet id={sheet.id} />;
    case 'editAcct': return <EditAcctSheet id={sheet.id} />;
    case 'addAcct': return <AddAcctSheet />;
    case 'debt': return <DebtSheet id={sheet.id} dir={sheet.dir} friend={sheet.friend} />;
    case 'debtPay': return <DebtPaySheet id={sheet.id} />;
    case 'pay': return <PaySheet id={sheet.id} />;
    case 'goal': return <GoalSheet id={sheet.id} />;
    case 'newGoal': return <NewGoalSheet />;
    case 'settings': return <SettingsSheet />;
    case 'schedule': return <ScheduleSheet id={sheet.id} day={sheet.day} kind={sheet.kind} />;
    case 'notifications': return <NotificationsSheet />;
    case 'trade': return <TradeSheet ticker={sheet.ticker} side={sheet.side} />;
    case 'holding': return <HoldingSheet ticker={sheet.ticker} />;
    case 'cdt': return <CdtSheet id={sheet.id ?? null} />;
    case 'cdtInfo': return <CdtInfoSheet id={sheet.id} />;
    case 'reconcile': return <ReconcileSheet />;
    case 'cloud': return <CloudSheet />;
    case 'tripNew': return <TripNewSheet />;
    case 'tripPeople': return <TripPeopleSheet trip={sheet.trip} />;
    case 'tripItem': return <TripItemSheet trip={sheet.trip} id={sheet.id} payment={sheet.payment} />;
    case 'group': return <GroupSheet id={sheet.id} />;
    case 'groupItem': return <GroupItemSheet group={sheet.group} id={sheet.id} />;
    case 'priceSettings': return <PriceSettingsSheet />;
    case 'txn': return <EditTxnSheet kind={sheet.kind} id={sheet.id} back={sheet.back} />;
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

  // Lock-screen notifications: the background script, tapping a notification opens its screen, and the phone's
  // upcoming reminders are handed to the server whenever they change.
  useEffect(() => {
    registerSW();
    const open = (link: string) => {
      const h = link.replace(/^\.?\/?#?/, '');
      if (/^(dm|trip|tripchat|tripstats):/.test(h)) setUI({ sheet: null, page: h as never });
      else if (h === 'calendar' || h === 'accounts') setUI({ sheet: null, page: null, tab: h });
      else if (h === 'backup') setUI({ sheet: { name: 'settings' } });
      else return false;
      return true;
    };
    if (location.hash && open(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    const onMsg = (e: MessageEvent) => { if (e.data?.type === 'open') open(String(e.data.url || '')); };
    const onHash = () => { if (location.hash && open(location.hash)) history.replaceState(null, '', location.pathname + location.search); };
    navigator.serviceWorker?.addEventListener('message', onMsg);
    window.addEventListener('hashchange', onHash);
    return () => { navigator.serviceWorker?.removeEventListener('message', onMsg); window.removeEventListener('hashchange', onHash); };
  }, []);
  useEffect(() => {
    if (ui.tour) return;
    const t = setTimeout(() => { syncReminders(getData()).catch(() => {}); }, 5000);
    return () => clearTimeout(t);
  }, [data, ui.tour]);

  // Shared trips: while signed in and the app is open, check for friends' expenses and messages every 90 seconds
  // (and right away when you come back to the app). There is no push, so this only runs while Pockets is open.
  const sync = useSync();
  const desk = useDesk();
  // On a computer the window often stays open for hours: bring down changes made on the phone once a minute.
  useEffect(() => {
    if (!desk || !sync.uid) return;
    const t = setInterval(() => { if (document.visibilityState === 'visible') syncNow(); }, 60_000);
    return () => clearInterval(t);
  }, [desk, sync.uid]);
  useEffect(() => {
    if (!sync.uid) return;
    const run = () => { if (document.visibilityState === 'visible') pollTrips(); };
    run();
    const t = setInterval(run, 90_000);
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', run); };
  }, [sync.uid]);

  // Your profile picture: a small copy goes to your public profile so friends see it (only when it changes).
  const photo = data.settings.profilePhoto;
  useEffect(() => {
    if (!sync.uid || ui.tour) return;
    const mark = photo ? `${sync.uid}:${photo.length}:${photo.slice(-40)}` : `${sync.uid}:none`;
    let last = ''; try { last = localStorage.getItem('pockets-photo-pub') ?? ''; } catch { /* none */ }
    if (last === mark) return;
    publishPhoto(photo).then(() => { try { localStorage.setItem('pockets-photo-pub', mark); } catch { /* not saved */ } }).catch(() => {});
  }, [sync.uid, photo, ui.tour]);

  // Today's newest notification shows as a banner at the top until dismissed or it times out.
  const banner = data.notifications.find(n => n.date === todayISO() && !n.dismissed && !n.bannered);
  useEffect(() => {
    if (!banner || banner.kind === 'backup') return;
    const t = setTimeout(() => setData(x => ({ notifications: x.notifications.map(n => (n.id === banner.id ? { ...n, bannered: true } : n)) })), 7000);
    return () => clearTimeout(t);
  }, [banner?.id]);
  const patchNotif = (id: string, p: { dismissed?: boolean; bannered?: boolean }) => setData(x => ({ notifications: x.notifications.map(n => (n.id === id ? { ...n, ...p } : n)) }));

  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); if (ui.page) setUI({ page: null }); }, [ui.tab]);
  // Shared debts: send and receive changes when the app opens or comes back, and shortly after a shared debt changes.
  const debtKey = sync.uid ? JSON.stringify((data.debts ?? []).filter(x => x.friend).map(x => [x.id, x.dir, x.amt, x.date, x.due, x.note, x.pays.map(p => [p.id, p.amt, p.date])])) : '';
  useEffect(() => {
    if (!sync.uid || ui.tour) return;
    const t = setTimeout(() => { syncDebts().catch(() => {}); }, 1200);
    return () => clearTimeout(t);
  }, [debtKey, sync.uid, ui.tour]);
  useEffect(() => {
    if (!sync.uid) return;
    const run = () => { if (document.visibilityState === 'visible') syncDebts().catch(() => {}); };
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [sync.uid]);
  // Phone swipes: left edge → back; left/right on a main tab → next/previous tab.
  const [peek, setPeek] = useState<Peek | null>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  useSwipeNav({ tabs: TABS.map(t => t[0]), enabled: !desk, scroller: scroll, peek: peekRef, setPeek });
  // After a swipe the tab changes while the old one is slid off-screen: put the scroller back before the screen is drawn.
  useLayoutEffect(() => { const el = scroll.current; if (el) { el.style.transition = ''; el.style.transform = ''; } }, [ui.tab]);
  // A tapped tab glides in from its side; after a finger swipe it's already in place, so no second animation.
  const lastTab = useRef(ui.tab);
  const tabAnim = useRef('');
  if (lastTab.current !== ui.tab) {
    const order = TABS.map(t => t[0]);
    tabAnim.current = desk || tookSwipe() ? '' : order.indexOf(ui.tab) > order.indexOf(lastTab.current) ? 'tab-in-r' : 'tab-in-l';
    lastTab.current = ui.tab;
  }
  // Opening a page from a tab slides it in; going from one page to another only fades.
  const lastPage = useRef(ui.page);
  const nav = useRef('push');
  if (lastPage.current !== ui.page) { nav.current = lastPage.current && ui.page ? 'swap' : 'push'; lastPage.current = ui.page; }
  useEffect(() => { if (shouldShowInstallGuide()) setUI({ install: 'auto' }); }, []);
  // Light/dark: follow the setting, or the iPhone when it's "System".
  const theme = data.settings.theme ?? 'system';
  const bgKey = JSON.stringify(data.settings.bg ?? {});
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const t = theme === 'system' ? (mq.matches ? 'dark' : 'light') : theme;
      document.documentElement.dataset.theme = t;
      // The page background (and the status bar) take the user's own color for this mode, if they picked one.
      applyBg(getData().settings.bg, t);
      // iOS colors the status bar from the page's appearance, so it follows the app's setting, not the phone's.
      document.querySelector('meta[name="color-scheme"]')?.setAttribute('content', t);
      try { localStorage.setItem('pockets-theme', theme); } catch { /* not saved */ }
      setUI({});
    };
    apply(); mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme, bgKey]);
  // Cloud sync: every saved change is uploaded a few seconds later; other phones' changes come down on open.
  useEffect(() => { startCloud({ getData, replace: d => replaceData(d), canSync: isPersisting }); return onPersist(markDirty); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUI({ sheet: null }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className={desk ? 'shell desk' : 'shell'} data-nav={nav.current}>
      {desk && <TopBar tabs={TABS} />}
      <div className="main">
      <div ref={brand} className="brand-reveal" aria-hidden="true">
        <img src="./pockets-mark.svg" alt="" width={50} height={61} />
        <span>Pockets</span>
      </div>
      <div ref={scroll} onScroll={onScroll} className="noscroll scroller" style={{ flex: 1, minHeight: 0, position: 'relative', zIndex: 1 }}>
        <div key={ui.tab} className={`scroll-body ${tabAnim.current}`} style={{ padding: `var(--top) 18px calc(var(--tb) + 100px)`, boxSizing: 'border-box' }}>
        <TabView tab={ui.tab} />
        </div>
      </div>
      {/* The tab sliding in beside the current one while you swipe (see ui/swipe.ts). */}
      {peek && <div ref={peekRef} aria-hidden="true" className="noscroll scroller" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', transform: `translateX(${peek.side * 100}%)` }}>
        <div className="scroll-body" style={{ padding: `var(--top) 18px calc(var(--tb) + 100px)`, boxSizing: 'border-box' }}><TabView tab={peek.tab} /></div>
      </div>}

      {ui.page === 'investments' && <Investments />}
      {ui.page === 'reports' && <ReportsIndex />}
      {ui.page === 'categories' && <CategoriesPage />}
      {ui.page?.startsWith('report:') && <ReportPage id={ui.page.slice(7)} />}
      {ui.page === 'social' && <SocialPage />}
      {ui.page?.startsWith('trip:') && <TripPage id={ui.page.slice(5)} />}
      {ui.page?.startsWith('tripstats:') && <TripStatsPage id={ui.page.slice(10)} />}
      {ui.page?.startsWith('tripchat:') && <TripChatPage id={ui.page.slice(9)} />}
      {ui.page?.startsWith('dm:') && <DmPage uid={ui.page.slice(3)} />}
      </div>

      {!ui.sheet && !ui.tour && <div className="conflict-slot" style={{ position: 'absolute', left: 14, right: 14, top: 'calc(var(--top) - 6px)', zIndex: 32 }}><ConflictChoice /></div>}

      {ui.toast && (
        <div role="status" style={{ position: 'absolute', left: 18, right: 18, bottom: 'calc(var(--tb) + 82px)', zIndex: 30, background: 'var(--color-text)', color: 'var(--on-text)', padding: '14px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
          <I.Check size={16} sw={2.5} />
          <span>{ui.toast}</span>
        </div>
      )}

      {banner && !ui.sheet && !ui.tour && (
        <div className="banner" role="alert" onClick={() => { if (banner.link) { patchNotif(banner.id, { bannered: true, dismissed: true }); openTripLink(banner.link); } else { patchNotif(banner.id, { bannered: true }); openSheet({ name: 'notifications' }); } }}
          style={{ position: 'absolute', left: 12, right: 12, top: 'calc(var(--top) - 10px)', zIndex: 35, background: 'var(--surface)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 22, padding: '12px 10px 12px 14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 10px 30px rgba(45,43,43,.18),0 0 0 1px rgba(45,43,43,.05)', cursor: 'pointer' }}>
          <div style={{ width: 38, height: 38, borderRadius: 999, background: NOTIF_TONE[banner.kind].bg, color: NOTIF_TONE[banner.kind].fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><NotifIcon kind={banner.kind} /></div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{banner.title}</span>
            <span style={{ fontSize: 12.5, color: 'var(--color-neutral-700)', lineHeight: 1.3 }}>{banner.body}</span>
            {banner.kind === 'backup' && <BackupNowButton id={banner.id} />}
          </div>
          <button onClick={e => { e.stopPropagation(); patchNotif(banner.id, { dismissed: true }); }} aria-label="Dismiss notification" style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flex: 'none' }}><I.X size={14} /></button>
        </div>
      )}

      {!desk && <div className="tabbar" style={{ position: 'absolute', left: 14, right: 14, bottom: 'var(--tb)', zIndex: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
        <nav className="frosted" style={{ flex: 1, display: 'flex', background: 'rgba(255,255,255,.92)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: 999, padding: 5, boxShadow: '0 8px 24px rgba(45,43,43,.12),0 0 0 1px rgba(45,43,43,.04)' }}>
          {TABS.map(([k, label, Icon]) => {
            const on = ui.tab === k;
            return (
              <button key={k} data-tour={`tab-${k}`} onClick={() => setUI({ tab: k })} aria-label={label} aria-current={on ? 'page' : undefined}
                style={{ flex: on ? (getLang() === 'es' ? 3.3 : 2.3) : 1, minWidth: 0, height: 52, borderRadius: 999, border: 0, background: on ? 'var(--color-accent-100)' : 'transparent', color: on ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '0 8px', fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'flex .25s ease,background .2s', overflow: 'hidden' }}>
                <Icon size={21} sw={2} />
                {on && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
              </button>
            );
          })}
        </nav>
        <button data-tour="add" onClick={() => openSheet({ name: 'add' })} aria-label="Add expense" className="hv-acc600 pr92" style={{ width: 62, height: 62, borderRadius: 999, border: 0, background: 'var(--color-accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flex: 'none', boxShadow: '0 8px 20px color-mix(in srgb,var(--color-accent) 35%,transparent)', transition: 'transform .15s' }}>
          <I.Plus size={26} sw={2.5} />
        </button>
      </div>}


      {ui.sheet && <SheetRouter key={JSON.stringify(ui.sheet)} sheet={ui.sheet} />}
      {ui.tour && <Tour />}
      {ui.welcome && <Welcome />}
      {ui.install && <InstallGuide fromProfile={ui.install === 'profile'} onClose={() => setUI({ install: false })} />}
      <CropperHost />
      <LockGate />
    </div>
  );
}
