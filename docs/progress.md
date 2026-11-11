# Progress

Last updated: 2026-11-08. Everything in "Done" is deployed to GitHub Pages.

## Done

**Core budget**
- Monthly income split into pockets, with Home showing what's safe to spend today, this week and this month.
- Spending days per pocket, with a daily allowance.
- Moving leftovers (pocket → pocket, pocket → goal, or "cover the shortfall"). Moves can be edited or undone.
- Extra income can be split into pockets for this week or for the rest of the month. These splits are linked to the income they came from, and a review sheet catches mismatches.
- **Per-pocket period:** every week, or every 15 days (1–15 / 16–end).
- **Week view of 15-day pockets:** "Safe to spend this week" on Home and the weekly rows in Reports count only a 15-day pocket's share of the Mon–Sun week (`weekShare` in `derive.ts`, `budgetWeeks` in `reports.ts`). Move leftover: tap a pocket or goal's name to send it the whole leftover.
- **Phone swipes:** the screen follows your finger. Swipe from the left edge to slide the page or sheet away and go back; swipe left or right on a main tab and the next tab slides in; drag along the tab bar and a highlight follows your finger, letting go opens that tab.
- **Insights redesign:** the tab shows Spent this month, two cards (Categories, Reports), Bills and Tags with the first 3 and "See all", This week vs last week, and the savings tip. **Categories hub** (`screens/Categories.tsx`, page `categories`): the filterable category table plus "Your categories" to create categories, add or remove subcategories, and delete categories (deleting only removes it from the list; old expenses keep it). Open a category to rename it (a name that already exists merges the two), rename subcategories, and tick its transactions to move them to another category or subcategory (`lib/categories.ts`). Income categories are editable there too (`Data.incCats`, missing = `INCOME_CATS`); charts still show a deleted one while incomes use it. **Reports page** (page `reports`) lists the 13 charts; back from a chart returns there.
- **Carry over:** a per-pocket switch (Edit pocket) carries what's left, or overspent, into the next week or quincena, across month ends too (`Pocket.carry`, `carryInto` in `derive.ts`). Move leftover also has a one-time "Next week" / "Next quincena" destination (`Move.next`, `NEXT` in `plan.ts`). Move leftover and New income have tap-to-send-all and percent sliders.
- **Starting partway through a period:** a new pocket created mid-week or mid-quincena gets a first-period amount, suggested from the days left. The owner can edit it or pick the full amount. The next period gets the real budget.
- Savings goals.

**Transactions**
- Add expense or income, then edit or delete it.
- Category picker: search, the last 3 used, and create. Subcategories can be added.
- Split one purchase across several categories. Each part is its own expense sharing a `split` id, and the account is charged once.
- Tags, and search.

**Accounts**
- Bank, savings and cash accounts, plus credit cards.
- Photos and colors: 12 hues, any color code, or a full palette.
- Card design photos, with a card-shaped cropper that snaps to center.
- Interest (% E.A.) added daily.
- Card payments.
- **"This isn't mine"** switch: the account is left out of net worth, and what's paid with it doesn't count as the owner's spending.

**Scheduled items**
- Income, bills, subscriptions and card payments that repeat monthly.
- They can run automatically or just be reminders, and can be in USD (converted with the TRM).
- "Not paid by me" option.
- Logos for each item.
- A per-item time for the day-before and on-the-day reminders.

**Notifications**
- In-app bell.
- **Lock-screen push** through the Cloudflare Worker: friends' messages and expenses (worded like a messaging app), and scheduled reminders. The owner confirmed on the phone (Nov 2026) that the cron runs every 5 minutes and reminders arrive.
- A check panel in Profile: status, "Send a test", "Send reminders now".

**Insights**
- Category table, by pocket, by tag, and bills.
- Reports: compare categories, net worth over time, balances, cashflow, budgets, pie charts.
- Excel export, including a "For AI" sheet.

**Investments**
- Stocks with live Finnhub prices (built-in key).
- CDTs, with popular Colombian bank presets.
- Investment funds.
- Returns simulator.
- Custom asset and debt groups that can count in net worth.

**Debts with one person** (Friends & trips → Debts; works without an account)
- "Someone owes me" (lent, or paid for them) and "I owe someone", with a person (optionally a friend), amount, account, date and pay-back date.
- Partial or full paybacks into any account; edit and delete undo the account changes.
- Never counted as spending or income. Shows in the account's history.
- Net worth: what you owe always counts; a switch counts what people owe you.
- Pockets: money owed to you counts if it comes back before you need it (the card's due date when lent with a card, else the end of the month); what you owe counts if due this month. "Adjust my pockets" opens Cover the shortfall.
- Friends & trips page redesigned: money summary on top, then Debts / Trips / Friends tabs, each with a one-line purpose. Friends show what they owe you and have a "Debt" button. Home has a "Friends & trips" block.

**Social** (needs a Firebase account)
- Friends by email (verified emails only).
- Shared trips with settle-up in the fewest payments.
- People can be added to existing trips, guests can be linked to accounts, and past expenses can be split again.
- Trip chat and direct messages, with photos (thumbnail plus full size) and GIFs (built-in GIPHY key).
- Friends' profile pictures.

**Account and safety**
- Firebase sign-in (email or Google) with cloud sync, including a conflict chooser.
- Log out, which clears the device.
- Backup and restore to a file, with a monthly backup reminder.
- Face ID lock: a passkey, with the Pockets password or Google as fallback, and a lock delay. All three were checked by the owner on the real phone (Nov 2026).
- Eye toggle to hide amounts, including in input boxes.

**Look and feel**
- Dark mode, custom background color, and a status bar that follows the theme.
- Edit layout: blocks can be reordered or hidden on each main page.
- Foldable sections in Accounts.
- Desktop website: sidebar layout at ≥1024px wide, plus a landing page and sign-in.
- iPhone install guide, practice tour, and automatic reload when a new version is deployed.
- **Spanish** (Profile → Language, or the switch on the welcome screen).
- Photos are drawn as `<img>` (fixes logos that didn't refresh until a restart).

## Waiting on the owner (not confirmed yet)

Nothing right now. Scheduled reminders and the Face ID lock were confirmed on the phone, and the Firestore rules are saved in `docs/firestore.rules` (Nov 2026).

## Next / ideas (not started)

- Known limits left by recent features:
  - The Excel "For AI" weekly table computes pocket budgets by hand: it ignores carry over and 15-day periods (it does count one-time next-week moves).
  - The Excel/"For AI" export is English only.
  - Friends' notifications are worded in the sender's language.
  - Sample-data pocket names show in Spanish on Home but in English in the Budget edit boxes (they're stored data).
- Add Spanish lines for any new text (the translator leaves unknown text in English).
- Possibly add a "not mine" note on the Home recent list for expenses paid with someone else's card.
