// Pockets website: builds the 3D phones, switches Spanish/English, and runs the turning phone in the story.
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var finePointer = matchMedia('(hover: hover) and (pointer: fine)');

  /* ---------- English copy (Spanish lives in the HTML) ---------- */
  var EN = {
    'skip': 'Skip to content',
    'theme.toDark': 'Switch to dark mode', 'theme.toLight': 'Switch to light mode',
    'nav.features': 'Features', 'nav.friends': 'Friends', 'nav.privacy': 'Privacy', 'nav.install': 'Install',
    'cta.open': 'Open Pockets', 'cta.how': 'How to install', 'cta.signin': 'Sign in', 'cta.start': 'Start free', 'cta.have': 'I already have an account',
    'auth.title': 'Get into Pockets', 'auth.close': 'Close', 'auth.signin': 'Sign in', 'auth.create': 'Create account',
    'auth.name': 'Your name', 'auth.email': 'Email', 'auth.emailPh': 'you@email.com', 'auth.pass': 'Password', 'auth.passPh': 'At least 6 characters',
    'auth.forgot': 'Forgot your password?', 'auth.or': 'or', 'auth.google': 'Continue with Google',
    'auth.sample': 'Try it with sample data', 'auth.sampleSub': 'Made-up accounts and expenses, no account needed',
    'auth.more': 'More ways to start', 'auth.moreSub': 'Without an account, or from a saved backup',
    'auth.note': 'Use the same account as on your iPhone and your data comes right back. Only you can see it.',
    'auth.busySignin': 'Signing in…', 'auth.busyCreate': 'Creating your account…', 'auth.busyGoogle': 'Opening Google…', 'auth.opening': 'Opening Pockets…',
    'auth.needEmail': 'Write your email first.', 'auth.needPass': 'Write your password.', 'auth.resetSent': 'We sent you an email to choose a new password.',
    'err.wrong': 'Wrong email or password.', 'err.exists': 'There is already an account with that email. Sign in instead.',
    'err.weak': 'Use at least 6 characters for the password.', 'err.email': "That email doesn't look right.",
    'err.network': "No internet connection. Try again when you're online.", 'err.popup': 'The Google window was closed or blocked. Try email and password instead.',
    'err.many': 'Too many tries. Wait a minute and try again.', 'err.other': "Something went wrong. Try again.",
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
  // Spanish for messages that only appear from code (the rest is the HTML itself).
  ES['auth.signin'] = 'Iniciar sesión'; ES['auth.create'] = 'Crear cuenta'; ES['auth.close'] = 'Cerrar';
  ES['auth.busySignin'] = 'Entrando…'; ES['auth.busyCreate'] = 'Creando tu cuenta…'; ES['auth.busyGoogle'] = 'Abriendo Google…'; ES['auth.opening'] = 'Abriendo Pockets…';
  ES['auth.needEmail'] = 'Escribe primero tu correo.'; ES['auth.needPass'] = 'Escribe tu contraseña.'; ES['auth.resetSent'] = 'Te enviamos un correo para elegir una contraseña nueva.';
  ES['auth.emailPh'] = 'tu@correo.com'; ES['auth.passPh'] = 'Al menos 6 caracteres';
  ES['err.wrong'] = 'El correo o la contraseña no coinciden.'; ES['err.exists'] = 'Ya hay una cuenta con ese correo. Inicia sesión.';
  ES['err.weak'] = 'Usa al menos 6 caracteres en la contraseña.'; ES['err.email'] = 'Ese correo no parece correcto.';
  ES['err.network'] = 'No hay conexión a internet. Intenta de nuevo cuando tengas.'; ES['err.popup'] = 'La ventana de Google se cerró o se bloqueó. Prueba con correo y contraseña.';
  ES['err.many'] = 'Demasiados intentos. Espera un minuto e intenta de nuevo.'; ES['err.other'] = 'Algo salió mal. Intenta de nuevo.';
  ES['theme.toDark'] = 'Cambiar a modo oscuro'; ES['theme.toLight'] = 'Cambiar a modo claro';

  var lang = root.lang === 'en' ? 'en' : 'es';
  function t(key) { return (lang === 'en' ? EN : ES)[key] || ES[key] || ''; }

  function applyLang() {
    root.lang = lang;
    document.title = META[lang].title;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { var v = t(el.dataset.i18n); if (v) el.textContent = v; });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { var v = t(el.dataset.i18nHtml); if (v) el.innerHTML = v; });
    document.querySelectorAll('[data-i18n-alt]').forEach(function (el) { var v = t(el.dataset.i18nAlt); if (v) el.alt = v; });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) { var v = t(el.dataset.i18nPh); if (v) el.placeholder = v; });
    document.querySelectorAll('[data-i18n-label]:not(#themeBtn)').forEach(function (el) { var v = t(el.dataset.i18nLabel); if (v) el.setAttribute('aria-label', v); });
    if (window.__authLang) window.__authLang();
    applyShots();
    themeLabel();
    document.querySelectorAll('.lang button').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
  }
  /* ---------- Light / dark ---------- */
  var themeBtn = document.getElementById('themeBtn');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  function theme() { return root.dataset.theme === 'dark' ? 'dark' : 'light'; }
  function applyShots() {
    var dir = 'screens/' + lang + (theme() === 'dark' ? '-dark' : '') + '/';
    document.querySelectorAll('img[data-shot]').forEach(function (img) { img.src = dir + img.dataset.shot + '.jpg'; });
  }
  function themeLabel() { themeBtn.setAttribute('aria-label', t(theme() === 'dark' ? 'theme.toLight' : 'theme.toDark')); }
  function setTheme(next, save) {
    var swap = function () {
      root.dataset.theme = next;
      themeMeta.setAttribute('content', next === 'dark' ? '#0e0e0d' : '#f7f5f3');
      applyShots(); themeLabel();
    };
    if (save) { try { localStorage.setItem('pockets-site-theme', next); } catch (e) {} }
    if (document.startViewTransition && !reduce.matches) document.startViewTransition(swap); else swap();
  }
  themeBtn.addEventListener('click', function () { setTheme(theme() === 'dark' ? 'light' : 'dark', true); });
  // Follow the system while the visitor hasn't picked one.
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    var saved = null; try { saved = localStorage.getItem('pockets-site-theme'); } catch (err) {}
    if (saved !== 'light' && saved !== 'dark') setTheme(e.matches ? 'dark' : 'light', false);
  });

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
      if (i > 0 || ph.closest('.feat-phone')) img.loading = 'lazy';
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
    tint.style.setProperty('--th', feats[i].dataset.hue);
    railItems.forEach(function (li, k) { li.classList.toggle('on', k === i); });
    clearTimeout(swapT);
    if (reduce.matches) { showShot(i); return; }
    // The transition retargets from wherever the phone is, so fast scrolling never snaps.
    angle += 360 * dir;
    spin.style.transform = 'rotateY(' + angle + 'deg)';
    // Swap while the back faces the viewer (about 40% into the 900ms ease-in-out turn).
    swapT = setTimeout(function () { showShot(i); }, 360);
  }
  tint.style.setProperty('--th', feats[0].dataset.hue);
  railItems[0].classList.add('on');
  if (matchMedia('(max-width: 860px)').matches) {
    // Phones: each scene's phone turns into place once, as it scrolls into view.
    var turnIn = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); turnIn.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -18% 0px' });
    feats.forEach(function (f) { turnIn.observe(f); });
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


  /* ---------- Sign in (the website is the front door; the app finishes the job) ----------
     Same Firebase project and version as the app, in the same browser, so signing in here signs the app in too.
     After signing in, a short note in localStorage ("pockets-handoff") tells the app to bring back the data;
     nothing personal goes in the URL. See app/src/lib/handoff.ts. */
  var FB = 'https://www.gstatic.com/firebasejs/11.10.0/';
  var CONFIG = {
    apiKey: 'AIzaSyBSxMmcFuvYlDA4LKRnCRg-1uRnKosWdgk', authDomain: 'pockets-rodar.firebaseapp.com', projectId: 'pockets-rodar',
    storageBucket: 'pockets-rodar.firebasestorage.app', messagingSenderId: '223677884702', appId: '1:223677884702:web:ec5dda45af414d2e3ec10f'
  };
  var fbReady = null;
  function firebase() {
    if (!fbReady) fbReady = Promise.all([import(FB + 'firebase-app.js'), import(FB + 'firebase-auth.js')]).then(function (m) {
      var app = m[0].initializeApp(CONFIG);
      return { a: m[1], auth: m[1].getAuth(app) };
    });
    return fbReady;
  }
  var authEl = document.getElementById('auth'), panel = document.getElementById('authPanel');
  var form = document.getElementById('authForm'), msg = document.getElementById('authMsg'), submit = document.getElementById('authSubmit');
  var nameIn = document.getElementById('aName'), emailIn = document.getElementById('aEmail'), passIn = document.getElementById('aPass');
  var mode = 'signin', opener = null, busy = false;

  function say(key, good) { msg.textContent = t(key) || key; msg.hidden = false; msg.classList.toggle('good', !!good); }
  function quiet() { msg.hidden = true; }
  function setMode(m) {
    mode = m;
    document.querySelectorAll('.auth-tabs [role=tab]').forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.tab === m)); });
    document.querySelectorAll('.auth [data-only]').forEach(function (el) { el.hidden = el.dataset.only !== m; });
    passIn.autocomplete = m === 'create' ? 'new-password' : 'current-password';
    submit.textContent = t(m === 'create' ? 'auth.create' : 'auth.signin');
    quiet();
  }
  window.__authLang = function () { if (!busy) submit.textContent = t(mode === 'create' ? 'auth.create' : 'auth.signin'); };
  function openAuth(m, from) {
    opener = from || document.activeElement;
    setMode(m);
    authEl.hidden = false;
    document.documentElement.classList.add('auth-open');
    requestAnimationFrame(function () { authEl.classList.add('on'); (m === 'create' ? nameIn : emailIn).focus({ preventScroll: true }); });
    firebase().catch(function () {}); // start loading while they type
  }
  function closeAuth() {
    if (busy) return;
    authEl.classList.remove('on');
    document.documentElement.classList.remove('auth-open');
    setTimeout(function () { authEl.hidden = true; }, reduce.matches ? 0 : 230);
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  document.querySelectorAll('[data-auth]').forEach(function (b) { b.addEventListener('click', function () { openAuth(b.dataset.auth, b); }); });
  authEl.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', closeAuth); });
  document.querySelectorAll('.auth-tabs [role=tab]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.tab); }); });
  document.addEventListener('keydown', function (e) {
    if (authEl.hidden) return;
    if (e.key === 'Escape') closeAuth();
    if (e.key === 'Tab') { // keep focus inside the panel
      var f = [].slice.call(panel.querySelectorAll('button:not([hidden]):not([disabled]), input:not([hidden]), a[href]')).filter(function (x) { return x.offsetParent; });
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });

  function friendly(err) {
    var c = (err && err.code) || '';
    if (/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)) return 'err.wrong';
    if (/email-already-in-use/.test(c)) return 'err.exists';
    if (/weak-password/.test(c)) return 'err.weak';
    if (/invalid-email/.test(c)) return 'err.email';
    if (/network/.test(c)) return 'err.network';
    if (/popup/.test(c)) return 'err.popup';
    if (/too-many-requests/.test(c)) return 'err.many';
    return 'err.other';
  }
  function working(on, key) {
    busy = on;
    panel.classList.toggle('busy', on);
    panel.querySelectorAll('button, input').forEach(function (x) { x.disabled = on; });
    submit.textContent = on ? t(key) : t(mode === 'create' ? 'auth.create' : 'auth.signin');
  }
  /** Leave the note for the app, keep the language they read the site in, and open the app. */
  function handOff(note) {
    try {
      note.at = Date.now();
      localStorage.setItem('pockets-handoff', JSON.stringify(note));
      if (!localStorage.getItem('pockets-lang')) localStorage.setItem('pockets-lang', lang);
    } catch (e) {}
    location.href = '../';
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = emailIn.value.trim(), pass = passIn.value, name = nameIn.value.trim();
    if (!email) { say('auth.needEmail'); emailIn.focus(); return; }
    if (!pass) { say('auth.needPass'); passIn.focus(); return; }
    quiet(); working(true, mode === 'create' ? 'auth.busyCreate' : 'auth.busySignin');
    firebase().then(function (f) {
      if (mode === 'signin') return f.a.signInWithEmailAndPassword(f.auth, email, pass).then(function () { return { created: false, name: '' }; });
      return f.a.createUserWithEmailAndPassword(f.auth, email, pass).then(function (c) {
        // Friends find you by email, so the app asks to confirm it (same as signing up in the app).
        return Promise.all([name ? f.a.updateProfile(c.user, { displayName: name }).catch(function () {}) : null, f.a.sendEmailVerification(c.user).catch(function () {})])
          .then(function () { return { created: true, name: name }; });
      });
    }).then(function (r) { submit.textContent = t('auth.opening'); handOff({ kind: 'signedin', created: r.created, name: r.name }); })
      .catch(function (err) { working(false); say(friendly(err)); });
  });
  document.getElementById('authGoogle').addEventListener('click', function () {
    quiet(); working(true, 'auth.busyGoogle');
    firebase().then(function (f) { return f.a.signInWithPopup(f.auth, new f.a.GoogleAuthProvider()).then(function (c) { return { f: f, c: c }; }); })
      .then(function (r) {
        var info = r.f.a.getAdditionalUserInfo(r.c);
        var first = ((r.c.user && r.c.user.displayName) || '').split(' ')[0];
        submit.textContent = t('auth.opening');
        handOff({ kind: 'signedin', created: !!(info && info.isNewUser), name: first });
      })
      .catch(function (err) { working(false); say(friendly(err)); });
  });
  document.getElementById('authForgot').addEventListener('click', function () {
    var email = emailIn.value.trim();
    if (!email) { say('auth.needEmail'); emailIn.focus(); return; }
    firebase().then(function (f) { return f.a.sendPasswordResetEmail(f.auth, email); })
      .then(function () { say('auth.resetSent', true); })
      .catch(function (err) { say(friendly(err)); });
  });
  document.getElementById('authSample').addEventListener('click', function () { handOff({ kind: 'sample' }); });

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
