# Gotchas

Bugs already hit, approaches that failed, and fragile areas. Read this before touching the area in question.

## Rendering on iPhone / React

- **Never draw photos with CSS `background-image`.**
  - What happened: `BillBadge` set the `background` shorthand together with `backgroundImage`/`backgroundSize`. When the logo changed, React rewrote the shorthand and wiped the image settings, so a new logo showed only the color, or appeared zoomed, until the app restarted.
  - Fix: every photo is now `<Fill src>` (an absolutely positioned `<img>` with `object-fit: cover`) inside a `position: relative; overflow: hidden` box.
  - Card design photos in `CardFace` still use one `background` shorthand. That's safe because it's a single property; keep it that way.
- **Don't mix the `background` shorthand with `background*` longhands in one React style object.** It's the same bug as above.
- **Avatars made of a `<span>` need `display`** (inline-block or flex), or they collapse to nothing.
- **iPhones in Colombia or Europe show a comma as the decimal key.** In $, € or £ the amount box shows commas between thousands, so `MoneyInput` turns a comma that was *just typed* into the decimal point (`typedComma`). Before this fix, typing 12,50 became 1,250.
- **Don't round money with `Math.round` unless the amount is surely in pesos.** Use `roundAmt` (whole pesos, or cents in other currencies). Card payments in euros used to drop the cents.
- **Inputs need a font size of at least 16px**, or iOS zooms in when they're focused.
- **The keyboard resizes the visual viewport.** `main.tsx` sets `--app-h` and the `kb` class, and the tab bar hides while typing. Don't use `100vh`.
- **Desktop CSS** uses `:not(.page)` to keep sheet scroll bodies working; there was a specificity fight with `.page` scroll bodies.

## Store / data

