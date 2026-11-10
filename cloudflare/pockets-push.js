// Pockets push notifications: a Cloudflare Worker (free plan).
//
// Firebase keeps all the data. This Worker only delivers lock-screen notifications:
//   POST /notify    A signed-in user tells their friends "I sent a message / added an expense". The Worker checks the
//                   user's Firebase sign-in, reads who is in that trip or conversation from Firestore (as that user, so
//                   Firestore's own rules apply), reads each person's notification addresses from their profile and
//                   delivers the notification through Apple/Google/Mozilla push services.
//   POST /schedule  A phone saves its upcoming reminders (bills due tomorrow, monthly backup) so they can arrive even
//                   when Pockets is closed. Needs the KV binding SCHED.
//   cron            Every few minutes: sends the reminders that are due.
//   POST /status    What the server has saved for this phone (to check reminders from the app).
//   POST /test      Sends this phone a test notification right away.
//   /q/<key>/...    Quick add from an iPhone Shortcut (no sign-in: the long random key is the lock). The Shortcut reads
//                   the pocket list (GET menu) and drops an expense in the inbox (POST add); the app uploads the list
//                   (POST menu), collects the inbox when it opens (GET items, POST ack) and can turn it off (POST off).
//                   The key can only add expenses and read pocket/account names; it can't read balances or history.
//
// Settings (Worker > Settings > Variables and Secrets):
//   VAPID_JWK         secret: the private key (JSON) given during setup. Never put it in the app or on GitHub.
//   VAPID_SUBJECT     mailto:you@example.com (push services contact this if something goes wrong)
//   FIREBASE_PROJECT  pockets-rodar
//   ALLOWED_ORIGIN    https://rodro2426.github.io
// Bindings: KV namespace as SCHED (for reminders). Triggers: cron "*/5 * * * *" (reminders arrive within 5 minutes).

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(req.url);
    try {
      if (req.method === 'GET' && url.pathname === '/') return json({ ok: true, service: 'pockets-push', key: await publicKey(env) }, 200, cors);
      const q = url.pathname.match(/^\/q\/([a-f0-9]{32})\/(menu|add|items|ack|off)$/);
      if (q) return json(await quick(env, req, q[1], q[2]), 200, cors);
      if (req.method !== 'POST') return json({ error: 'not found' }, 404, cors);
      const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
      const uid = await verifyFirebaseToken(token, env.FIREBASE_PROJECT);
      if (!uid) return json({ error: 'sign in first' }, 401, cors);
      const body = await req.json().catch(() => ({}));
      if (url.pathname === '/notify') return json(await notify(env, token, uid, body), 200, cors);
      if (url.pathname === '/schedule') return json(await schedule(env, uid, body), 200, cors);
      if (url.pathname === '/status') return json(await status(env, uid, body), 200, cors);
      if (url.pathname === '/test') return json(await testPush(env, body), 200, cors);
      return json({ error: 'not found' }, 404, cors);
    } catch (e) {
      return json({ error: String(e && e.message || e) }, 500, cors);
    }
  },
  async scheduled(_event, env) {
    await sendDueReminders(env);
  }
};

/* ---------------- Notify friends ---------------- */
const clip = (s, n) => String(s || '').slice(0, n);

async function notify(env, token, uid, body) {
  const thread = String(body.thread || '');
  let people = [];
  if (thread.startsWith('dm:')) {
    const pair = thread.slice(3);
    const d = await firestoreGet(env, token, `dms/${pair}`);
    people = d ? arr(d.fields.users) : [];
  } else if (thread) {
    const d = await firestoreGet(env, token, `trips/${thread}`);
    people = d ? arr(d.fields.members) : [];
  }
  // Only people in that trip or conversation, never the sender; Firestore refuses the read if the sender isn't in it.
  if (!people.includes(uid)) return { sent: 0, error: 'not in this chat' };
  const to = people.filter(p => p !== uid).slice(0, 50);
  const payload = { title: clip(body.title, 80), body: clip(body.body, 200), url: clip(body.url, 200), tag: clip(body.tag, 80) };
  let sent = 0;
  await Promise.all(to.map(async r => {
    const prof = await firestoreGet(env, token, `profiles/${r}`).catch(() => null);
    const subs = prof && prof.fields.push && prof.fields.push.mapValue ? Object.values(prof.fields.push.mapValue.fields || {}).map(v => JSON.parse(v.stringValue || 'null')).filter(Boolean) : [];
    for (const s of subs) { if ((await sendPush(env, s, payload)).ok) sent++; }
  }));
  return { sent };
}

const arr = v => (v && v.arrayValue && v.arrayValue.values || []).map(x => x.stringValue);

/** Reads one Firestore document as the signed-in user (their security rules apply). null if missing or not allowed. */
async function firestoreGet(env, token, path) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT}/databases/(default)/documents/${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) return null;
  return r.json();
}

