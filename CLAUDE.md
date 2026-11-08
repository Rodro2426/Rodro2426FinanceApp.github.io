# Pockets

Personal-finance web app for one person in Colombia (COP) and their friends. It runs as an **iPhone home-screen app (PWA)** and as a **desktop website** from the same code.

- **Live:** https://rodro2426.github.io/Rodro2426FinanceApp.github.io/
- **Repo:** Rodro2426/Rodro2426FinanceApp.github.io. Pushing to `main` deploys automatically (`.github/workflows/pages.yml` builds `app/` and publishes `app/dist`).
- **Owner:** a non-developer who wants to learn. After each change, explain in plain words what was built and how it works.

More context lives in `docs/`:
- `docs/progress.md`: what's done, what's waiting on the owner, ideas for next.
- `docs/decisions.md`: key choices and why.
- `docs/gotchas.md`: bugs already hit, fragile areas, things that look wrong but aren't.
- `docs/firestore.rules`: a copy of the Firestore security rules published in the Firebase console.

The root `README.md` is the original Claude Design handoff note (`chats/` and `project/` hold that prototype). It does not document the app.

## What the app does

**Budget**
- A monthly income is split into **pockets**. Each pocket starts over every week (Mon–Sun) or every 15 days (1st–15th, 16th–end), chosen per pocket.
- Home shows what's safe to spend today, this week and this month.
- **Accounts:** bank, savings, cash and credit cards, with photos, card designs, interest (% E.A.), and a "this isn't mine" switch.
- **Scheduled items:** income, bills, subscriptions and card payments that repeat monthly. They can move money automatically and send reminders.
- **Insights and reports:** categories, budgets, net worth over time, and an Excel export that includes a "For AI" sheet.
- **Investments:** stocks (Finnhub prices), CDTs, investment funds (FICs, pension, cesantías), and custom asset/debt groups.

**With friends** (needs an account)
- Friends by email, shared trips with settle-up, trip chat, and direct messages, all with photos and GIFs.

**Account, sync and app-level features**
- Firebase account with cloud sync, plus backup to a file.
- Real lock-screen notifications through a Cloudflare Worker.
- Face ID lock, hide-amounts eye, dark mode, background color, editable layout blocks, and a practice tour.
- English or Spanish.

## Tech stack

- **App:** React 19, TypeScript, Vite 6, all in `app/`. No router and no CSS framework; styles are inline objects plus `src/styles.css`.
- **Data:** a single `Data` object (`src/lib/types.ts`) held in a small custom store (`src/lib/store.ts`). It is saved to IndexedDB with idb-keyval under the key `pockets-data-v1`, and the phone is the source of truth.
- **Firebase project `pockets-rodar`** (Spark, the free plan): Auth (email/password and Google) and Firestore. It uses **`firebase/firestore/lite` only**, so there are no realtime listeners; social features poll.
  - `users/{uid}`: the cloud copy of `Data`, in chunks (`cloud.ts`).
  - `profiles`, `emails`, `friendships`, `trips/{id}/items|messages|media`, and `dms/{pair}/messages|media` (`social.ts`).
- **Push:** a Cloudflare Worker, `cloudflare/pockets-push.js`, at https://pockets-push.santi-health.workers.dev. Web Push with VAPID, KV binding `SCHED`, cron `*/5 * * * *`. The app side is `src/lib/push.ts`, `src/lib/reminders.ts` and `public/sw.js`.
- **Outside services:**
  - Finnhub for stock prices.
  - GIPHY for GIF search.
  - datos.gov.co for the official TRM (dollar rate), in `lib/trm.ts`.
  - open.er-api.com for the dollar rate used with investments, in `lib/invest.ts`.
  - xlsx-js-style for Excel files.

## Layout of `app/src`

- `lib/`: logic with no UI. The most important files:
  - `derive.ts`: pocket, period, day and month numbers, and `fmt`.
  - `plan.ts`: month plan, income splits, moving leftovers, covering the shortfall.
  - `store.ts`, `cloud.ts`, `social.ts`, `schedule.ts`, `reminders.ts`, `push.ts`.
  - `i18n.ts` and `es.ts`: Spanish.
