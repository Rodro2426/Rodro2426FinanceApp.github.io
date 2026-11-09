# Decisions

Key choices, with the reason behind each one. Newest topics are near the end of each section.

## Platform and hosting

- **A PWA on GitHub Pages, not a native app.** It's free, installs from Safari to the home screen, and the same code serves the desktop website. `useDesk()` switches to the sidebar layout at `(min-width:1024px) and (min-height:560px)`.
- **Vite `base: './'`**, because the site lives under a sub-path on Pages.
- **New versions load automatically.** iPhone home-screen apps can keep old builds, so every build writes `version.json` (`vite.config.ts`). `update.ts` checks it on open and on returning to the foreground, then reloads with `?v=<id>`.
- **The service worker (`public/sw.js`) caches nothing.** It only handles push and taps on notifications, so updates are never stuck behind a cache.

## Data and sync

- **The phone is the source of truth.** All data is one `Data` object in IndexedDB, and the app works offline.
- **The cloud copy is a second copy.** It is stored in `users/{uid}`, split into chunks of 700k characters because Firestore has a 1 MiB document limit.
- **Conflicts are chosen by the user.** When both sides changed, the user picks which copy to keep (`CloudSheet`); nothing is merged automatically.
- **`firebase/firestore/lite`, with no realtime listeners.** It keeps the bundle small and stays within the free Spark plan. Social screens poll or refresh instead. The owner asked about battery: polling only runs while the app is open.
- **Nothing is saved during the welcome screen or the practice tour** (`persistOn` in `store.ts`). The tour runs on a practice copy, and the real data is restored afterwards.

## Money logic

- **Pocket budgets are amounts per period.** The field is still called `weeklyStr` for backward compatibility. With `period: 'half'`, the amount is per quincena.
- **Quincenas are calendar halves (1–15, 16–end), not rolling 15 days.** That matches how Colombians are paid. A pocket can be weekly or every 15 days, and the owner chose per pocket rather than app-wide.
- **A 15-day pocket's share of a week:** this week counts only the days in the current quincena (today's amount plus each remaining spending day's share, up to Sunday or the quincena end). The next quincena's money isn't counted until it starts, because the owner hasn't been paid yet. A quincena overspend shows fully. Past weeks in Reports split each quincena's budget by spending days, and the current week's row is the same number as Home.
- **Moves (money between pockets and goals) never change account balances.**
  - Pocket → pocket only affects the current period; next period every pocket starts again from its own budget.
  - Weekly pockets match moves by `week` (its Monday). 15-day pockets match by `day`, the date the move was made; old moves fall back to the Sunday of their week.
- **Income split for the month** is spread over the remaining weeks. A 15-day pocket gets the weekly shares whose Sunday falls in its quincena, except the first share, which is anchored to the split day so "this week" money lands in the current quincena. This keeps month totals exact.
- **Mid-period start** is stored on the pocket as `start: { from, amt }`. It is a one-off override for that first period. `monthPlanOf` subtracts the difference only in that month.
- **Splitting one purchase across categories creates one expense per category**, sharing a `split` group id. Category reports then stay simple, and the account is charged once for the total.
- **"This isn't mine" (`Account.notMine`)** filters accounts out of net worth and the shortfall check. `myExpenses(d)` drops expenses paid with those accounts. Use `myExpenses` / `weekExpenses` / `monthExpenses`, not `d.expenses`, for anything that counts spending. The card itself still shows its full history and balance.
- **Custom colors are encoded in the hue number:** a hue ≥ 1,000,000 means the color `0xRRGGBB`. `tint`/`mid` return the hex, and `ink` picks readable text color by contrast. This kept the `hue: number` field without a data migration.

## Notifications

- **Cloudflare Worker for Web Push.** Sending pushes and running a schedule needs a server, and Firebase Cloud Functions need the paid Blaze plan; Cloudflare Workers (with cron and KV) are free at this size.
  - The Worker verifies the Firebase ID token itself, using Google's public keys.
  - It encrypts per RFC 8291 (aes128gcm) and signs VAPID with ES256 (RFC 8292).
  - Firebase and Cloudflare coexist: Firebase is for data and auth, Cloudflare only for push.
- **Subscriptions are stored in `profiles/{uid}.push`** as a map `deviceId → subscription`, so friends' apps can notify all of a person's devices.
- **Reminders are computed on the phone** (`reminders.ts`, the next 35 days) and uploaded to KV as `s:{uid}:{device}`, with metadata `{ next }`. The cron (every 5 minutes) only opens keys whose `next` is due, which keeps it within the KV free tier.
- **Default reminder times:** 09:00 the day before and 08:00 on the day, adjustable per scheduled item. Reminders are skipped for items whose time has already passed.

## Security and privacy

- **The Face ID lock is a WebAuthn platform passkey** (`lib/lock.ts`), because a web app can't call Face ID directly. It checks the "user verified" flag. It is a privacy lock and does not encrypt data. The config is stored in localStorage `pockets-lock` as `{ id, after }`.
- **Hiding amounts** uses localStorage `pockets-hide`. `fmt()` returns `$*****`, and MoneyInput shows stars until it's focused.
- **The public keys are bundled on purpose:** the Firebase config, GIPHY and Finnhub. The owner wanted friends not to have to set anything up.

## Spanish

- **A DOM translator instead of `t()` everywhere** (`lib/i18n.ts` + `lib/es.ts`). The app has about 1,800 English strings across 60 dense files, and wrapping each one was too invasive.
  - A MutationObserver swaps exact text, plus `placeholder`, `aria-label`, `title` and `alt`, using a dictionary.
  - `{0}` patterns handle dynamic sentences, and parts joined with `" · "` are translated one by one.
  - `confirm`/`alert` are wrapped.
  - Changing the language reloads the page.
- **What stays as typed:** user content marked `translate="no"` (chat messages, transaction notes).
- **Dates** use `dateLocale()`.
- **Code-level `getLang()` is used only where the DOM approach can't work:** single letters (weekday letters), the tab width, the Home "Bolsillos" heading (because "Pockets" is also the brand), and push reminder text via `tr()`.
- **Vocabulary:** Colombian Spanish with "tú". Pockets are "bolsillos" (as in Nequi), plus "arriendo", "cupo", "mecato". The brand stays "Pockets".
- **The default language is English.** Spanish is opt-in in Profile or on the welcome screen.

## UI

- **Photos are drawn with `<img>` (`Fill` in `ui/bits.tsx`), not CSS backgrounds.** See the gotchas.
- **Edit layout uses invisible movable blocks around the existing designs** (`ui/Blocks.tsx`). The owner explicitly didn't want the pockets' look changed.
- **The category picker shows the last 3 used plus search**, not every category as bubbles, as the owner asked.
