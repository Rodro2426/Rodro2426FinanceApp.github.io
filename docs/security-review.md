# Pockets security review

The full review (Firestore rules, Auth, push Worker, XSS, device data, privacy law, dependencies) has not been written
yet. This file currently holds only the focused review of the uncommitted **Quick add** feature (2026-11-09).

## Quick add (Shortcut inbox)

**What it is.** An iPhone Shortcut adds expenses without signing in. It calls the push Worker at
`/q/<32-hex key>/(menu|add|items|ack|off)` (`cloudflare/pockets-push.js`, `quick()`). KV holds `qm:<key>` (pocket,
account and category names plus language, kept 400 days) and `qi:<key>:<id>` (waiting expenses, kept 30 days, max 50).
The key is the only lock. The app keeps the key in `Data.settings.quickAdd`.

**Summary for the owner.** The key is strong: 128 random bits from `crypto.getRandomValues`, so nobody can guess it.
One user's inbox can't be reached from another's. Chat-style injection isn't possible either, because React shows
inbox text as plain text. The real problem is cost and availability. The Worker's code is in a public repo, and
**anyone, with no key at all**, can make up random keys and use up the Cloudflare free plan's daily KV limits. Those
limits are 1,000 writes and 1,000 lists a day, shared with reminders. Once they run out, lock-screen reminders stop for
everyone until the next day. A second, smaller risk comes from someone who does get the key, for example because you
shared the Shortcut with a friend. That person can add fake expenses, and Pockets imports them automatically and
charges your account balance.

| ID | Severity | Status | Title |
|---|---|---|---|
| QA-1 | High (blocker) | Confirmed | Anyone without a key can use up the free KV write/list limits, which stops reminders |
| QA-2 | Medium (blocker) | Confirmed | The app's own polling uses one KV list per open/return, which competes with the cron's lists |
| QA-3 | Medium | Confirmed | A leaked key lets someone add up to 50 fake expenses at a time, up to 99,999,999,999 each, which are auto-imported and charge your account |
| QA-4 | Medium | Confirmed | Text amounts lose their decimal point ("25.50" becomes 2550) |
| QA-5 | Low | Confirmed | Places the key can leak: a shared Shortcut, the backup file, iCloud Shortcuts sync, the clipboard, Cloudflare request logs |
| QA-6 | Low | Confirmed | `off` works with GET and with any method; restoring an old backup brings back an old key |
| QA-7 | Info | Confirmed | CORS doesn't protect `/q` (and doesn't need to) |

### QA-1: Anyone can use up KV limits with made-up keys (High, blocker before shipping to friends)
- **Risk.** The route regex accepts *any* 32-hex string. Someone reads the public repo and runs a loop of
  `POST /q/<random>/add {"amount":1}`. Each request costs 1 KV list and 1 write, and `POST /menu` costs 1 write with
  a 400-day TTL. About 1,000 requests a day use up the free daily writes and lists. After that, `/schedule` can't save,
  and the cron's `list({prefix:'s:'})` fails, so nobody gets reminders. On a paid Workers plan this would cost money
  instead (Needs owner check: Cloudflare dashboard > Workers & Pages > Plans). Unauthenticated routes have no rate limit.
- **Where.** `cloudflare/pockets-push.js`, the `q` match in `fetch` and the `add`/`menu`/`items` branches of `quick()`.
- **Fix (Claude, in a coding session):**
  1. For `add`, `items`, `ack` and `off`, read `qm:<key>` first (a read costs little: 100k a day are free). If it's
     missing, return `{ ok:false }` before doing any list or write. A made-up key then costs one read and nothing else.
  2. Only the app should be able to create or overwrite the menu, so `POST menu` should require the Firebase ID token
     (`verifyFirebaseToken`). Also store the owner's `uid` in `qm:` and refuse a menu write from a different uid. If
     quick add has to work without an account, use an IP rate limit instead (step 3).
  3. Add a Cloudflare Rate Limiting binding to the `/q` routes, keyed by IP plus key, for example 20 requests a
     minute. This is free on Workers. Owner steps: Worker > Settings > Bindings > Add > Rate limiting.
  4. Cap `add` per key per day, for example 100, with the counter stored inside `qm:` or kept in memory.

### QA-2: Polling uses the list quota (Medium, fix together with QA-1)
- **Risk.** `App.tsx` calls `pullQuickInbox()` every time the app becomes visible, and each call is 1 KV `list`. The
  cron already uses at least 288 lists a day. A few friends switching apps 50 times a day can reach the 1,000-list limit
  by themselves.
- **Fix.** Avoid `list` in normal use. Keep the inbox as one value `qi:<key>` (an array of items), where `add` reads it,
  appends and writes, and `ack` reads it, filters and writes. Or keep a `pending` count inside `qm:` and have `items`
  run a list only when that count is above 0. Also limit `pullQuickInbox` in the app to once every 2 minutes, using
  a `pockets-qlast` localStorage time.