/* ---------------- Scheduled reminders ---------------- */
async function schedule(env, uid, body) {
  if (!env.SCHED) return { saved: false, error: 'reminders are not set up (KV binding SCHED)' };
  const device = clip(body.device, 40).replace(/[^\w-]/g, '');
  if (!device || !body.sub || !body.sub.endpoint) return { saved: false, error: 'missing device' };
  const now = Date.now();
  const items = (Array.isArray(body.items) ? body.items : []).filter(i => i && i.at > now - 36e5 && i.at < now + 40 * 864e5).slice(0, 60)
    .map(i => ({ at: Math.round(i.at), title: clip(i.title, 80), body: clip(i.body, 200), url: clip(i.url, 200), tag: clip(i.tag, 80) }));
  const key = `s:${uid}:${device}`;
  if (!items.length) { await env.SCHED.delete(key); return { saved: true, items: 0 }; }
  await env.SCHED.put(key, JSON.stringify({ sub: body.sub, items, sent: [] }), { expirationTtl: 45 * 86400, metadata: { next: nextAt(items, []) } });
  return { saved: true, items: items.length };
}

/** When this phone's next reminder is due (ms), or -1 when nothing is left. Kept on the entry's tag so the
 *  check every few minutes only opens entries that actually have something to send. */
function nextAt(items, sent) {
  const left = items.filter(i => !sent.includes(i.tag + i.at)).map(i => i.at);
  return left.length ? Math.min(...left) : -1;
}

/** What the server has for this phone: how many reminders, the next one, and any that should have gone out already. */
async function status(env, uid, body) {
  if (!env.SCHED) return { kv: false };
  const device = clip(body.device, 40).replace(/[^\w-]/g, '');
  const v = JSON.parse((await env.SCHED.get(`s:${uid}:${device}`)) || 'null');
  if (!v) return { kv: true, saved: false };
  const now = Date.now();
  const left = v.items.filter(i => !v.sent.includes(i.tag + i.at));
  // A reminder more than 10 minutes late means the cron trigger isn't running.
  const overdue = left.filter(i => i.at < now - 10 * 60e3).length;
  return { kv: true, saved: true, items: left.length, next: nextAt(v.items, v.sent), sent: v.sent.length, overdue };
}

/** Sends a notification to this phone right now, to check the whole delivery chain. */
async function testPush(env, body) {
  if (!body.sub || !body.sub.endpoint) return { ok: false, error: 'missing subscription' };
  const r = await sendPush(env, body.sub, { title: 'Pockets', body: 'Notifications are working ✓', url: '', tag: 'test' });
  return { ok: r.ok, status: r.status, gone: r.gone, error: r.error };
}

