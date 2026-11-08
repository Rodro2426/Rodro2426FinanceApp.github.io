// Finds text that is still in English when the app runs in Spanish.
//   node scripts/es-gaps.cjs                      (all main places)
//   node scripts/es-gaps.cjs --places=tab:home,sheet:editPocket
// Prints each untranslated text once, with where it was seen. Text inside [translate=no] (chats, notes) is skipped,
// and so are amounts, dates, and brand or proper names listed in KEEP.
const { args, openApp, go } = require('./lib.cjs');

const ALL = [
  'tab:home', 'tab:budget', 'tab:accounts', 'tab:calendar', 'tab:insights', 'page:investments', 'page:social',
  'sheet:add', 'sheet:settings', 'sheet:search', 'sheet:notifications', 'sheet:schedule', 'sheet:editPocket', 'sheet:addAcct',
  'sheet:newGoal', 'sheet:cloud', 'sheet:export', 'sheet:priceSettings', 'sheet:pocket:groc', 'sheet:move:groc', 'sheet:cover', 'sheet:reconcile'
];
/** Names that are right as they are in Spanish too. */
const KEEP = /^(Pockets|Excel|English|Español|Netflix|Spotify|Internet|Bancolombia|Nu Cajita|Visa Gold|Mastercard Black|Sofía|Uber|Rappi|DiDi|Cabify|TuLlave recarga|Terpel gas|Éxito|Carulla|Juan Valdez|GIPHY|Finnhub|TRM|CDT|CDTs|COP|USD|E\.A\.|Fiducuenta|Trii|iPhone|Face ID|Touch ID|Google|OK|Total|General|Manual|Chat|GIF|Gas|Color|Normal)$/;

(async () => {
  const a = args({ places: ALL.join(','), url: 'http://localhost:5199/' });
  const { browser, page, errors } = await openApp({ url: a.url, lang: 'es' });
  const seen = new Map();
  for (const where of a.places.split(',')) {
    try { await go(page, where); } catch (e) { console.log('could not open', where); continue; }
    const found = await page.evaluate(() => {
      const out = [];
      const skip = n => n.closest('[translate=no],script,style');
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.nodeValue.trim(); if (t && !skip(n.parentElement)) out.push(t); }
      document.querySelectorAll('[placeholder],[aria-label],[title]').forEach(el => {
        if (skip(el)) return;
        for (const k of ['placeholder', 'aria-label', 'title']) { const v = el.getAttribute(k); if (v) out.push(`[${k}] ${v}`); }
      });
      return out;
    });
    for (const t of found) {
      const bare = t.replace(/^\[[\w-]+\] /, '');
      // Looks English: has an English-only word, and isn't a name, number, amount or date.
      if (KEEP.test(bare) || !/[A-Za-z]{2}/.test(bare)) continue;
      const words = bare.replace(/Pockets/g, '');
      if (!/(?<!\p{L})(the|and|of|to|for|your|you|this|that|with|from|in|on|is|are|it|an|not|add|new|edit|save|delete|left|spent|week|month|day|days|pocket|pockets|account|accounts|card|cards|income|expense|expenses|tap|pay|paid|budget|move|back|done|cancel|close|search|open|set|more|less|all|none|other|today|tomorrow)(?!\p{L})/iu.test(words)) continue;
      if (!seen.has(t)) seen.set(t, new Set());
      seen.get(t).add(where);
    }
  }
  for (const [t, w] of seen) console.log(`${t}    <- ${[...w].join(', ')}`);
  console.log(`\n${seen.size} untranslated text(s).`);
  if (errors.length) console.log('page errors:', errors.join(' | '));
  await browser.close();
})();
