import { useEffect, useRef, type ReactNode } from 'react';
import { useApp, setUI, openSheet } from './lib/store';
import type { Sheet, Tab } from './lib/types';
import Home from './screens/Home';
import Accounts from './screens/Accounts';
import Budget from './screens/Budget';
import Insights from './screens/Insights';
import { AssistantChat, AssistantComposer } from './screens/Assistant';
import { AddSheet, EditPocketSheet, MoveSheet, PocketSheet, SavedSheet, SearchSheet } from './sheets/PocketSheets';
import { AcctSheet, AddAcctSheet, EditAcctSheet, ExportSheet, GoalSheet, PaySheet, SettingsSheet } from './sheets/MoneySheets';
import * as I from './ui/icons';

const TABS: [Tab, string, (p: { size?: number; sw?: number }) => ReactNode][] = [
  ['home', 'Home', I.Home], ['accounts', 'Accounts', I.Card], ['budget', 'Budget', I.Wallet], ['insights', 'Insights', I.Chart], ['assistant', 'Assistant', I.Sparkle]
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
    case 'settings': return <SettingsSheet />;
  }
}

export default function App() {
  const { ui } = useApp();
  const scroll = useRef<HTMLDivElement>(null);
  const isAI = ui.tab === 'assistant';

  useEffect(() => { scroll.current?.scrollTo({ top: 0 }); }, [ui.tab]);
  useEffect(() => {
    const el = scroll.current;
    if (el && isAI) requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
  }, [ui.chat, ui.thinking, isAI]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setUI({ sheet: null }); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="shell">
      <div ref={scroll} className="noscroll" style={{ flex: 1, overflowY: 'auto', padding: `var(--top) 18px calc(var(--tb) + ${isAI ? 170 : 100}px)`, scrollBehavior: 'smooth' }}>
        {ui.tab === 'home' && <Home />}
        {ui.tab === 'accounts' && <Accounts />}
        {ui.tab === 'budget' && <Budget />}
        {ui.tab === 'insights' && <Insights />}
        {isAI && <AssistantChat />}
      </div>

      {isAI && <AssistantComposer />}

      {ui.toast && (
        <div role="status" style={{ position: 'absolute', left: 18, right: 18, bottom: 'calc(var(--tb) + 82px)', zIndex: 30, background: 'var(--color-text)', color: '#fff', padding: '14px 18px', borderRadius: 999, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10, boxShadow: 'var(--shadow-lg)' }}>
          <I.Check size={16} sw={2.5} />
          <span>{ui.toast}</span>
        </div>
      )}

      <div style={{ position: 'absolute', left: 14, right: 14, bottom: 'var(--tb)', zIndex: 20, display: 'flex', gap: 10, alignItems: 'center' }}>
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

      {ui.sheet && <SheetRouter key={JSON.stringify(ui.sheet)} sheet={ui.sheet} />}
    </div>
  );
}