- `screens/`: the tabs and full pages (Home, Budget, Accounts, Calendar, Insights, Investments, Social, Welcome, Tour…).
- `sheets/`: bottom sheets, opened with `openSheet({ name, ... })`. The `name → component` switch is in `App.tsx`.
- `ui/`: shared pieces such as `bits.tsx` (PocketDot, BillBadge, Fill, Toggle…), `Desk.tsx` (desktop sidebar plus `useDesk`), Cropper, CategoryPicker, LockScreen and `charts.tsx`.

## Run and test

```bash
cd app
npm ci
npm run dev -- --port 5199        # dev server
npx tsc --noEmit -p .              # typecheck (also part of npm run build)
npx vitest run                     # unit tests (lib/*.test.ts, ui/*.test.ts), currently 127
npm run build                      # what CI runs
```

**Browser checks:** use Playwright against the dev server. There is no Playwright test suite; write a throwaway script in the scratchpad.
- Start from the welcome screen: dismiss the install dialog, tap "More ways to start", then "Try it with sample data".
- Block outside hosts with `page.route(...)`: github.io, finnhub, er-api, datos.gov, googleapis, firebaseapp, giphy, workers.dev.
- DEV-only hooks:
  - `window.__setUI({ tab, page, sheet })` and `window.__setData(patch)`.
  - `window.__sync(partial)`, which fakes the sync state.
  - `window.__social.set(partial, uid)`.
- Saved data can be read straight from IndexedDB: database `keyval-store`, store `keyval`, key `pockets-data-v1`.
- To test in Spanish, run `localStorage.setItem('pockets-lang','es')` in an init script.
- Reusable scripts in `app/scripts/` (dev server must be running):
  - `node scripts/shots.cjs --places=tab:home,sheet:editPocket --themes=light,dark --sizes=phone,desktop --lang=en --out=<dir>` takes screenshots.
  - `node scripts/es-gaps.cjs [--places=…]` lists text still in English when the app runs in Spanish.
  - Place names are documented in `scripts/lib.cjs`.

## Agents (`.claude/agents/`)

Use them to save tokens on repeated work. Each one returns a short report.

| Agent | When | What it does |
|---|---|---|
| `money-logic-reviewer` | Before shipping any change to money math: `lib/derive.ts`, `plan.ts`, `reports.ts`, `networth.ts`, `schedule.ts`, `reminders.ts`, `funds.ts`, `cdt.ts`, or screens that compute totals. Skip for design or text-only changes. | Checks the diff against the money rules in `docs/` and writes the missing vitest cases. |
| `spanish-gaps` | After a change adds or changes user-facing text. | Runs `es-gaps.cjs` and adds lines to `lib/es.ts`. Lists sentences that need a code change. |
| `ship-check` | When the code is done. Pass `places`, `sizes` and the full commit message with its footer. | Typecheck, tests, build, screenshots, commit, push, watch the deploy. Never fixes code. |
| `security-auditor` | Before inviting people beyond friends, or after changes to auth, sync, social, push, the service worker, backup, lock or logout. | Writes `docs/security-review.md`, covering Firestore rules, Auth settings, the Worker, XSS, device data, privacy law and dependencies. |

Usual order for a feature: build it → `money-logic-reviewer` (if money changed) → `spanish-gaps` → `ship-check`. Small fixes go straight to `ship-check`.

## Rules

- **Every change:** build, test (typecheck, vitest, and a Playwright look at the screen in light/dark and phone/desktop as relevant), commit, push to `main`, then watch the Pages deploy (`gh run list -L 1`, `gh run watch`).
- **Commit message footer** (no model names anywhere in commits or code):
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: <session link>
  ```
- **Never commit the VAPID private key.** It exists only as the Cloudflare secret `VAPID_JWK`. The public key in `push.ts` is fine.
- The Firebase web config, the GIPHY key (`chatMedia.ts`) and the Finnhub key are meant to be public in the app; the owner chose this.
- **User-facing text:**
  - Write it in English in the code, then add the Spanish line to `src/lib/es.ts`: `English|Spanish` in `ES_WORDS`, or a `{0}` pattern in `ES_PATTERNS`.
  - Keep each sentence one whole string. Text split across JSX expressions gets translated piece by piece.
- **Photos:** render them with `<Fill src=…>` (an `<img>`), never CSS `background-image`. See gotchas.
- Write simple, warm UI copy, Colombian context first: COP, TRM, CDT, quincena, Nequi-like "bolsillos".
- Do the Cloudflare and Firebase console steps with the owner. You can't reach workers.dev or the Firebase console from the sandbox, so give exact click-by-click steps and full code or rules to paste.