async function sendDueReminders(env) {
  if (!env.SCHED) return;
  const now = Date.now();
  let cursor;
  do {
    const page = await env.SCHED.list({ prefix: 's:', cursor });
    for (const k of page.keys) {
      // Entries saved before tags existed have no metadata: open those the old way.
      const next = k.metadata && typeof k.metadata.next === 'number' ? k.metadata.next : null;
      if (next !== null && (next < 0 || next > now)) continue;
      const v = JSON.parse((await env.SCHED.get(k.name)) || 'null');
      if (!v) continue;
      const due = v.items.filter(i => i.at <= now && i.at > now - 6 * 36e5 && !v.sent.includes(i.tag + i.at));
      let gone = false;
      for (const i of due) {
        const r = await sendPush(env, v.sub, i);
        if (r.gone) { gone = true; break; }
        v.sent.push(i.tag + i.at);
      }
      if (gone) { await env.SCHED.delete(k.name); continue; }
      v.items = v.items.filter(i => i.at > now - 6 * 36e5);
      v.sent = v.sent.slice(-100);
      // Rewrite only when something was sent or the tag was missing or out of date.
      const tag = nextAt(v.items, v.sent);
      if (due.length || next === null || tag !== next) await env.SCHED.put(k.name, JSON.stringify(v), { expirationTtl: 45 * 86400, metadata: { next: tag } });
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
}

/* ---------------- Firebase sign-in check ---------------- */
let jwks = null, jwksAt = 0;
async function googleKeys() {
  if (jwks && Date.now() - jwksAt < 36e5) return jwks;
  const r = await fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com');
  jwks = (await r.json()).keys; jwksAt = Date.now();
  return jwks;
}
/** The user's id if this is a valid, current Firebase ID token for our project; otherwise null. */
export async function verifyFirebaseToken(token, project, keys) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const head = JSON.parse(txt(b64d(h))), claims = JSON.parse(txt(b64d(p)));
  if (head.alg !== 'RS256') return null;
  const jwk = (keys || await googleKeys()).find(k => k.kid === head.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64d(s), enc(`${h}.${p}`));
  const now = Math.floor(Date.now() / 1000);
  if (!ok || claims.aud !== project || claims.iss !== `https://securetoken.google.com/${project}` || !(claims.exp > now) || !(claims.iat <= now + 300) || !claims.sub) return null;
  return claims.sub;
}

/* ---------------- Web Push (RFC 8291 encryption, RFC 8292 VAPID) ---------------- */
async function vapidKeys(env) {
  const jwk = typeof env.VAPID_JWK === 'string' ? JSON.parse(env.VAPID_JWK) : env.VAPID_JWK;
  const priv = await crypto.subtle.importKey('jwk', { ...jwk, ext: true }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const pub = b64e(cat(new Uint8Array([4]), b64d(jwk.x), b64d(jwk.y)));
  return { priv, pub };
}
async function publicKey(env) { try { return (await vapidKeys(env)).pub; } catch { return null; } }

/** Sends one notification. ok: delivered to the push service; gone: that phone turned notifications off. */
export async function sendPush(env, sub, data) {
  try {
    const { priv, pub } = await vapidKeys(env);
    const endpoint = new URL(sub.endpoint);
    const jwt = await signJwt(priv, { aud: endpoint.origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || 'mailto:pockets@example.com' });
    const bodyBytes = await encrypt(sub, enc(JSON.stringify(data)));
    const r = await fetch(sub.endpoint, {
      method: 'POST',
      headers: { Authorization: `vapid t=${jwt}, k=${pub}`, 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'high' },
      body: bodyBytes
    });
    return { ok: r.status >= 200 && r.status < 300, gone: r.status === 404 || r.status === 410, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

async function signJwt(priv, claims) {
  const h = b64e(enc(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))), p = b64e(enc(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, priv, enc(`${h}.${p}`)));
  return `${h}.${p}.${b64e(sig)}`;
}

/** aes128gcm content encoding for one push message (RFC 8291). */
export async function encrypt(sub, plaintext, fixed) {
  const uaPublic = b64d(sub.keys.p256dh), authSecret = b64d(sub.keys.auth);
  const as = fixed?.keys || await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey));
  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256));
  const salt = fixed?.salt || crypto.getRandomValues(new Uint8Array(16));
  const ikm = await hkdf(authSecret, shared, cat(enc('WebPush: info\0'), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(salt, ikm, enc('Content-Encoding: nonce\0'), 12);
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, cat(plaintext, new Uint8Array([2]))));
  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0); new DataView(header.buffer).setUint32(16, 4096); header[20] = asPublic.length; header.set(asPublic, 21);
  return cat(header, ct);
}
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
}

/* ---------------- Quick add (iPhone Shortcut inbox) ---------------- */
// Free-plan friendly: one KV value per person for the list (qm:) and one for the waiting expenses (qi:), so no KV
// "list" calls. A key only works after the signed-in app created it (POST menu with a Firebase token); any other key
// is answered with a read and nothing else, so made-up keys can't use up the daily KV writes.
const QMAX = 30, QDAY = 60;
/** "25000", "25.000", "25,000.50", "25.000,50" → a number (a separator followed by exactly 3 digits is thousands). */
function parseAmount(raw) {
  if (typeof raw === 'number') return raw;
  const s = String(raw ?? '').replace(/[^\d.,]/g, '');
  const last = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
  if (last < 0) return Number(s);
  const sep = s[last], both = s.includes('.') && s.includes(',');
  const tail = s.slice(last + 1), head = s.slice(0, last).replace(/[.,]/g, '');
  // Both kinds: the last one is the decimal point. One kind used twice or more: thousands. Once: thousands only before 3 digits.
  const thousands = !both && (s.indexOf(sep) !== last || tail.length === 3);
  return thousands ? Number(head + tail) : Number(head + '.' + tail);
}
/**
 * What the Shortcut sent, however Shortcuts sends it: a JSON body, a Form body, or ?amount=… in the link.
 * Spanish field names work too (monto, bolsillo, nota, cuenta, categoria).
 */
