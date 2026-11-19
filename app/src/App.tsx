import { PrivacySheet } from './sheets/PrivacySheet';
import { SheetFrame } from './sheets/Sheet';
import { IncomeMonthSheet } from './sheets/IncomeMonthSheet';
import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useApp, setUI, openSheet, setData, getData, replaceData, isPersisting, onPersist } from './lib/store';
import { markDirty, startCloud, syncNow } from './lib/cloud';
import { People, TopBar, useDesk } from './ui/Desk';
import { applyBg } from './lib/bg';
import { registerSW, syncReminders } from './lib/push';
import { LockGate } from './ui/LockScreen';
import { openTripLink, pollTrips } from './lib/tripNotify';
import { publishPhoto, syncDebts } from './lib/social';
import { ReminderSheet } from './sheets/ReminderSheet';
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
import { ArrivalVeil } from './ui/ArrivalVeil';
import InstallGuide, { isInstalled, shouldShowInstallGuide } from './screens/InstallGuide';
import Setup from './screens/Setup';
import GuidedTour from './screens/GuidedTour';
import Investments from './screens/Investments';
import ReportPage, { ReportsIndex } from './screens/Reports';
import CategoriesPage from './screens/Categories';
import SocialPage, { FriendAddSheet, PersonPage, TripPage, WhatHappenedSheet } from './screens/Social';
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
import { CardLinkSheet, QuickAddSheet } from './sheets/QuickAddSheet';
import { pullQuickInbox, pushQuickMenu } from './lib/quickaddSync';
import { quickMenu } from './lib/quickadd';
import { EditTxnSheet } from './sheets/EditTxn';
import { AddSheet, CoverSheet, RefillSheet, EditPocketSheet, MoveSheet, PocketSheet, SavedSheet, SearchSheet } from './sheets/PocketSheets';
import { AdjustSheet } from './sheets/AdjustSheet';
import { AcctActionsSheet, AcctSheet, AddAcctSheet, EditAcctSheet, ExportSheet, GoalSheet, NewGoalSheet, PaySheet, SettingsSheet, TransferSheet } from './sheets/MoneySheets';
import * as I from './ui/icons';

const TABS: [Tab, string, (p: { size?: number; sw?: number }) => ReactNode][] = [
  ['home', 'Home', I.Home], ['accounts', 'Accounts', I.Card], ['budget', 'Budget', I.Wallet], ['calendar', 'Calendar', I.Calendar], ['insights', 'Insights', I.Chart], ['social', 'Friends', People]
];

function TabView({ tab }: { tab: Tab }) {
  if (tab === 'home') return <Home />;
  if (tab === 'accounts') return <Accounts />;
  if (tab === 'budget') return <Budget />;
  if (tab === 'insights') return <Insights />;
  if (tab === 'social') return <SocialPage />;
  return <CalendarScreen />;
}

