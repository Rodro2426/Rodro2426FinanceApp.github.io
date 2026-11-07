// Language: English (as written in the code) or Spanish. In Spanish, a small translator watches the screen and swaps
// each English text for its Spanish version from the dictionary in es.ts, the same way for every page and sheet.
// Things people type (chat messages, names) are marked translate="no" and stay as they are.
import { ES_PATTERNS, ES_WORDS } from './es';

export type Lang = 'en' | 'es';
const KEY = 'pockets-lang';
export const getLang = (): Lang => { try { return localStorage.getItem(KEY) === 'es' ? 'es' : 'en'; } catch { return 'en'; } };
/** Saves the language and reloads so every screen redraws in it. */
export const setLang = (l: Lang) => { try { localStorage.setItem(KEY, l); } catch { /* not saved */ } location.reload(); };
/** Locale for dates: "6 de noviembre" in Spanish, "November 6" in English. */
export const dateLocale = () => (getLang() === 'es' ? 'es-CO' : 'en-US');

const dict = new Map<string, string>();
const outputs = new Set<string>();
let patterns: [RegExp, string][] = [];
let built = false;
function build() {
  if (built) return; built = true;
  for (const line of ES_WORDS.split('\n')) {
    const i = line.indexOf('|'); if (i < 1) continue;
    const en = line.slice(0, i).trim(), es = line.slice(i + 1).trim();
    if (en && es) { dict.set(en, es); outputs.add(es); }
  }
  patterns = ES_PATTERNS.split('\n').map(line => {
    const i = line.indexOf('|'); if (i < 1) return null;
    const en = line.slice(0, i).trim(), es = line.slice(i + 1).trim();
    // "{0} is due today" → /^(?<g0>.*?) is due today$/
    const re = en.split(/\{(\d)\}/).map((p, k) => (k % 2 ? `(?<g${p}>.*?)` : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('');
    return [new RegExp('^' + re + '$', 's'), es] as [RegExp, string];
  }).filter(Boolean) as [RegExp, string][];
}

const cache = new Map<string, string | null>();
/** Spanish for one piece of English text (or null when there's none). */
function lookup(s: string): string | null {
  const hit = dict.get(s); if (hit !== undefined) return hit;
  if (cache.has(s)) return cache.get(s)!;
  let out: string | null = null;
  if (/[A-Za-z]{2}/.test(s) && !outputs.has(s)) {
    for (const [re, es] of patterns) {
      const m = re.exec(s); if (!m) continue;
      out = es.replace(/\{(\d)\}/g, (_, k) => { const v = m.groups?.['g' + k] ?? ''; return dict.get(v.trim()) ?? lookup(v.trim()) ?? v; });
      break;
    }
    // Lines put together with " · " ("Groceries · Bancolombia · Today"): translate each part on its own.
    if (out == null && s.includes(' · ')) {
      const parts = s.split(' · '), es = parts.map(x => (x.trim() ? lookup(x.trim()) ?? x : x));
      if (es.some((x, k) => x !== parts[k])) out = es.join(' · ');
    }
  }
  if (cache.size > 3000) cache.clear();
  cache.set(s, out);
  return out;
}

/** Translates a whole string, keeping its spaces around it. In English it comes back unchanged. */
export function tr(s: string): string {
  if (getLang() !== 'es' || !s) return s;
  build();
  const core = s.trim(); if (!core) return s;
  const es = lookup(core);
  return es == null ? s : s.replace(core, es);
}

const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
const skip = (el: Element | null) => !!el && (!!el.closest('[translate="no"],script,style,textarea') || (el as HTMLElement).isContentEditable);

function doText(n: Text) {
  const v = n.nodeValue; if (!v || !/[A-Za-z]/.test(v) || skip(n.parentElement)) return;
  const t = tr(v); if (t !== v) n.nodeValue = t;
}
function doAttrs(el: Element) {
  for (const a of ATTRS) { const v = el.getAttribute(a); if (v && /[A-Za-z]/.test(v)) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } }
}
function doTree(root: Node) {
  if (root.nodeType === 3) { doText(root as Text); return; }
  if (root.nodeType !== 1 || skip(root as Element)) return;
  doAttrs(root as Element);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n as Text); else doAttrs(n as Element); }
}

/** Starts translating the page when Spanish is chosen. Call once before the app draws. */
export function startTranslator() {
  if (typeof document === 'undefined' || getLang() !== 'es') return;
  document.documentElement.lang = 'es';
  build();
  const mo = new MutationObserver(list => {
    for (const m of list) {
      if (m.type === 'characterData') doText(m.target as Text);
      else if (m.type === 'attributes') doAttrs(m.target as Element);
      else m.addedNodes.forEach(doTree);
    }
  });
  mo.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  if (document.body) doTree(document.body);
  // Pop-up questions ("Delete this trip?") come from the code, not the page, so translate them too.
  const c = window.confirm.bind(window), a = window.alert.bind(window);
  window.confirm = (msg?: string) => c(tr(String(msg ?? '')));
  window.alert = (msg?: unknown) => a(tr(String(msg ?? '')));
}
