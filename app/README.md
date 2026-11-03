# Pockets

Personal finance app built from the Claude Design handoff (`../project/Pockets v2.dc.html`).
React + Vite + TypeScript, mobile-first, installable as a home-screen web app (PWA).

## Run it

```bash
npm install
export ANTHROPIC_API_KEY=sk-ant-...   # only needed for the Assistant tab
npm run dev                            # app on http://localhost:5173, API on :8787
```

Production:

```bash
npm run build
ANTHROPIC_API_KEY=sk-ant-... npm start  # serves dist/ and /api on http://localhost:8787 (PORT to change)
```

Open it on your phone and use "Add to Home Screen" to install it.

## How it's put together

- `src/screens/` — Home, Accounts, Budget, Insights, Assistant tabs.
- `src/sheets/` — every bottom sheet (new expense, pocket, move money, edit pocket, search,
  account history, edit/add account, pay card, goal, Excel export, profile/settings).
- `src/lib/store.ts` — app state; data is saved to IndexedDB **on this device only**.
- `src/lib/derive.ts` — pocket stats per week, account history with running balances, formatting.
- `src/lib/xlsx.ts` — the monthly Excel workbook (Summary · Details · Card payments · Statement),
  bundled locally and loaded on demand. Falls back to CSV if it fails.
- `src/lib/assistant.ts` — runs Claude's tool calls (add expense, create pocket, set budget,
  set income, move money, create goal) against your local data.
- `server/index.ts` — keeps the API key server-side and forwards chat to Claude
  (`claude-opus-5-5`, adaptive thinking, low effort, server-side refusal fallback).
- `shared/assistant.ts` — system prompt and tool schemas, shared by app and server.

## Differences from the prototype

- Dates are real: "this week" is the current Monday–Sunday, pockets reset weekly, the month
  label, week number, bill due dates and "last week" comparison come from the calendar.
- Sample data (5 pockets, 5 accounts, ~60 transactions last month) loads on first run.
  The profile button opens a new **Profile** sheet with name, photo, currency, weeks per
  month, voice language (the prototype's Tweaks panel) plus "Load sample data" / "Start fresh".
- Removing a pocket keeps its past expenses (the prototype deleted them).
- Bills are monthly: "paid" is remembered per month.
- The server answers only `/api/chat` with a fixed prompt and tool set, so it is not an open
  proxy, but it has no login: don't expose it publicly without adding auth.
