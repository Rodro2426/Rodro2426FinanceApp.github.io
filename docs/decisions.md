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

- **Weeks are cut on the 1st (2026-11-27).** A weekly pocket's week is Monday to Sunday, but a week that crosses into a new month is split into two weeks, one in each month (`weekPart`/`weekParts` in `dates.ts`). Mon Nov 30 2026 is November's week 6 (1 day); Tue Dec 1–Sun Dec 6 is December's week 1. Before, the whole week belonged to the month of its Monday, so a month had 4 or 5 weeks and November paid 6 days that the December salary covers.
  - Each piece gets its share of the weekly amount by the pocket's spending days (`weekFraction`); the Monday piece is rounded and the other gets the rest, so the two always add up to exactly the weekly amount (`weekBase` in `derive.ts`).
  - A month's plan is the sum of its weeks: about weekly × days ÷ 7 (November 4.29 weeks, December 4.43, February 4). The Budget screen shows that number. Quincena and monthly pockets didn't change.
  - Labels say the days instead of "of N": "Week 5 (23–29)", "Week 6 (30)".
  - Moves count in the month of the day they were made (`m.day`; old moves fall back to `m.week`). Income spread over the weeks left, and "this month came in different" adjustments, are shared by days, so a 1-day week gets a day's worth.
- **Pocket budgets are amounts per period.** The field is still called `weeklyStr` for backward compatibility. With `period: 'half'`, the amount is per quincena.
- **Quincenas are calendar halves (1–15, 16–end), not rolling 15 days.** That matches how Colombians are paid. A pocket can be weekly or every 15 days, and the owner chose per pocket rather than app-wide.
- **A 15-day pocket's share of a week:** this week counts only the days in the current quincena (today's amount plus each remaining spending day's share, up to Sunday or the quincena end). The next quincena's money isn't counted until it starts, because the owner hasn't been paid yet. A quincena overspend shows fully. Past weeks in Reports split each quincena's budget by spending days, and the current week's row is the same number as Home.
- **Carry over is a running balance.** With the switch on, each period starts with its budget plus whatever the previous period ended with. Overspends carry too (the owner chose this), and it continues across month ends. It never changes the month income or the month plan; `monthStats` adds the carry that enters the month's first period. A one-time "next week" move is a move from the pocket to itself with `next: true`: −amt in the period it was made, +amt in the following one.
- **"Left to spend in pockets" only counts what is still ahead** (`pocketToSpend` in `plan.ts`): this period's leftover plus the periods still to come. A finished period's leftover is not promised any more (it is already in the accounts, so counting it again inflated the shortfall), and its overspend does not shrink later periods. With carry over on, past results already rolled into this period, so nothing is taken out. The Home "this month" card still uses `monthStats` (the whole month).
- **Moves (money between pockets and goals) never change account balances.**
  - Pocket → pocket only affects the current period; next period every pocket starts again from its own budget.
  - Moves match their period by `day`, the date the move was made. Old moves without it fall back to `week` (weekly pockets) or the Sunday of their week (15-day pockets).
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

## Debts

- **Debts are separate from trips.** Debts are between you and one person and live only in your own data, so they work without an account and the other person doesn't need Pockets. Trips are shared with a group in Firestore. A debt can link a friend (`Debt.friend` = uid) for the avatar and a Message button, but the friend doesn't see it.
- **Lending and borrowing are not spending or income.** They only move account balances (`lib/debts.ts`), so categories, pockets and cashflow stay honest. The spending is recorded when the money is actually used.
- **What you owe always lowers net worth; what you're owed is a switch** (`settings.owedInNetWorth`, off by default), because the owner wanted to choose whether lent money looks "lost".
- **Pockets follow the owner's rule:** lent money only hurts the pockets if it comes back after you need it. "Need it" = the card's next due date (`parseShortDate(card.due)`) when lent with a card, else the end of this month. Borrowed money due this month (or with no date) isn't spendable. This enters `monthSummary().balance`, so the existing real shortfall and Cover the shortfall do the adjusting.