### QA-3: Someone with the key can corrupt balances (Medium)
- **Attack story.** A friend copies your shared Shortcut and posts 50 expenses of 99,999,999,999 COP. The next time
  you open Pockets they are imported as real expenses and your bank balance is charged. After the app acks them, the
  friend can do it again.
- **Where.** The `amt < 1e11` check in `quick()`; `importInbox` in `app/src/lib/quickadd.ts`.
- **Fix.** Lower the Worker's limit to something reasonable, for example below 1e9 for COP. In the app, import
  amounts over 5,000,000 as *pending* items that need a tap to confirm, rather than charging the account silently.
  Show a "From Shortcut" tag on imported expenses so fakes are easy to find. Explain in the sheet that turning quick
  add off and on again makes new links.

### QA-4: Decimal amounts in text (Medium, money correctness)
- `String(raw).replace(/[^\d]/g,'')` turns `"25.50"` into 2550 and `"1,5"` into 15. The current Shortcut steps send a
  JSON Number, so most people are fine, but anyone who picks Text gets a 100x expense. Fix: if the string has a single
  `.` or `,` followed by exactly 1–2 digits at the end, treat it as a decimal point. Otherwise strip the separators
  (COP style "50.000"). Add a vitest case.

### QA-5: Where the key can leak (Low)
- **Confirmed: it is in** the `users/{uid}` cloud copy (protected by the owner-only rules), the backup JSON file
  (`lib/backup.ts` saves the whole `Data`), the URLs saved inside the Shortcut (shared through iCloud when you use
  "Share Shortcut"), the clipboard after "Copy", and Cloudflare's request logs if Workers Logs is on (only you can see
  those).
- **Confirmed: it is not in** the Excel export or its "For AI" sheet (`aiSheet.ts` and `exportData.ts` don't read
  `settings.quickAdd`), and the Worker doesn't log it.
- **Fix.** Add a line to the sheet: "Don't share this Shortcut. If you want to share it, delete the two links first."
  You could leave `settings.quickAdd.key` out of backup files and make a new key after restoring.

### QA-6: Small things (Low)
- `off` deletes everything for any HTTP method, including GET. Make `off`, `ack`, `add` and `POST menu` accept POST
  only.
- Restoring an old backup brings back an old key that may have leaked, and the app's next `pushQuickMenu` makes it
  active again. After a restore, rotate the key.
- Account deletion and the logout plan should call `quickAddOff(key)` when the user deletes their account.

### QA-7: CORS (Info)
- `corsHeaders` only reflects the allowed origin, so other sites can't *read* the replies. A site could still send a
  `text/plain` POST without a preflight, because the Worker parses JSON whatever the content type is. That site would
  still need the key, and anyone who has the key can use curl anyway. The key is the real lock, and that's fine.
  Shortcuts sends no `Origin` header.

### Already good (keep it this way)
- The key has 128 bits from `crypto.getRandomValues` (`newQuickKey`), and the route only accepts 32 lowercase hex
  characters.
- KV prefixes are made from the full key followed by `:`, so one key can't list or delete another key's items.
- The cron only lists `s:`, so it never touches `qm:` or `qi:`.
- The key can't read balances or history: only names, plus the expenses that are still waiting.
- The Worker cuts pocket, note, account and category to 60–80 characters and sets item ids itself. `ack` only accepts
  `[a-z0-9]{1,30}`.
- Inbox text is shown through React as plain text. There is no `dangerouslySetInnerHTML` or `innerHTML` anywhere in
  `app/src`.
- Imports are idempotent: the expense id is `eq-<id>`, so collecting twice never doubles an expense.
- The GET body is never parsed (`body` is only read for POST).

### Status after fixes (2026-11-09)
- **QA-1 fixed:** every `/q` call first reads `qm:<key>`; an unknown key gets one read and nothing else (no list, no write). Creating or updating `qm:` (POST menu) needs a valid Firebase ID token, and the stored `uid` must match, so only the signed-in owner's phone can create an inbox.
- **QA-2 fixed:** the inbox is one KV value (`qi:<key>`), so the app's check is a single read; no KV `list` calls in `/q` at all. The app checks at most every 10 seconds.
- **QA-3 partly fixed:** at most 30 waiting expenses and 60 adds per key per day; amounts must be under 10,000 million. No tap-to-confirm for large amounts yet.
- **QA-4 fixed:** text amounts keep their decimals ("25.000" → 25000, "25.50" → 25.5, "25.000,50" → 25000.5, "1.234.567" → 1234567).
- **QA-6 fixed:** add, ack and off only accept POST. "Erase all data" turns quick add off. Restoring an old backup can still bring back an old key (low).
- Known trade-off: `add` and `ack` each read-modify-write the same KV value, so a Shortcut add landing in the same instant as the app's collect could be lost. Rare; KV has no atomic append on the free plan.