- **Every DEV hook must be guarded** with `import.meta.env.DEV && typeof window !== 'undefined'`. Without the window check, vitest crashed with "window is not defined".
- **Sum spending with `myExpenses(d)`, `weekExpenses` or `monthExpenses`, never `d.expenses`.** Otherwise "this isn't mine" cards leak back into spending.
- **Pocket periods:** use `pocketStats` / `dayStats` / `monthStats` / `monthPlanOf` and `pocketCtx`. Never assume `c.weekStart` is the pocket's period, and never compute `weeklyStr * weeks`. A 15-day pocket's `dayStats().week` has 15–16 entries, not 7. For anything shown "per week", use `weekShare`, not `pocketStats` (that's the whole quincena). `dayStats().futureShare` already has today's overspend taken out, so don't add a negative `dayStats().left` on top.
- **Moves have both `week` and, since Nov 2026, `day`.** Older moves have no `day`; code must fall back (see `moveInPeriod`).
- **Income splits are linked to their income by `Move.income`.** Very old splits were matched by the shared id timestamp (`incomeMoves`). Don't break that fallback.
- **`loadPhotos` failures must keep cached friend photos.** An earlier version wiped them on any error.

## Firebase

- **The Firestore rules that Firebase uses live in the Firebase console**, and the owner pastes them in by hand. `docs/firestore.rules` is a copy of the published rules (saved Nov 2026). Nothing deploys it, so whenever the rules change, update it in the same commit and give the owner that whole file to paste.
  - The owner twice nested blocks wrongly (`messages` inside `items`, then `dms` inside `items`), which caused "permission-denied". Each time, give the complete rules file, not a snippet.
  - Collections in use:
    - `users/{uid}` with chunks
    - `profiles/{uid}`, which holds the `push` map
    - `emails/{email}`
    - `friendships/{a_b}`
    - `trips/{id}`, with `items`, `messages` and `media`
    - `dms/{pairId}`, with `messages` and `media`
- **For direct messages, the `dms/{pair}` document must exist before the first media is written.** The rules check that the person is a member of the parent document.
- **firestore/lite has no realtime updates.** Chats and trips only change when a poll or refresh runs.
- `social.ts` shows "Firebase refused this. Check that the new security rules were published." on `permission-denied`. That message almost always means the rules are out of date.

## Push / Cloudflare

- **workers.dev is blocked from the Claude sandbox**, so the Worker can't be tested live from here. Earlier sessions tested it with a throwaway Node script that wasn't saved in the repo: it imported the Worker with a fake KV and fetch, and checked the encryption by decrypting with the `http_ece` npm package. Recreate something similar if you change the Worker. The owner verifies it on the real phone.
- **If reminders don't arrive, it's usually the Cron Trigger.** It's missing, or set to `*/30`; it should be `*/5 * * * *`.
  - Use the Profile check panel. "overdue" means entries are more than 10 minutes late, i.e. the cron isn't running.
  - Then make sure the latest `cloudflare/pockets-push.js` is pasted in (it has `/status` and `/test`).
  - Owner setup steps that were confusing: where the KV binding goes (Settings → Bindings → KV namespace, variable name `SCHED`), and secrets vs plain variables (`VAPID_JWK` must be a secret).
- **iPhone only allows push** from the home-screen app on iOS 16.4 or newer, after the user taps to allow it.
- **The VAPID private key** lives only in the Cloudflare secret `VAPID_JWK`. The copy made when it was generated was in a temporary session folder and is gone, and Cloudflare won't show a secret again. If it's ever lost:
  - Generate a new P-256 key pair.
  - Put the private JWK in the secret.
  - Update `VAPID_PUBLIC` in `app/src/lib/push.ts`.
  - Every phone then has to turn notifications off and on again.
  - Never commit it.

## Spanish translator (`lib/i18n.ts`)

- **It matches whole text nodes.**
  - JSX like `Pays {x} from {y}` becomes separate nodes, and each fragment needs its own dictionary line. Fragments can produce awkward Spanish word order.
  - Prefer one template string, or a ternary between two full sentences (see `BgPicker`, the `DayPlanner` note).
- **Single letters are ignored** (fewer than 2 letters). Language-dependent letters such as weekday initials must use `getLang()` in code.
- **A trailing `" · "` isn't split.** `"Full amount · "` + amount needs a dictionary key `Full amount ·`.
- **Generic patterns** like `{0} of {1}` and `To {0}` also hit user text, so mark user content `translate="no"`.
  - Already marked: chat bubbles and transaction notes.
  - Not marked: pocket and account names. That's intentional, so default category names get translated.
- **Pattern order matters.** The first matching pattern wins, so keep generic ones at the end of `ES_PATTERNS`.
- **The tab bar's active pill** needs extra width in Spanish ("Presupuesto"), handled with a `getLang()` flex value in `App.tsx`.
- **The translator never runs in English.** If English text looks wrong, it's the source, not the translator.

## Testing

- **To find text still in English**, run the app with `pockets-lang=es`. Walk through the tabs and sheets with `__setUI`, collect every text node that isn't inside `[translate=no]`, and list the ones that still look English. That's how the Spanish gaps were found.
- **Playwright scripts live in the scratchpad**, not the repo.
  - Text selectors change in Spanish; for example the placeholder "Gym" becomes "Gimnasio".
  - Pick inputs carefully: the first input in the pocket editor is the hidden color picker.
- **The dev server dies when the session's worker restarts.** Restart it with `npx vite --port 5199` in the background.
- **Don't leave a stray `cat` reading stdin** in a shell chain. It hangs the command.
- **Reminder tests depend on the date window:** a December date is beyond the default 35 days, so pass `days`.
- **Some GitHub Pages deploys time out.** Re-run the workflow or push again.
- **One English word, one Spanish word:** `es.ts` translates a whole string the same way everywhere. If the same English word means two things ("Clear" the boxes vs. a "Transparent" photo background), use different English words, or one of them shows the wrong Spanish.
- **"Next" moves have `from === to`.** Anything that sums moves by `m.to === id` must skip `m.next` and count the arrival in the following period instead. For 15-day pockets, the month a next-move leaves is the quincena's month, not `moveMonth` (a quincena ending on the 30th can sit in a week whose Sunday is in the next month).
- **Carry is memoized per `Data` object** (`carryMemo` WeakMap). It relies on `Data` being replaced on every change, never mutated.
- **Phone swipes (`ui/swipe.ts`):** a left-edge swipe presses the top `[data-back]` button (sheet Close or a page's back arrow), so every new page's back button needs `data-back`. Sideways swipes switch tabs unless they start on something that scrolls sideways, a slider, a text box, an `svg` chart or `[data-noswipe]`; overlays that must block swipes carry `data-modal` (Cropper, lock screen).
- **Old quick-add data:** `forgetQuickAdd()` in `main.tsx` switches off a leftover Shortcut inbox and removes `settings.quickAdd`. It can be deleted once the owner has opened the app after 2026-11-10 and redeployed the Worker.
