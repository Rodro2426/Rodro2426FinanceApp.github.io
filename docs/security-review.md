> **Note (2026-11-10):** quick add from iPhone was removed. The section below is kept for history only.

# Pockets security review

The full review (Firestore rules, Auth, push Worker, XSS, device data, privacy law, dependencies) has not been written
yet. This file holds focused reviews: **Shared debts** (2026-11-12) and the removed **Quick add** feature (2026-11-09).

## Shared debts (review of the uncommitted feature, 2026-11-12)

**What it is.** When you save a debt with a friend, `syncDebts` (`app/src/lib/social.ts`) writes `debts/{id}` with
`users` (2 uids, sorted), `from`, `owedBy`, `owedTo`, `names`, `amt`, `date`, `due`, `note`, `pays`, `status`,
`createdAt` and `updatedAt`. The friend accepts or declines. After that, the newest edit by either person wins
(`planDebtSync` in `app/src/lib/debtShare.ts`). Account ids are never shared.

**Summary for the owner.** The new debts rule keeps the doc between the two people, and the sender can't accept a
request for the other person. Three real problems remain, though. First, a stranger who knows your email can fake a
"friendship" and send you debts. They can also open a DM with you. This is an old hole in the friendships and DMs
rules, and the new rule depends on it. Second, after you accept, your friend can change the amount or a payment, and
Pockets then changes **your own account balance** to match. Third, signing in on a new phone (or again after logging
out) can delete every shared debt from the cloud before your data has downloaded. Fix SD-1 to SD-3 before shipping to
friends.

| ID | Severity | Status | Title |
|---|---|---|---|
| SD-1 | Critical (blocker) | Confirmed | Fake friendships: a stranger can send you debts (and DMs) |
| SD-2 | High (blocker) | Confirmed | A friend's edit to the amount or a payment changes your own account balance |
| SD-3 | High (blocker) | Confirmed | Signing in on an empty phone deletes all shared debts from the cloud |
| SD-4 | Medium (blocker) | Confirmed | No type or size checks: huge notes, thousands of payments, or bad values can crash the other person's app |
| SD-5 | Medium | Confirmed | Sender can flip a declined debt to accepted; status isn't limited; `updatedAt` can be set in the future |
| SD-6 | Medium | Confirmed | Changing "They owe me / I owe them" on a shared debt starts a write war that never settles |
| SD-7 | Low | Confirmed | Your private nickname for the friend is stored in the shared doc; the note is shared without saying so |
| SD-8 | Low | Confirmed | Either person can delete, and editing doesn't re-check the friendship |

### SD-1: Fake friendships (Critical)
**Risk.** The debts rule checks `friendships/{users[0]_users[1]}`, which is right as far as it goes. The problem is
the friendships rule (`docs/firestore.rules`, `match /friendships/{id}`). It doesn't tie the doc id to the people in
it, doesn't limit `users` to 2, and lets the "other" person in `users` set any field. **Attack story:** a stranger
looks up your email (`emails/{email}` gives your uid). They create `friendships/{yourUid_theirUid}` with
`users: [theirUid, theirSecondAccount]`, then accept it from the second account. That doc now says `accepted`, so the
debts rule lets them send you a debt named "DIAN" or "Bancolombia" with a note like "call this number". The DM rule
has a similar gap: `dms/{pairId}` checks the friendship at `pairId` but never checks that `pairId` belongs to the
people in `users`. Anyone with one real friend can open a DM with anyone.
**Unsorted `users` on a debt:** if you send `[b, a]`, the rule looks up `b_a`. That doc doesn't exist, so `get()`
fails and the write is denied. Unsorted ids are only dangerous because of the fake-friendship hole above. The fix
binds both.
**Fix (owner pastes in console; Claude updates `docs/firestore.rules`):** use the full block below.

### SD-2: A friend can move your account balance (High)
**Risk.** If you lent 50,000 from Nequi, the debt holds `acct`. `pull()` (`debtShare.ts`, function `pull`) takes the
friend's `amt` and `pays[].amt`, and `syncDebts` saves it with `saveDebt` (`lib/debts.ts:46`). That re-applies
`applyDebt` with your `acct`. **Attack story:** a friend edits the amount to 5,000,000, and your Nequi balance drops by
5,000,000 on your next open. A pay `amt` of `"abc"` makes your balance `NaN`.
**Fix (Claude):** when pulling, never let the friend's numbers move your accounts. Keep the account effect of the
original amount and of your own payments (the ones with `acct`). Show the friend's change as "Juan changed this debt
from X to Y" with Accept/Undo. Clamp pulled values (`amt` a finite number from 1 to 1e11, pays at most 200, each pay
`amt > 0`, total pays no more than `amt`). Rules can't check each payment, so the app must.

