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

- `src/screens/` — Home, Accounts, Budget, Insights tabs.
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

## Notes

- Dates are real: "this week" is the current Monday–Sunday and pockets reset weekly.
- Sample data loads on first run. Profile (tap your avatar) has name, photo, currency, weeks per
  month, "Load sample data" and "Start fresh".
- Removing a pocket keeps its past expenses. Bills remember "paid" per month.