## Credit cards

- **"Minimum payment" means what the cycle obliges you to pay**, and the app works it out; it is never typed. It is everything bought up to the last cutoff that isn't paid yet (`cardCycle().statement` in `lib/cards.ts`). The owner asked for this so a monthly scheduled payment charges nothing when nothing was bought last cycle. The app has no installments (cuotas), so it's the whole statement, not a bank's partial minimum. `Account.minPay` and `payMode: 'min'` are leftovers from one day when it was typed; both are ignored.

## UI
- **The add button is the bill's flower** (Nov 2026): the rosette from `public/tex/card-green.svg`, cut out as `public/flower.svg`, with a + in the same color, on a frosted glass disc (`.add-flower` in `styles.css`). The flower is a CSS mask, so its color comes from `--flower`, which is `--brand` (the loading logo's teal in light mode, mint in dark). The owner chose it over keeping the green ball. The pull-down logo above the page (`.brand-flower`) is the same flower, lines only, with no + and no background.
- **Clear glass cards everywhere (Nov 2026).** The owner picked see-through boxes (about 32% white, blurred) after comparing solid, frosted and clear mocks. Light mode adds a faint outline so boxes keep their shape on the plain sheet background. iPhones with Reduce Transparency get solid boxes.

- **Photos are drawn with `<img>` (`Fill` in `ui/bits.tsx`), not CSS backgrounds.** See the gotchas.
- **Edit layout uses invisible movable blocks around the existing designs** (`ui/Blocks.tsx`). The owner explicitly didn't want the pockets' look changed.
- **The category picker shows the last 3 used plus search**, not every category as bubbles, as the owner asked.
- **Bank logos come from Google's site-icon service** (`lib/logo.ts`): the account form takes the bank's website and saves `https://www.google.com/s2/favicons?domain=…&sz=128` as the account photo. Only the domain is sent. Google doesn't allow copying the image into the app (no CORS), so the address is saved, not the picture; icon.horse allows copying but often returns only a letter. A site with no logo gets a 16px globe back, which the app rejects.
- **Apple Pay purchases come back through the Shortcut inbox (2026-11-16).** The owner removed the manual quick add on 2026-11-10, then asked for Apple Pay purchases to be added on their own. An iPhone "Transaction" automation asks for the pocket right after paying (the owner chose this over guessing the pocket) and posts amount, store and card to the same Worker inbox. Web apps can't read Wallet; Apple's FinanceKit is native-only and covers only Apple's own US cards.
- **Quick add uses an inbox, not Firestore.** An iPhone Shortcut can't sign in to Firebase safely, so it posts to the Worker with a long random key (the only lock). The key can add expenses and read pocket/account/category names, nothing else. Items wait in KV (max 50, 30 days) until the app collects them; each becomes expense `eq-<id>`, so collecting twice never doubles one.
- **New accounts get a real setup, not the practice tour (2026-11-16).** The tour stays in Profile and as a link on the setup's first card. The setup's look is dark on purpose in both themes (the owner chose "Aura" from three mocks).
- **Glass cards no longer blur live (2026-11-16).** The owner asked for a faster feel. Measured with a 4× slowed browser: one swipe + sheet + scroll dropped 10–11 frames with every card blurring the background, 1 without (the blur's strength made no difference, the number of blurred layers did). Cards keep the see-through look with a more solid fill (light 58% white, dark 72%); only the tab bar, the + button and the banner still blur.

## Apple Pay cards

- **A Wallet card Pockets doesn't recognize is never guessed** (Nov 2026, owner's rule). Its purchase is saved with no account (nothing charged), the card is remembered as not linked (`quickAdd.cards[name] = ""`), and one "New card" notice per card asks which account it is (or creates a new one). The answer applies to its next purchases, and by default also to the ones already waiting (`linkCard` in `lib/quickadd.ts`). A card is recognized when it was linked before or its name contains an account's name. A purchase with no card name at all is also saved with no account. The old "Pay from, for a new card" setting (`quickAdd.acct`) is gone.