### SD-3: Empty phone deletes everything (High)
**Risk.** `useSync` sets `uid` (`cloud.ts:191`) before the cloud copy is downloaded, and while a conflict choice is on
screen. 1.2 s later `syncDebts` runs with no local debts. `planDebtSync` then puts **every** doc you sent, and every one
you accepted, into `deletes` (the last loop in `planDebtSync`). Your friends' copies turn to "no longer shared".
**Fix (Claude):** run `syncDebts` only after a successful first cloud pull (`syncedAt > 0`, no `conflict`, status not
`syncing`). Never delete on "missing locally". Delete only for debts you deleted on purpose (keep a short list of
deleted shared ids in `Data`).

### SD-4: No limits (Medium)
**Risk.** Nothing limits `note`, `names`, `pays`, `date` or extra fields, and nothing checks their types. A friend can
store a doc of about 1 MB, or 20,000 payments. It is read on every open and every return to the app, and it slows or
freezes your phone. A non-string in `names[from]` (for example a map) is rendered as a React child in the request card
(`screens/Debts.tsx`), and the app has no error boundary, so the screen goes white. Text is rendered as React text
only (no `innerHTML`), so there's no script injection.
**Fix:** `debtOk()` in the block below, plus clamping in the client (SD-2).

### SD-5: Status and clock (Medium)
**Risk.** The update rule only protects `pending`. Once a debt is `declined`, the sender can set it to `accepted`, or
to any made-up string. `updatedAt` is a client number, so setting it to the year 2100 means "my version always wins"
and your edits are overwritten forever. A phone whose clock runs fast causes the same thing by accident. **Fix:** the
block below allows only pending to accepted/declined, by the receiver only, and caps `updatedAt` at server time +5 min.

### SD-6: Direction write war (Medium, Firestore quota)
**Risk.** `DebtSheet` lets you change direction on an existing shared debt. `pull()` doesn't copy `owedBy` or `owedTo`
back to `dir`, so the two phones never agree. Each side then rewrites the doc on alternate syncs, which wastes writes
and keeps flipping the other person's view. It isn't an endless tight loop, because the `debtKey` effect only fires
when local shared fields change. **Fix:** after creation, `owedBy` and `owedTo` can't change (rule below). Hide the
direction switch for shared debts (Claude).

### SD-7 / SD-8: Privacy and delete (Low)
- `newDebtDoc` puts `x.name` (whatever you call your friend, for example "Juan el tacaño") into `names[other]`, and the
  friend can read it. Use their profile name instead. Add one line under the note field: "Juan will see this note."
- Either person can delete the doc. That's acceptable: the other side keeps a local copy marked "gone". The update
  rule doesn't re-check the friendship, so after an unfriend both people can still edit. Low risk, and the block
  below re-checks it.
- Reads: each sync reads every debt doc you're in. That's fine at friend scale. A stranger can't add docs once SD-1 is
  fixed.

