// Settings → Quick add from iPhone: turn the Shortcut inbox on or off, pick the account it pays from, copy the two
// links and follow the steps to build the Shortcut.
import { useState } from 'react';
import { useApp, setData, flash, getData, openSheet } from '../lib/store';
import { useSync } from './CloudSheet';
import { TEXT, ink, tint } from '../lib/constants';
import { newQuickKey, quickAccount } from '../lib/quickadd';
import { pullQuickInbox, pushQuickMenu, quickAddOff, quickUrl } from '../lib/quickaddSync';
import { FieldLabel, GhostDanger, PrimaryBtn } from '../ui/bits';
import { SheetFrame } from './Sheet';

const STEPS = [
  'Open the Shortcuts app, tap + and name the new shortcut "Pockets".',
  'Add "Get Contents of URL" and paste the Pocket list link.',
  'Add "Get Dictionary Value": get the value for "pockets" in Contents of URL.',
  'Add "Choose from List" with that Dictionary Value, and set the prompt to "Pocket".',
  'Add "Ask for Input": type Number, prompt "Amount".',
  'Add another "Ask for Input": type Text, prompt "Note" (you can leave it empty when you use it).',
  'Add "Get Contents of URL" and paste the Add expense link. Open its options: Method POST, Request Body JSON, and add three fields: pocket (Text) = Chosen Item, amount (Number) = the Amount answer, note (Text) = the Note answer.',
  'Add "Get Dictionary Value" for "text" and then "Show Notification" with it. It tells you "Saved $25.000 to Groceries", or what to fix if something is wrong.',
  'Add the button: open Control Center, tap +, then Add a Control → Shortcut, and pick "Pockets". For the Action button: Settings → Action Button → Shortcut.'
];

export function QuickAddSheet() {
  const { data: d } = useApp();
  const qa = d.settings.quickAdd;
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const accounts = d.accounts.filter(a => !a.notMine);
  const payFrom = quickAccount(d);

  const sync = useSync();
  // On only once the Worker has created the inbox (it needs the Pockets sign-in); otherwise undo and say why.
  const turnOn = async () => {
    setBusy(true);
    setData(x => ({ settings: { ...x.settings, quickAdd: { key: newQuickKey(), acct: quickAccount(x) } } }));
    const ok = await pushQuickMenu(true);
    setBusy(false);
    if (ok) { flash('Quick add is on'); return; }
    const key = getData().settings.quickAdd?.key;
    if (key) quickAddOff(key);
    setData(x => ({ settings: { ...x.settings, quickAdd: undefined } }));
    flash("Couldn't reach the Pockets server. Check your connection and try again.");
  };
  const turnOff = () => {
    if (!qa) return;
    if (!confirmOff) { setConfirmOff(true); return; }
    quickAddOff(qa.key);
    setData(x => ({ settings: { ...x.settings, quickAdd: undefined } }));
    setConfirmOff(false); flash('Quick add is off');
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); flash('Link copied'); } catch { flash('Could not copy. Press and hold the link to copy it.'); }
  };
  const check = async () => {
    setBusy(true);
    await pushQuickMenu(true).catch(() => {});
    const n = await pullQuickInbox(true);
    setBusy(false);
    if (!n) flash('No new expenses from your Shortcut');
  };
  const card = { background: 'var(--surface)', borderRadius: 22, padding: 16, display: 'flex', flexDirection: 'column' as const, gap: 8 };
  const linkRow = (label: string, url: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 14, fontWeight: 700 }}>{label}</span>
        <span style={{ fontSize: 11.5, color: 'var(--color-neutral-600)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'all', WebkitUserSelect: 'all' }}>{url}</span>
      </span>
      <button onClick={() => copy(url)} className="hv-n200" style={{ height: 36, padding: '0 14px', borderRadius: 999, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', flex: 'none' }}>Copy</button>
    </div>
  );

  return (
    <SheetFrame title="Quick add from iPhone">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={card}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Log an expense in seconds</span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>A button in Control Center or on the Action button runs an iPhone Shortcut. It asks for the pocket and the amount in small iPhone pop-ups, without opening Pockets. The expense is saved here the next time you open the app.</span>
        </div>

        {!qa && !sync.uid && <>
          <span style={{ margin: '12px 4px 0', fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Quick add needs your Pockets account, so only your phone can create your inbox.</span>
          <PrimaryBtn onClick={() => openSheet({ name: 'cloud' })}>Sign in first</PrimaryBtn>
        </>}
        {!qa && sync.uid && <PrimaryBtn onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on quick add'}</PrimaryBtn>}
        {qa && <>
          <FieldLabel>Pay from</FieldLabel>
          <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setData(x => ({ settings: { ...x.settings, quickAdd: { ...x.settings.quickAdd!, acct: a.id } } }))} aria-pressed={payFrom === a.id}
                style={{ flex: 'none', padding: '10px 14px', borderRadius: 18, border: `2px solid ${payFrom === a.id ? ink(a.hue) : 'var(--surface)'}`, background: payFrom === a.id ? tint(a.hue) : 'var(--surface)', color: TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{a.name}</button>
            ))}
          </div>

          <FieldLabel>Your links</FieldLabel>
          <div style={{ ...card, gap: 14 }}>
            {linkRow('Pocket list', quickUrl(qa.key, 'menu'))}
            {linkRow('Add expense', quickUrl(qa.key, 'add'))}
            <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Anyone with these links can add expenses to your Pockets, so keep them to yourself. If one leaks, turn quick add off and on again to get new links.</span>
          </div>

          <FieldLabel>Build the Shortcut</FieldLabel>
          <ol style={{ ...card, margin: 0, padding: '16px 16px 16px 36px', gap: 10 }}>
            {STEPS.map(s => <li key={s} style={{ fontSize: 13.5, lineHeight: 1.45 }}>{s}</li>)}
          </ol>

          <PrimaryBtn onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check for new expenses'}</PrimaryBtn>
          <span style={{ margin: '8px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Pockets also checks every time you open it. The pocket list updates on its own when you add or rename pockets.</span>
          <GhostDanger onClick={turnOff}>{confirmOff ? 'Tap again to turn off' : 'Turn off quick add'}</GhostDanger>
        </>}
      </div>
    </SheetFrame>
  );
}