/** If a sheet breaks while drawing, show a calm message instead of a black screen; the rest of the app keeps working. */
class SheetSafety extends Component<{ children: ReactNode }, { broke: boolean }> {
  state = { broke: false };
  static getDerivedStateFromError() { return { broke: true }; }
  componentDidCatch(e: unknown) { console.error('Sheet failed', e); }
  render() {
    if (!this.state.broke) return this.props.children;
    return <SheetFrame title="Something went wrong"><span style={{ fontSize: 14, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>This screen couldn't open. Your data is safe. Close it and try again; if it keeps happening, tell us what you tapped.</span></SheetFrame>;
  }
}

function SheetRouter({ sheet }: { sheet: Sheet }) {
  switch (sheet.name) {
    case 'search': return <SearchSheet tag={sheet.tag} cat={sheet.cat} />;
    case 'add': return <AddSheet pocket={sheet.pocket} mode={sheet.mode} />;
    case 'pocket': return <PocketSheet id={sheet.id} view={sheet.view} />;
    case 'saved': return <SavedSheet id={sheet.id} />;
    case 'move': return <MoveSheet id={sheet.id} to={sheet.to} />;
    case 'cover': return <CoverSheet />;
    case 'refill': return <RefillSheet id={sheet.id} />;
    case 'fund': return <FundSheet id={sheet.id} />;
    case 'fundInfo': return <FundInfoSheet id={sheet.id} />;
    case 'fundMove': return <FundMoveSheet id={sheet.id} kind={sheet.kind} />;
    case 'editPocket': return <EditPocketSheet id={sheet.id} />;
    case 'export': return <ExportSheet acct={sheet.acct} />;
    case 'acct': return <AcctSheet id={sheet.id} />;
    case 'editAcct': return <EditAcctSheet id={sheet.id} />;
    case 'addAcct': return <AddAcctSheet name0={sheet.name0} type0={sheet.type0} linkCard={sheet.linkCard} />;
    case 'cardLink': return <CardLinkSheet card={sheet.card} />;
    case 'debt': return <DebtSheet id={sheet.id} dir={sheet.dir} friend={sheet.friend} name={sheet.person} />;
    case 'friendNew': return <WhatHappenedSheet />;
    case 'friendAdd': return <FriendAddSheet />;
    case 'debtPay': return <DebtPaySheet id={sheet.id} />;
    case 'pay': return <PaySheet id={sheet.id} />;
    case 'transfer': return <TransferSheet from={sheet.from} id={sheet.id} />;
    case 'acctActions': return <AcctActionsSheet id={sheet.id} />;
    case 'adjust': return <AdjustSheet id={sheet.id} />;
    case 'goal': return <GoalSheet id={sheet.id} />;
    case 'newGoal': return <NewGoalSheet />;
    case 'settings': return <SettingsSheet />;
    case 'reminder': return <ReminderSheet id={sheet.id} />;
    case 'quickAdd': return <QuickAddSheet />;
    case 'privacy': return <PrivacySheet />;
    case 'incomeMonth': return <IncomeMonthSheet />;
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

/** How old the last full read of shared debts can be before opening the app reads them again. */
const DEBT_MAX_AGE = 6 * 3600e3;

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
      else if (h === 'add') setUI({ sheet: { name: 'add' } });
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
    const t = setTimeout(() => { syncReminders(getData()).catch(() => {}); }, 5000);
    return () => clearTimeout(t);
  }, [data]);

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
  // Each check only looks inside trips that changed. It runs when the app opens or comes back (at most every
  // 5 minutes), and every 90 seconds only while a trip, its chat or a conversation is on screen.
  const onTrip = !!ui.page && /^(trip|tripchat|tripstats|dm):/.test(ui.page);
  useEffect(() => {
    if (!sync.uid) return;
    let last = 0;
    const run = (force = false) => { if (document.visibilityState !== 'visible' || (!force && Date.now() - last < 5 * 60_000)) return; last = Date.now(); pollTrips(); };
    run(true);
    const t = onTrip ? setInterval(() => run(true), 90_000) : undefined;
    const back = () => run();
    document.addEventListener('visibilitychange', back);
    return () => { if (t) clearInterval(t); document.removeEventListener('visibilitychange', back); };
  }, [sync.uid, onTrip]);

  // Your profile picture: a small copy goes to your public profile so friends see it (only when it changes).
  const photo = data.settings.profilePhoto;
  useEffect(() => {
    if (!sync.uid) return;
    const mark = photo ? `${sync.uid}:${photo.length}:${photo.slice(-40)}` : `${sync.uid}:none`;
    let last = ''; try { last = localStorage.getItem('pockets-photo-pub') ?? ''; } catch { /* none */ }
    if (last === mark) return;
    publishPhoto(photo).then(() => { try { localStorage.setItem('pockets-photo-pub', mark); } catch { /* not saved */ } }).catch(() => {});
  }, [sync.uid, photo]);

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
  // Opening the app (or coming back) reads them at most every 6 hours; a change you made is sent right away.
  const debtFirst = useRef(true);
  useEffect(() => {
    if (!sync.uid) return;
    const first = debtFirst.current; debtFirst.current = false;
    const t = setTimeout(() => { syncDebts(first ? { maxAge: DEBT_MAX_AGE } : {}).catch(() => {}); }, 1200);
    return () => clearTimeout(t);
  }, [debtKey, sync.uid, sync.syncedAt > 0]);
  useEffect(() => {
    if (!sync.uid) return;
    const run = () => { if (document.visibilityState === 'visible') syncDebts({ maxAge: DEBT_MAX_AGE }).catch(() => {}); };
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
  // Quick add from an iPhone Shortcut: collect the inbox when the app opens or comes back, and keep the Shortcut's pocket list current.
  const quickKey = data.settings.quickAdd?.key;
  const quickOn = !!quickKey && !ui.welcome;
  useEffect(() => {
    if (!quickOn) return;
    const run = () => { if (document.visibilityState === 'visible') { pullQuickInbox(); pushQuickMenu().catch(() => {}); } };
    run();
    document.addEventListener('visibilitychange', run);
    return () => document.removeEventListener('visibilitychange', run);
  }, [quickOn, quickKey]);
  const quickList = quickOn ? JSON.stringify(quickMenu(data, 'en')) : '';
  useEffect(() => { if (quickList) pushQuickMenu().catch(() => {}); }, [quickList]);
  // ?install=1 comes from the website's Start free on an iPhone: show the install guide right away (even if skipped before).
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.has('install')) {
      q.delete('install');
      history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash);
      if (!isInstalled()) { setUI({ install: 'auto' }); return; }
    }
    if (shouldShowInstallGuide()) setUI({ install: 'auto' });
  }, []);
  // Closed the app in the middle of the first-time setup: open it again at the same step.
  useEffect(() => { if (getData().settings.setupStep && !ui.welcome) setUI({ setup: true }); }, [ui.welcome]);
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
        <img className="brand-flower" src="./pockets-mark.svg" alt="" width={58} height={58} />
        <span className="wordmark">Pockets</span>
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
      {ui.page?.startsWith('trip:') && <TripPage id={ui.page.slice(5)} />}
      {ui.page?.startsWith('tripstats:') && <TripStatsPage id={ui.page.slice(10)} />}
      {ui.page?.startsWith('tripchat:') && <TripChatPage id={ui.page.slice(9)} />}
      {ui.page?.startsWith('dm:') && <DmPage uid={ui.page.slice(3)} />}
      {ui.page?.startsWith('person:') && <PersonPage k={ui.page.slice(7)} />}
      </div>

      {!ui.sheet && <div className="conflict-slot" style={{ position: 'absolute', left: 14, right: 14, top: 'calc(var(--top) - 6px)', zIndex: 32 }}><ConflictChoice /></div>}

      {ui.toast && (
        <div role="status" style={{ position: 'absolute', left: 18, right: 18, bottom: 'calc(var(--tb) + 82px)', zIndex: 30, background: 'var(--color-text)', color: 'var(--on-text)', padding: '14px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
          <I.Check size={16} sw={2.5} />
          <span>{ui.toast}</span>
        </div>
      )}

      {banner && !ui.sheet && (
        <div className="banner" role="alert" onClick={() => { if (banner.kind === 'reminder') { patchNotif(banner.id, { bannered: true, dismissed: true }); openSheet({ name: 'add' }); } else if (banner.card) { patchNotif(banner.id, { bannered: true }); openSheet({ name: 'cardLink', card: banner.card }); } else if (banner.txn) { patchNotif(banner.id, { bannered: true, dismissed: true }); openSheet({ name: 'txn', kind: 'expense', id: banner.txn }); } else if (banner.link) { patchNotif(banner.id, { bannered: true, dismissed: true }); openTripLink(banner.link); } else { patchNotif(banner.id, { bannered: true }); openSheet({ name: 'notifications' }); } }}
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
                style={{ flex: 1, minWidth: 0, height: 52, borderRadius: 999, border: 0, background: on ? 'var(--brand-tint)' : 'transparent', color: on ? 'var(--brand)' : 'var(--color-neutral-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', transition: 'background .2s' }}>
                <Icon size={21} sw={2} />
                              </button>
            );
          })}
        </nav>
        {/* The add button: a teal disc with a + (styles: .add-flower). */}
        <button data-tour="add" onClick={() => openSheet({ name: 'add' })} aria-label="Add expense" className="add-flower pr92">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.8V16.2M1.8 9H16.2" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
        </button>
      </div>}


      {ui.sheet && <SheetSafety key={JSON.stringify(ui.sheet)}><SheetRouter sheet={ui.sheet} /></SheetSafety>}
      {ui.welcome && <Welcome />}
      {ui.setup && <Setup />}
      {ui.guide && <GuidedTour />}
      <ArrivalVeil />
      {ui.install && <InstallGuide fromProfile={ui.install === 'profile'} onClose={() => setUI({ install: false })} />}
      <CropperHost />
      <LockGate />
    </div>
  );
}
