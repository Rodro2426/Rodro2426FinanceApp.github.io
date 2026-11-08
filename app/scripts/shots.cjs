// Screenshots of chosen screens in every combination of theme and size, for a quick visual check.
//   node scripts/shots.cjs --places=tab:home,tab:budget,sheet:add --themes=light,dark --sizes=phone,desktop --lang=en --out=/tmp/shots
// Prints one line per screenshot, then any page errors. Exit code 1 if the page threw errors.
const fs = require('fs');
const { args, openApp, go } = require('./lib.cjs');

(async () => {
  const a = args({ places: 'tab:home', themes: 'light', sizes: 'phone', lang: 'en', out: './shots', url: 'http://localhost:5199/' });
  fs.mkdirSync(a.out, { recursive: true });
  let failed = false;
  for (const size of a.sizes.split(',')) for (const theme of a.themes.split(',')) {
    const { browser, page, errors } = await openApp({ url: a.url, size, theme, lang: a.lang });
    for (const where of a.places.split(',')) {
      try {
        await go(page, where);
        const file = `${a.out}/${a.lang}-${size}-${theme}-${where.replace(/[^\w-]+/g, '_')}.png`;
        await page.screenshot({ path: file });
        console.log('shot', file);
      } catch (e) { console.log('FAILED', where, size, theme, e.message.split('\n')[0]); failed = true; }
    }
    if (errors.length) { console.log(`page errors (${size}/${theme}):`, errors.join(' | ')); failed = true; }
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})();