### Rules to paste (replaces `match /friendships/{id}`, the top of `match /dms/{pairId}`, and `match /debts/{debtId}`)
Put the two helper functions next to `signedIn()`. Test them in the Rules Playground before you publish. Ternaries
are supported in `rules_version = '2'`.
```
    function pairOf(u) { return u[0] < u[1] ? u[0] + '_' + u[1] : u[1] + '_' + u[0]; }
    function friends(u) { return get(/databases/$(database)/documents/friendships/$(pairOf(u))).data.status == 'accepted'; }

    match /friendships/{id} {
      allow read: if signedIn() && (resource == null || request.auth.uid in resource.data.users);
      allow create: if signedIn()
        && request.resource.data.from == request.auth.uid
        && request.resource.data.users is list && request.resource.data.users.size() == 2
        && request.auth.uid in request.resource.data.users
        && request.resource.data.users[0] != request.resource.data.users[1]
        && id == pairOf(request.resource.data.users)
        && request.resource.data.status == 'pending';
      allow update: if signedIn()
        && request.auth.uid in resource.data.users
        && request.auth.uid != resource.data.from
        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status'])
        && request.resource.data.status == 'accepted';
      allow delete: if signedIn() && request.auth.uid in resource.data.users;
    }

    match /dms/{pairId} {
      allow read: if signedIn() && request.auth.uid in resource.data.users;
      allow create, update: if signedIn()
        && request.auth.uid in request.resource.data.users
        && request.resource.data.users.size() == 2
        && pairId == pairOf(request.resource.data.users)
        && get(/databases/$(database)/documents/friendships/$(pairId)).data.status == 'accepted';
      // ... keep the messages and media blocks as they are
    }

    match /debts/{debtId} {
      function debtOk(d) {
        return d.keys().hasOnly(['users','from','owedBy','owedTo','names','amt','date','due','note','pays','status','createdAt','updatedAt'])
          && d.users is list && d.users.size() == 2 && d.users[0] < d.users[1]
          && d.from in d.users
          && d.owedBy in d.users && d.owedTo in d.users && d.owedBy != d.owedTo
          && d.names is map && d.names.keys().hasOnly(d.users)
          && d.names.get(d.users[0], '') is string && d.names.get(d.users[0], '').size() <= 60
          && d.names.get(d.users[1], '') is string && d.names.get(d.users[1], '').size() <= 60
          && d.amt is number && d.amt > 0 && d.amt <= 100000000000
          && d.date is string && d.date.size() <= 10
          && (d.due == null || (d.due is string && d.due.size() <= 10))
          && (d.note == null || (d.note is string && d.note.size() <= 300))
          && d.pays is list && d.pays.size() <= 200
          && d.status in ['pending', 'accepted', 'declined']
          && d.createdAt is int && d.updatedAt is int
          && d.updatedAt <= request.time.toMillis() + 300000;
      }
      allow read: if signedIn() && request.auth.uid in resource.data.users;
      allow create: if signedIn()
        && debtOk(request.resource.data)
        && request.resource.data.from == request.auth.uid
        && request.resource.data.status == 'pending'
        && friends(request.resource.data.users);
      allow update: if signedIn()
        && request.auth.uid in resource.data.users
        && debtOk(request.resource.data)
        && request.resource.data.users == resource.data.users
        && request.resource.data.from == resource.data.from
        && request.resource.data.owedBy == resource.data.owedBy
        && request.resource.data.owedTo == resource.data.owedTo
        && request.resource.data.createdAt == resource.data.createdAt
        && friends(resource.data.users)
        && (request.resource.data.status == resource.data.status
            || (resource.data.status == 'pending'
                && request.auth.uid != resource.data.from
                && request.resource.data.status in ['accepted', 'declined']));
      allow delete: if signedIn() && request.auth.uid in resource.data.users;
    }
```
Note: the friendship `update` now only allows `status` to become `accepted`. That matches `acceptFriend` and
`addFriendByEmail` today. Fake friendship docs that already exist, if any, aren't removed by the new rule. Ask Claude
to add a check that ignores friendships whose id isn't `pairOf(users)`.

### Playground tests (who → path → action → expected)
- A (friend of B) → `debts/x`, create with sorted users [A,B], status pending → allow
- A → create with users [B,A] (unsorted) → deny
- A (not a friend of C) → create with users [A,C] → deny
- A → create with status `accepted` → deny
- A (sender) → update pending→accepted → deny; B → pending→accepted → allow
- A → update declined→accepted → deny
- B → update `owedBy` swap, or change `users`/`from` → deny
- A → create with note of 301 chars, or 201 pays, or an extra field → deny
- A → update with `updatedAt` = year 2100 → deny
- C → get `debts/x` (users [A,B]) → deny; C → list with `array-contains C` → only C's docs
- A → create `friendships/A_C` with users [A,X] → deny; X → update status on a doc where X is `from` → deny
- A → create `dms/A_B` with users [A,C] → deny

### Already good
- Read is only for the two uids, and the client query (`array-contains` uid) matches the rule.
- `from` and `users` can't change after creation. The sender can't accept while the debt is pending.
- No account ids leave the phone (`sharedFields`).
- All debt text is rendered as React text (template strings and `{...}`), with no `innerHTML`.
- `syncDebts` has a re-entry guard (`debtSyncing`), and `debtKey` excludes `share`/`sync`, so saving the sync result
  doesn't trigger another sync.
- Failed writes aren't marked as shared, so they're retried.

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
