// Shared helpers for the browser scripts in this folder (used by the ship-check and spanish-gaps agents).
// Needs the dev server running: `npm run dev -- --port 5199` in app/. Needs Playwright (preinstalled in Claude's cloud
// sessions; elsewhere: `npm i -D playwright && npx playwright install chromium`).
const { chromium } = require('playwright');

/** Outside services are blocked so tests never touch real data or quotas. */
const BLOCK = /^https:\/\/[^/]*(github\.io|finnhub|er-api|datos\.gov|googleapis|firebaseapp|firebasestorage|giphy|workers\.dev)/;

function args(defaults) {
  const out = { ...defaults };
  for (let i = 2; i < process.argv.length; i++) {
    const m = /^--([\w-]+)=(.*)$/.exec(process.argv[i]);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/** Opens Pockets with the sample data loaded, at phone or desktop size, in light or dark, English or Spanish. */
async function openApp({ url = 'http://localhost:5199/', size = 'phone', theme = 'light', lang = 'en' } = {}) {
  const browser = await chromium.launch();
  const desk = size === 'desktop';
  const ctx = await browser.newContext(desk
    ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: theme }
    : { viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: theme });
  await ctx.addInitScript(l => { try { localStorage.setItem('pockets-lang', l); } catch { /* ignore */ } }, lang);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route(BLOCK, r => r.abort());
  await page.goto(url);
  await page.waitForTimeout(2500);
  // Install guide (phone) and welcome screen → sample data.
  await page.locator('[role=dialog] button').last().click({ timeout: 1500 }).catch(() => {});
  if (desk) await page.locator('summary').first().click({ timeout: 3000 }).catch(() => {});
  else await page.getByText(/More ways to start|Más formas de empezar/).first().click({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.getByText(/Try it with sample data|Probar con datos de ejemplo/).first().click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  for (let k = 0; k < 4; k++) await page.locator('.banner button[aria-label]').last().click({ timeout: 800 }).catch(() => {});
  await page.evaluate(t => window.__setData(x => ({ settings: { ...x.settings, theme: t } })), theme);
  await page.waitForTimeout(300);
  return { browser, page, errors };
}

/**
 * Goes to one place in the app. Names:
 *   tab:home | tab:budget | tab:accounts | tab:calendar | tab:insights
 *   page:investments | page:social | page:<any ui.page value>
 *   sheet:<name>  e.g. sheet:add, sheet:settings, sheet:editPocket (id null), sheet:schedule (id null)
 *   sheet:<name>:<id>  e.g. sheet:pocket:groc, sheet:acct:<accountId>
 */
async function go(page, where) {
  const [kind, name, id] = where.split(':');
  if (kind === 'tab') await page.evaluate(n => window.__setUI({ tab: n, page: null, sheet: null }), name);
  else if (kind === 'page') await page.evaluate(n => window.__setUI({ page: n, sheet: null }), where.slice(5));
  else if (kind === 'sheet') await page.evaluate(([n, i]) => window.__setUI({ sheet: { name: n, id: i ?? null } }), [name, id]);
  else throw new Error('Unknown place: ' + where);
  await page.waitForTimeout(700);
}

module.exports = { args, openApp, go };
