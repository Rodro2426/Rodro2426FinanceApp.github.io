// Pockets website: builds the 3D phones, switches Spanish/English, and runs the turning phone in the story.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- English copy (Spanish lives in the HTML) ---------- */
  var EN = {
    'skip': 'Skip to content',
    'nav.features': 'Features', 'nav.friends': 'Friends', 'nav.privacy': 'Privacy', 'nav.install': 'Install',
    'cta.open': 'Open Pockets', 'cta.how': 'How to install',
    'hero.title': 'Money that<br><span>knows its place.</span>',
    'hero.lede': "Split your pay into pockets and see each morning what's safe to spend today. In pesos, by quincena, on your iPhone.",
    'hero.facts': 'Free · No app store · English and Spanish',
    'frag.bill.t': 'Spotify is due tomorrow', 'frag.bill.s': '$16.900 will be paid automatically from Visa Gold.',
    'frag.pocket': 'Transport', 'frag.pocket.s': 'left of $120.000', 'frag.settle.t': 'Laura pays you',
    'rail.0': 'Today', 'rail.1': 'Pockets', 'rail.2': 'Accounts', 'rail.3': 'Calendar', 'rail.4': 'Insights', 'rail.5': 'Investments', 'rail.6': 'Friends', 'rail.7': 'Privacy',
    'f0.h': 'One number. Every morning.',
    'f0.p': 'Open the app and see what you can spend today, this week and this month. No spreadsheets, no guessing.',
    'f0.c0': 'Today', 'f0.c1': 'This week', 'f0.c2': 'This month',
    'f1.h': 'Your pay, already sorted.',
    'f1.p': 'Split each paycheck into pockets for groceries, transport, going out and savings. Each one starts over every week or every quincena.',
    'f1.c0': 'Monday to Sunday', 'f1.c1': '1st–15th and 16th–end', 'f1.c2': 'Leftovers carry over',
    'f2.h': 'All your accounts, together.',
    'f2.p': 'Banks, savings, cash and credit cards in one place, with your net worth up to date and interest in % E.A.',
    'f2.c0': 'Credit cards', 'f2.c1': 'Savings with interest', 'f2.c2': '“This isn’t mine”',
    'f3.h': 'No bill catches you off guard.',
    'f3.p': 'Income, bills, subscriptions and card payments repeat on their own. Pockets moves the money and tells you on the lock screen.',
    'f3.c0': 'Real notifications', 'f3.c1': 'Automatic payments', 'f3.c2': 'Monthly calendar',
    'f4.h': 'See where it all went.',
    'f4.p': 'Categories, budgets and monthly reports. Export everything to Excel, with a sheet ready to hand to an AI.',
    'f4.c0': 'Categories', 'f4.c1': '13 reports', 'f4.c2': 'Excel with a "For AI" sheet',
    'f5.h': 'CDTs to stocks, one view.',
    'f5.p': "CDTs, investment funds, voluntary pension and cesantías next to your stocks, converted with today's TRM.",
    'f5.c2': 'Cesantías', 'f5.c3': 'Stocks in USD',
    'f6.h': 'Trips without the math.',
    'f6.p': 'Add friends by email, share a trip and log who paid. Pockets works out who owes whom, with chat, photos and GIFs.',
    'f6.c0': 'Shared trips', 'f6.c1': 'Settle up', 'f6.c2': 'Trip chat',
    'f7.h': 'Yours. Only yours.',
    'f7.p': 'Lock it with Face ID and hide every amount with one tap. Your data lives on your phone; the cloud is just a copy, if you want one.',
    'f7.c1': 'Hide amounts', 'f7.c2': 'Cloud copy',
    'desk.h': 'On your computer, too.',
    'desk.p': 'Open the same link on your computer and Pockets fits the big screen, with a side menu. With an account, everything stays in sync between the two.',
    'desk.alt': 'Pockets on a computer: Home with pockets, upcoming bills and recent spending',
    'det.h': 'And the little things.',
    'det.0': 'It opens only for you.',
    'det.1.h': 'Hide amounts', 'det.1': 'One tap before you show someone your screen.',
    'det.2.h': 'Real notifications', 'det.2': 'Bills, pay day and card due dates, on the lock screen.',
    'det.3.h': 'Dark mode', 'det.3': 'Plus any background color you like.',
    'det.4.h': 'English or Spanish', 'det.4': 'Switch any time.',
    'det.5.h': 'Backup and sync', 'det.5': 'A copy in the cloud, or saved to a file.',
    'det.6.h': 'Your own Home', 'det.6': 'Move and hide the blocks you see first.',
    'det.7.h': 'Practice tour', 'det.7': 'Learn it with sample data, without touching yours.',
    'ins.h': 'Install it in three steps.',
    'ins.p': "Pockets isn't on the App Store. It installs from Safari and updates itself.",
    'ins.s0': 'Open the link in Safari', 'ins.s0p': 'On your iPhone, open the address below in Safari.',
    'ins.s1': 'Tap Share', 'ins.s1p': "It's the square with the arrow pointing up, at the bottom of the screen.",
    'ins.s2': 'Tap “Add to Home Screen”', 'ins.s2a': 'Copy', 'ins.s2b': 'Add to Home Screen', 'ins.s2p': 'Pockets lands on your Home Screen and opens like any other app.',
    'ins.copy': 'Copy link', 'ins.copied': 'Copied',
    'ins.note': 'On Android or a computer? Open it in the browser; it works the same.',
    'faq.h': 'What everyone asks.',
    'faq.0q': 'Does it cost anything?', 'faq.0a': 'No. Pockets is free and has no paid version.',
    'faq.1q': 'Does it connect to my bank?', 'faq.1a': "No. You log your spending and income, or schedule them to repeat. Pockets never asks for your bank passwords.",
    'faq.2q': 'Where does my data live?', 'faq.2a': 'On your phone. If you create an account, a copy is kept in the cloud so you can see it on other devices. You can also save a copy to a file.',
    'faq.3q': 'Do I need an account?', 'faq.3a': 'Not to start. An account (email or Google) is only needed for sync and for trips with friends.',
    'faq.4q': 'Can I try it without my own data?', 'faq.4a': 'Yes. When it opens, tap “More ways to start”, then “Try it with sample data”.',
    'faq.5q': "Why isn't it on the App Store?", 'faq.5a': "It's a web app: it installs from Safari, updates itself and doesn't need to go through the store.",
    'close.h': 'Every peso,<br><span>in its pocket.</span>',
    'close.p': 'Free, in English or Spanish, and ready for your next quincena.',
    'foot.p': 'Made in Colombia for pesos, quincenas and the TRM. The screens show the real app with sample data.',
    'foot.app': 'Open the app', 'foot.faq': 'Questions'
  };
  var META = {
    es: { title: 'Pockets · Tu plata, en su lugar', copied: 'Copiado' },
    en: { title: 'Pockets · Money that knows its place', copied: 'Copied' }
  };

  // Remember the Spanish text that ships in the HTML so switching back is exact.
  var ES = {};
  document.querySelectorAll('[data-i18n]').forEach(function (el) { ES[el.dataset.i18n] = el.textContent; });
  document.querySelectorAll('[data-i18n-html]').forEach(function (el) { ES[el.dataset.i18nHtml] = el.innerHTML; });
  document.querySelectorAll('[data-i18n-alt]').forEach(function (el) { ES[el.dataset.i18nAlt] = el.alt; });
  ES['ins.copied'] = META.es.copied;

  var lang = root.lang === 'en' ? 'en' : 'es';
  function t(key) { return (lang === 'en' ? EN : ES)[key] || ES[key] || ''; }

  function applyLang() {
    root.lang = lang;
    document.title = META[lang].title;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { var v = t(el.dataset.i18n); if (v) el.textContent = v; });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { var v = t(el.dataset.i18nHtml); if (v) el.innerHTML = v; });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) { var v = t(el.dataset.i18nAlt); if (v) el.alt = v; });
    document.querySelectorAll('img[data-shot]').forEach(function (img) { img.src = 'screens/' + lang + '/' + img.dataset.shot + '.jpg'; });
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }
  document.querySelectorAll('.lang button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.lang === lang) return;
      lang = b.dataset.lang;
      try { localStorage.setItem('pockets-site-lang', lang); } catch (e) {}
      applyLang();
    });
  });

  /* ---------- Phones ---------- */
  var tpl = document.getElementById('phoneTpl');
  document.querySelectorAll('.phone').forEach(function (ph) {
    var frag = tpl.content.cloneNode(true);
    var slice = frag.querySelector('.slice');
    for (var z = -5; z <= 5; z++) { var s = slice.cloneNode(); s.style.transform = 'translateZ(' + z + 'px)'; ph.appendChild(s); }
    slice.remove();
    var shots = frag.querySelector('.shots');
    var names = ph.hasAttribute('data-multi') ? ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'] : [ph.dataset.shot];
    names.forEach(function (n, i) {
      var img = document.createElement('img');
      img.dataset.shot = n; img.alt = ''; img.decoding = 'async';
      if (i === 0) img.className = 'on';
      else img.loading = 'lazy';
      shots.appendChild(img);
    });
    ph.appendChild(frag);
  });
  applyLang();

  /* ---------- Nav border once the page scrolls ---------- */
  var nav = document.getElementById('nav');
  function onNav() { nav.classList.toggle('scrolled', scrollY > 8); }
  addEventListener('scroll', onNav, { passive: true }); onNav();

  /* ---------- Hero phone follows the pointer (fine pointers only) ---------- */
  var heroRig = document.getElementById('heroRig');
  var hero = document.querySelector('.hero');
  var tilt = { x: 0, y: 0, tx: 0, ty: 0, raf: 0 };
  function tiltFrame() {
    tilt.x += (tilt.tx - tilt.x) * 0.08;
    tilt.y += (tilt.ty - tilt.y) * 0.08;
    heroRig.style.setProperty('--ry', (-20 + tilt.x * 22).toFixed(2) + 'deg');
    heroRig.style.setProperty('--rx', (7 - tilt.y * 12).toFixed(2) + 'deg');
    if (Math.abs(tilt.tx - tilt.x) + Math.abs(tilt.ty - tilt.y) > 0.002) tilt.raf = requestAnimationFrame(tiltFrame);
    else tilt.raf = 0;
  }
  hero.addEventListener('pointermove', function (e) {
    if (!finePointer.matches || reduce.matches) return;
    var r = hero.getBoundingClientRect();
    tilt.tx = (e.clientX - r.left) / r.width - 0.5;
    tilt.ty = (e.clientY - r.top) / r.height - 0.5;
    if (!tilt.raf) tilt.raf = requestAnimationFrame(tiltFrame);
  });
  hero.addEventListener('pointerleave', function () {
    tilt.tx = 0; tilt.ty = 0;
    if (!tilt.raf && finePointer.matches && !reduce.matches) tilt.raf = requestAnimationFrame(tiltFrame);
  });

  /* ---------- Story: the phone turns around and comes back on the next screen ---------- */
  var spin = document.getElementById('spin');
  var storyPhone = document.getElementById('storyPhone');
  var storyRig = document.getElementById('storyRig');
  var tint = document.getElementById('tint');
  var railItems = Array.prototype.slice.call(document.querySelectorAll('#rail li'));
  var feats = Array.prototype.slice.call(document.querySelectorAll('.feat'));
  var current = 0, angle = 0, swapT = 0;

  // Swap to screen i only once it has decoded, keeping the current screen up until then.
  var wanted = 0;
  function showShot(i) {
    wanted = i;
    var imgs = storyPhone.querySelectorAll('.shots img');
    var next = imgs[i];
    next.loading = 'eager';
    var swap = function () {
      if (wanted !== i) return;
      imgs.forEach(function (img, k) { img.classList.toggle('on', k === i); });
    };
    if (next.complete && next.naturalWidth) swap();
    else (next.decode ? next.decode() : Promise.reject()).then(swap, function () { next.addEventListener('load', swap, { once: true }); });
  }
  function activate(i) {
    if (i === current) return;
    var dir = i > current ? 1 : -1;
    current = i;
    tint.style.setProperty('--tint', feats[i].dataset.tint);
    railItems.forEach(function (li, k) { li.classList.toggle('on', k === i); });
    clearTimeout(swapT);
    if (reduce.matches) { showShot(i); return; }
    // The transition retargets from wherever the phone is, so fast scrolling never snaps.
    angle += 360 * dir;
    spin.style.transform = 'rotateY(' + angle + 'deg)';
    // Swap while the back faces the viewer (about 40% into the 900ms ease-in-out turn).
    swapT = setTimeout(function () { showShot(i); }, 360);
  }
  tint.style.setProperty('--tint', feats[0].dataset.tint);
  railItems[0].classList.add('on');
  if (matchMedia('(max-width: 860px)').matches) {
    // Phones: the sticky stage covers the top of the screen, so a scene becomes current only once its
    // whole text block is visible in the space below the stage.
    var stage = document.querySelector('.story-stage');
    var below = Math.ceil(stage.getBoundingClientRect().height + nav.getBoundingClientRect().height);
    var cardIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting && e.intersectionRatio > 0.97) activate(+e.target.closest('.feat').dataset.i); });
    }, { rootMargin: '-' + below + 'px 0px 0px 0px', threshold: [0.98] });
    feats.forEach(function (f) { cardIO.observe(f.querySelector('.feat-card')); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) activate(+e.target.dataset.i); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    feats.forEach(function (f) { io.observe(f); });
  }

  // Warm the next screens once the story is close, so turns never show a blank screen.
  var warm = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; })) {
      storyPhone.querySelectorAll('.shots img').forEach(function (img) { img.loading = 'eager'; });
      warm.disconnect();
    }
  }, { rootMargin: '600px 0px' });
  warm.observe(document.getElementById('funciones'));

  // A gentle sway while the story scrolls.
  var swayQueued = false;
  addEventListener('scroll', function () {
    if (reduce.matches || swayQueued) return;
    swayQueued = true;
    requestAnimationFrame(function () {
      var p = scrollY / 800;
      storyRig.style.setProperty('--ry', (Math.sin(p) * 12 - 10).toFixed(2) + 'deg');
      storyRig.style.setProperty('--rx', (6 + Math.cos(p * 1.3) * 3).toFixed(2) + 'deg');
      storyRig.style.setProperty('--rz', (Math.sin(p * 0.7) * 2).toFixed(2) + 'deg');
      swayQueued = false;
    });
  }, { passive: true });

  /* ---------- Copy the app link ---------- */
  var copyBtn = document.getElementById('copyBtn');
  var urlEl = document.getElementById('appUrl');
  var copyT = 0;
  copyBtn.addEventListener('click', function () {
    var text = urlEl.textContent.trim();
    var done = function () {
      copyBtn.textContent = t('ins.copied') || EN['ins.copied'];
      clearTimeout(copyT);
      copyT = setTimeout(function () { copyBtn.textContent = t('ins.copy'); }, 1800);
    };
    var select = function () {
      var r = document.createRange(); r.selectNodeContents(urlEl);
      var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, select);
    else select();
  });
})();
