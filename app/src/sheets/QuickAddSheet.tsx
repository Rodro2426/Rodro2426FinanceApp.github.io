// Profile → Apple Pay purchases: turn the Shortcut inbox on or off, link each Wallet card to an account, copy the two
// links and follow the steps to build the iPhone "Transaction" automation.
import { useState } from 'react';
import { useApp, setData, flash, getData, openSheet } from '../lib/store';
import { useSync } from './CloudSheet';
import { TEXT, ink, tint } from '../lib/constants';
import { newQuickKey, quickAccount, shortcutCats } from '../lib/quickadd';
import { pullQuickInbox, pushQuickMenu, quickAddOff, quickUrl } from '../lib/quickaddSync';
import { FieldLabel, GhostDanger, PrimaryBtn, Toggle } from '../ui/bits';
import { SheetFrame } from './Sheet';

/** iCloud link of the shared "Pockets Apple Pay" shortcut. Empty until the owner shares it; then the short steps show. */
const SHORTCUT_LINK = 'https://www.icloud.com/shortcuts/2765a45031bc48d4ad115eddd4f796d6';
const SHARED_STEPS = [
  'Tap "Get the Shortcut" and add it. When it asks for your key, paste it (Copy next to Your key).',
  'Open Shortcuts → Automation → +. Choose "Transaction" and your cards. Leave Any Category and Any Merchant, turn Automation on and Notify off, tap Next, then "New Blank Automation".',
  'Add "Dictionary" with three Text items named amount, merchant and card. For each value insert Shortcut Input, tap it, set Type to Transaction and pick Amount, Merchant or Card or Pass.',
  'Add "Run Shortcut" and pick "Pockets Apple Pay". Open it with the arrow and set Input to Dictionary.',
  'Pay with Apple Pay: pick the pocket and the category, and a notification says "Saved $25.000 at Éxito to Groceries · Food".'
];
const STEPS = [
  'Open Shortcuts → Automation → +. Choose "Transaction" and pick your card. Leave Any Category and Any Merchant, turn Automation on and Notify off.',
  'Tap Search at the bottom and add "Get Contents of URL". Tap the blue URL and paste the Pocket list link.',
  'Add "Get Dictionary Value". Tap Key and type pockets.',
  'Add "Choose from List". In its options, type "Pocket for" in Prompt, then add Shortcut Input: tap Type, choose Transaction, then Merchant.',
  'Add another "Get Contents of URL" and paste the Add purchase link. Open it with the arrow: Method POST, Request Body JSON.',
  'Tap Add new field → Text four times: pocket = Selected Item (a blue chip, not typed text); amount, merchant and card = Shortcut Input → Type Transaction → Amount, Merchant and Card or Pass.',
  'Add "Get Dictionary Value" with Key text, then "Show Notification" with Dictionary Value as the message. A "Receive … from Nowhere" block appears at the top by itself: leave it.',
  'Tap ▶ to test without paying: pick a pocket and you should see "Type an amount above 0." That means it works. A real Apple Pay payment then says "Saved $25.000 at Éxito to Groceries".'
];

export function QuickAddSheet() {
  const { data: d } = useApp();
  const qa = d.settings.quickAdd;
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const accounts = d.accounts.filter(a => !a.notMine);
  const payFrom = quickAccount(d);
  const cards = Object.entries(qa?.cards ?? {});
  const shown = shortcutCats(d);
  // Tapping a category pins it (the first tap starts from the list shown, so nothing jumps). At most 8: it pops up at the checkout.
  const pin = (name: string) => setData(x => {
    const q = x.settings.quickAdd!, now = q.pins?.length ? q.pins : shortcutCats(x);
    const pins = now.includes(name) ? now.filter(n => n !== name) : now.length >= 8 ? now : [...now, name];
    return { settings: { ...x.settings, quickAdd: { ...q, pins } } };
  });

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

          <div style={{ ...card, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 15, fontWeight: 700 }}>Ask me to check each purchase</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>A notification in Pockets for every Apple Pay purchase. Tap it to fix a strange store name or change the details. A name you fix goes to that store's other purchases too, past and next.</span>
            </span>
            <Toggle on={qa.review !== false} onChange={v => setData(x => ({ settings: { ...x.settings, quickAdd: { ...x.settings.quickAdd!, review: v ? undefined : false } } }))} label="Ask me to check each purchase" />
          </div>

          <FieldLabel>Categories to choose from</FieldLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {d.cats.map(k => {
              const on = shown.includes(k.name);
              return <button key={k.name} onClick={() => pin(k.name)} aria-pressed={on} className="pr97"
                style={{ height: 38, padding: '0 14px', borderRadius: 999, border: 0, background: on ? 'var(--color-text)' : 'var(--surface)', color: on ? 'var(--on-text)' : TEXT, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{k.name}</button>;
            })}
          </div>
          <span style={{ margin: '6px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>{qa.pins?.length ? 'After the pocket, the Shortcut asks for one of these. Up to 8.' : 'Until you pick some, the Shortcut offers the last categories you used. Up to 8.'}</span>

          <FieldLabel>Your links</FieldLabel>
          <div style={{ ...card, gap: 14 }}>
            {linkRow('Your key', qa.key)}
            {linkRow('Pocket list', quickUrl(qa.key, 'menu'))}
            {linkRow('Add purchase', quickUrl(qa.key, 'add'))}
            <span style={{ fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Anyone with these links can add expenses to your Pockets and see your pocket names, so keep them to yourself. If one leaks, turn this off and on again to get new links.</span>
          </div>

          <FieldLabel>Build the Shortcut</FieldLabel>
          {SHORTCUT_LINK && <a href={SHORTCUT_LINK} target="_blank" rel="noreferrer" className="pr97" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, marginBottom: 10, borderRadius: 999, background: TEXT, color: 'var(--surface)', fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>Get the Shortcut</a>}
          <ol style={{ ...card, margin: 0, padding: '16px 16px 16px 36px', gap: 10 }}>
            {(SHORTCUT_LINK ? SHARED_STEPS : STEPS).map(s => <li key={s} style={{ fontSize: 13.5, lineHeight: 1.45 }}>{s}</li>)}
          </ol>

          <PrimaryBtn onClick={check} disabled={busy}>{busy ? 'Checking…' : 'Check for new purchases'}</PrimaryBtn>
          <span style={{ margin: '8px 4px 0', fontSize: 12, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>Pockets also checks every time you open it. The pocket list updates on its own when you add or rename pockets.</span>
          <GhostDanger onClick={turnOff}>{confirmOff ? 'Tap again to turn off' : 'Turn off Apple Pay purchases'}</GhostDanger>
        </>}
      </div>
    </SheetFrame>
  );
}
