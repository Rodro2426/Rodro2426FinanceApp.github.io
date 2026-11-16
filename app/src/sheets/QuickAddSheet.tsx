// Profile → Apple Pay purchases: turn the Shortcut inbox on or off, link each Wallet card to an account, copy the two
// links and follow the steps to build the iPhone "Transaction" automation.
import { useState } from 'react';
import { useApp, setData, flash, getData, openSheet } from '../lib/store';
import { useSync } from './CloudSheet';
import { TEXT, ink, tint } from '../lib/constants';
import { newQuickKey, quickAccount } from '../lib/quickadd';
import { pullQuickInbox, pushQuickMenu, quickAddOff, quickUrl } from '../lib/quickaddSync';
import { FieldLabel, GhostDanger, PrimaryBtn } from '../ui/bits';
import { SheetFrame } from './Sheet';

const STEPS = [
  'Open the Shortcuts app, go to Automation and tap +. Choose "Transaction".',
  'Pick the cards you pay with in Wallet, leave "Any merchant", choose "Run Immediately" and tap Next, then "New Blank Automation".',
  'Add "Get Contents of URL" and paste the Pocket list link.',
  'Add "Get Dictionary Value": get the value for "pockets" in Contents of URL.',
  'Add "Choose from List" with that Dictionary Value. Set the prompt to "Pocket for" and add the Merchant from Shortcut Input.',
  'Add "Get Contents of URL" and paste the Add purchase link. Open its options: Method POST, Request Body JSON, and add four Text fields: pocket = Chosen Item, amount = Shortcut Input → Amount, merchant = Shortcut Input → Merchant, card = Shortcut Input → Card or Pass.',
  'Add "Get Dictionary Value" for "text", then "Show Notification" with it. It says "Saved $25.000 at Éxito to Groceries", or what to fix if something went wrong.',
  'Pay with Apple Pay once to try it. The pocket list shows up right after you pay; if it appears as a notification, tap it.'
];

export function QuickAddSheet() {
  const { data: d } = useApp();
  const qa = d.settings.quickAdd;
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const accounts = d.accounts.filter(a => !a.notMine);
  const payFrom = quickAccount(d);
  const cards = Object.entries(qa?.cards ?? {});

  const sync = useSync();
  // On only once the Worker has created the inbox (it needs the Pockets sign-in); otherwise undo and say why.
  const turnOn = async () => {
    setBusy(true);
    setData(x => ({ settings: { ...x.settings, quickAdd: { key: newQuickKey(), acct: quickAccount(x) } } }));
    const ok = await pushQuickMenu(true);
    setBusy(false);
    if (ok) { flash('Apple Pay purchases are on'); return; }
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
    setConfirmOff(false); flash('Apple Pay purchases are off');
  };
  const link = (card: string, acct: string) => setData(x => ({ settings: { ...x.settings, quickAdd: { ...x.settings.quickAdd!, cards: { ...x.settings.quickAdd?.cards, [card]: acct } } } }));
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); flash('Link copied'); } catch { flash('Could not copy. Press and hold the link to copy it.'); }
  };
  const check = async () => {
    setBusy(true);
    await pushQuickMenu(true).catch(() => {});
    const n = await pullQuickInbox(true);
    setBusy(false);
    if (!n) flash('No new Apple Pay purchases');
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
    <SheetFrame title="Apple Pay purchases">
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={card}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>Add purchases when you pay</span>
          <span style={{ fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>When you pay with your iPhone or Apple Watch, an iPhone Shortcut asks which pocket it was for and sends the amount and the store to Pockets. They are added as expenses the next time you open Pockets.</span>
          <span style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>Only Apple Pay taps. Purchases with the physical card, transfers and online payments still go in by hand. Purchases in another currency are not added.</span>
        </div>

        {!qa && !sync.uid && <>
          <span style={{ margin: '12px 4px 0', fontSize: 13, lineHeight: 1.45, color: 'var(--color-neutral-700)' }}>This needs your Pockets account, so only your phone can create your private inbox.</span>
          <PrimaryBtn onClick={() => openSheet({ name: 'cloud' })}>Sign in first</PrimaryBtn>
        </>}
        {!qa && sync.uid && <PrimaryBtn onClick={turnOn} disabled={busy}>{busy ? 'Turning on…' : 'Turn on Apple Pay purchases'}</PrimaryBtn>}
        {qa && <>
          <FieldLabel>Pay from, for a new card</FieldLabel>
          <div className="noscroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', margin: '0 -20px', padding: '0 20px' }}>
            {accounts.map(a => (
              <button key={a.id} onClick={() => setData(x => ({ settings: { ...x.settings, quickAdd: { ...x.settings.quickAdd!, acct: a.id } } }))} aria-pressed={payFrom === a.id}
                style={{ flex: 'none', padding: '10px 14px', borderRadius: 18, border: `2px solid ${payFrom === a.id ? ink(a.hue) : 'var(--surface)'}`, background: payFrom === a.id ? tint(a.hue) : 'var(--surface)', color: TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{a.name}</button>
            ))}
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>A card whose name includes an account's name ("Visa Davivienda") goes to that account on its own.</span>

          {cards.length > 0 && <>
            <FieldLabel>Your cards</FieldLabel>
            <div style={{ ...card, gap: 12 }}>
              {cards.map(([name, acct]) => (
                <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                  <select value={accounts.some(a => a.id === acct) ? acct : payFrom} onChange={e => link(name, e.target.value)} aria-label={`Account for ${name}`}
                    style={{ flex: 'none', maxWidth: '55%', height: 38, borderRadius: 12, border: 0, background: 'var(--color-neutral-100)', color: TEXT, fontSize: 14, fontWeight: 600, padding: '0 10px' }}>
                    {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
              ))}
              <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Cards show up here after their first purchase. A change applies to the next purchases.</span>
            </div>
          </>}

          <FieldLabel>Your links</FieldLabel>
          <div style={{ ...card, gap: 14 }}>
            {linkRow('Pocket list', quickUrl(qa.key, 'menu'))}
            {linkRow('Add purchase', quickUrl(qa.key, 'add'))}
            <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Anyone with these links can add expenses to your Pockets and see your pocket names, so keep them to yourself. If one leaks, turn this off and on again to get new links.</span>
          </div>

          <FieldLabel>Build the Shortcut</FieldLabel>
          <ol style={{ ...card, margin: 0, padding: '16px 16px 16px 36px', gap: 10 }}>
            {STEPS.map(s => <li key={s} style={{ fontSize: 13.5, lineHeight: 1.45 }}>{s}</li>)}
          </ol>

          <PrimaryBtn onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check for new purchases'}</PrimaryBtn>
          <span style={{ margin: '8px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Pockets also checks every time you open it. The pocket list updates on its own when you add or rename pockets.</span>
          <GhostDanger onClick={turnOff}>{confirmOff ? 'Tap again to turn off' : 'Turn off Apple Pay purchases'}</GhostDanger>
        </>}
      </div>
    </SheetFrame>
  );
}