async function readBody(req, url) {
  const type = req.headers.get('Content-Type') || '';
  let b = {};
  try {
    if (type.includes('json')) b = await req.json();
    else if (type.includes('form')) b = Object.fromEntries((await req.formData()).entries());
    else { const t = await req.text(); b = t.trim().startsWith('{') ? JSON.parse(t) : Object.fromEntries(new URLSearchParams(t)); }
  } catch { b = {}; }
  const all = { ...Object.fromEntries(url.searchParams), ...(b && typeof b === 'object' ? b : {}) };
  const pick = (...names) => { for (const n of names) for (const k of Object.keys(all)) if (k.trim().toLowerCase() === n) return all[k]; return undefined; };
  return {
    amount: pick('amount', 'monto', 'valor', 'cantidad'), pocket: pick('pocket', 'bolsillo'), note: pick('note', 'nota'),
    account: pick('account', 'cuenta'), category: pick('category', 'categoria', 'categoría'), ids: all.ids
  };
}
async function quick(env, req, key, action) {
  const post = req.method === 'POST';
  const mk = `qm:${key}`, ik = `qi:${key}`;
  const m = JSON.parse((await env.SCHED.get(mk)) || 'null');
  const es = m ? m.lang === 'es' : false;
  const list = v => (Array.isArray(v) ? v : []).slice(0, 80).map(x => clip(x, 60)).filter(Boolean);
  if (action === 'menu' && post) {
    const uid = await verifyFirebaseToken((req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, ''), env.FIREBASE_PROJECT);
    if (!uid) return { error: 'sign in first' };
    if (m && m.uid !== uid) return { error: 'not yours' };
    const body = await req.json().catch(() => ({}));
    const next = { uid, pockets: list(body.pockets), accounts: list(body.accounts), cats: list(body.cats), lang: body.lang === 'es' ? 'es' : 'en' };
    if (!next.pockets.length) next.pockets = [next.lang === 'es' ? 'Sin bolsillo' : 'No pocket'];
    await env.SCHED.put(mk, JSON.stringify(next), { expirationTtl: 400 * 86400 });
    return { saved: true };
  }
  if (!m) return { ok: false, text: 'Agregar rápido está desactivado: actívalo en Pockets → Ajustes. / Quick add is off: turn it on in Pockets → Settings.' };
  if (action === 'menu') return { pockets: m.pockets, accounts: m.accounts, cats: m.cats, lang: m.lang };
  const box = JSON.parse((await env.SCHED.get(ik)) || 'null') || { items: [], day: '', adds: 0 };
  const save = () => env.SCHED.put(ik, JSON.stringify(box), { expirationTtl: 30 * 86400 });
  if (action === 'items') return { items: box.items };
  if (!post) return { ok: false, text: es ? 'En la última acción "Obtener contenido de URL", cambia el Método a POST.' : 'In the last "Get Contents of URL" action, set Method to POST.' };
  const body = await readBody(req, new URL(req.url));
  if (action === 'add') {
    const amt = parseAmount(body.amount);
    if (!(amt > 0 && amt < 1e10)) return { ok: false, text: es ? 'Escribe un monto mayor que 0.' : 'Type an amount above 0.' };
    const today = new Date().toISOString().slice(0, 10);
    if (box.day !== today) { box.day = today; box.adds = 0; }
    if (box.items.length >= QMAX) return { ok: false, text: es ? 'Abre Pockets para guardar primero los gastos pendientes.' : 'Open Pockets to save the waiting expenses first.' };
    if (box.adds >= QDAY) return { ok: false, text: es ? 'Llegaste al límite de hoy. Agrégalo desde Pockets.' : 'That is the limit for today. Add it from Pockets.' };
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const item = { id, amt: Math.round(amt * 100) / 100, pocket: clip(body.pocket, 60), note: clip(body.note, 80), account: clip(body.account, 60), category: clip(body.category, 60), ts: Date.now() };
    box.items.push(item); box.adds++;
    await save();
    const n = new Intl.NumberFormat(es ? 'es-CO' : 'en-US', { maximumFractionDigits: 2 }).format(item.amt);
    const where = item.pocket || (es ? 'sin bolsillo' : 'no pocket');
    return { ok: true, text: es ? `Guardado: $${n} en ${where}` : `Saved $${n} to ${where}` };
  }
  if (action === 'ack') {
    const ids = new Set((Array.isArray(body.ids) ? body.ids : []).map(String));
    const left = box.items.filter(i => !ids.has(i.id));
    if (left.length !== box.items.length) { box.items = left; await save(); }
    return { left: left.length };
  }
  if (action === 'off') {
    await Promise.all([env.SCHED.delete(mk), env.SCHED.delete(ik)]);
    return { off: true };
  }
  return { error: 'not found' };
}

/* ---------------- Small helpers ---------------- */
function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGIN || 'https://rodro2426.github.io').split(',').map(s => s.trim());
  const ok = allowed.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return { 'Access-Control-Allow-Origin': ok ? origin : allowed[0], 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
}
const json = (o, status, headers) => new Response(JSON.stringify(o), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const enc = s => new TextEncoder().encode(s);
const txt = b => new TextDecoder().decode(b);
const cat = (...xs) => { const out = new Uint8Array(xs.reduce((a, x) => a + x.length, 0)); let o = 0; for (const x of xs) { out.set(x, o); o += x.length; } return out; };
const b64e = b => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const b64d = s => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); const bin = atob(s + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(bin, c => c.charCodeAt(0)); };
