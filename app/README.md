# Pockets

Personal finance app built from the Claude Design handoff (`../project/Pockets v2.dc.html`).
React + Vite + TypeScript, mobile-first, installable as a home-screen web app.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static files in dist/
```

## Install on iPhone

Every push to `main` builds the app and publishes it with GitHub Pages
(`.github/workflows/pages.yml`) at https://rodro2426.github.io/Rodro2426FinanceApp.github.io/.
Open that link in **Safari**, tap **Share**, then **Add to Home Screen**.

Each person's data is saved only on their own phone (IndexedDB). Nothing is uploaded.

## How it's put together

- `src/screens/` — Home, Accounts, Budget, Insights and Calendar tabs.
- `src/sheets/` — every bottom sheet (new expense, pocket, move money, edit pocket, search,
  account history, edit/add account, pay card, savings goals, Excel export, profile/settings).
- `src/lib/store.ts` — app state, saved to IndexedDB on the device.
- `src/lib/derive.ts` — weekly pocket stats, account history with running balances, formatting.
- `src/lib/xlsx.ts` — the Excel workbook, loaded on demand (CSV fallback):
  - **For AI** — one page with the month's budgets, pockets week by week, categories, tags,
    accounts, goals, bills, money moved and largest expenses, plus a plain-language explanation,
    so you can send the file to any AI chat and ask questions about your month.
  - **Summary**, **Details**, **Card payments**, and **Statement** (single account only).
- `src/lib/aiSheet.ts` — builds the For AI page.
- `src/lib/interest.ts` — daily compound interest (% E.A.) for bank/savings accounts, like Nu's
  Cajitas: (1 + EA)^(1/365) − 1 per day, added once per day and logged as a monthly "Interest" entry.
- `src/lib/invest.ts` + `src/screens/Investments.tsx` — stock portfolio (Accounts → trend button):
  trades, average-cost holdings, a ring chart of allocation, live prices from Finnhub (free key
  pasted in Prices, kept on the device), USD→COP from open.er-api.com, prices you can type in,
  and a returns simulator.
- `src/ui/MoneyInput.tsx` — amount fields that show thousands separators while you type.
- `src/lib/schedule.ts` — scheduled income, bills and subscriptions (monthly, on a set day).
  Automatic ones add or take the money from their account on the day; the app catches up on
  any days it wasn't opened. It also builds notifications (due tomorrow, money received or paid,
  over budget, running low, card payment due), each shown once as a banner and kept in the
  bell list until dismissed. Notifications appear when the app is open; lock-screen alerts
  would need a push server.

## Notes

- Dates are real: "this week" is the current Monday–Sunday and pockets reset weekly.
- Sample data loads on first run. Profile (tap your avatar) has name, photo, currency, weeks per
  month, "Load sample data" and "Start fresh".
- Removing a pocket keeps its past expenses. Bills remember "paid" per month.
