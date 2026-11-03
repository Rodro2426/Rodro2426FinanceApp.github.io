import type { ChatCard } from './types';
import { HUES, POCKET_CAT } from './constants';
import { allStats, chargeAccount, ctxOf, fmt, num, pocketStats, roundAmt, sortedExpenses, uid } from './derive';
import { fmtDay, monthLabel, relDay, shortDate } from './dates';
import { getData, getState, setData, setUI } from './store';
import type { AssistantContext, ToolName } from '../../shared/assistant';

type Block = { type: string; [k: string]: any };
type Msg = { role: 'user' | 'assistant'; content: string | Block[] };

const norm = (s: unknown) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function findIn<T extends { name: string }>(list: T[], name: unknown): T | null {
  const n = norm(name); if (!n) return null;
  return list.find(x => norm(x.name) === n) || list.find(x => norm(x.name).includes(n) || n.includes(norm(x.name))) || null;
}

function context(): AssistantContext {
  const d = getData(), c = ctxOf(d), cur = d.settings.currency;
  return {
    name: d.settings.name,
    today: fmtDay(c.today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    week: `week ${c.weekNo} of ${c.weeks} of ${monthLabel(c.month)} (${shortDate(c.weekStart)}–${shortDate(c.weekEnd)}, ${c.daysLeft} days left)`,
    currency: cur === 'COP' ? 'Colombian pesos (COP), no decimals, written like $45.000' : cur
  };
}

function overview() {
  const d = getData(), c = ctxOf(d);
  return JSON.stringify({
    today: c.today, week: `Week ${c.weekNo} of ${c.weeks} (${c.weekStart} to ${c.weekEnd}), ${c.daysLeft} days left`,
    currency: d.settings.currency, monthly_income: num(d.incomeStr),
    pockets: allStats(d, c).map(x => ({ name: x.name, weekly_budget: x.weekly, spent_this_week: x.spent, left_this_week: x.left })),
    accounts: d.accounts.map(a => a.type === 'card' ? { name: a.name, type: 'credit card', owed: a.bal, limit: a.limit, due: a.due } : { name: a.name, type: a.kind, balance: a.bal }),
    goals: d.goals.map(g => ({ name: g.name, saved: g.saved, target: g.target, months_left: g.months })),
    bills: d.bills.map(b => ({ name: b.name, amount: b.amt, due_day: b.dueDay, paid_this_month: b.paidMonths.includes(c.month) })),
    tags: d.tags,
    recent_expenses: sortedExpenses(d).slice(0, 15).map(e => ({
      note: e.note, amount: e.amt, pocket: d.pockets.find(p => p.id === e.p)?.name, account: d.accounts.find(a => a.id === e.a)?.name,
      date: e.date, day: relDay(e.date, c.today), tags: e.tags, category: e.cat
    }))
  });
}

type Run = (input: Record<string, any>, card: (c: ChatCard) => void) => string;
const pocketNames = () => getData().pockets.map(p => p.name).join(', ');
const mk = (kicker: string, title: string, sub: string, amt: string, hue: number, initial?: string): ChatCard => ({ kicker, title, sub, amt, hue, initial: initial || title.charAt(0).toUpperCase() });

const RUN: Record<ToolName, Run> = {
  get_overview: () => overview(),
  add_expense: ({ amount, pocket, note, account, tags, category, subcategory }, card) => {
    const d = getData(), p = findIn(d.pockets, pocket);
    if (!p) throw new Error(`No pocket named "${pocket}". Pockets: ${pocketNames()}`);
    const a = (account && findIn(d.accounts, account)) || d.accounts.find(x => x.type === 'bank') || d.accounts[0];
    if (!a) throw new Error('There are no accounts to pay from. Ask the user to add one in the Accounts tab.');
    const v = roundAmt(Math.abs(Number(amount) || 0)); if (!v) throw new Error('Amount must be greater than zero');
    const tg: string[] = (Array.isArray(tags) ? tags : []).map((t: unknown) => norm(t).replace(/^#+/, '')).filter(Boolean);
    const cat = findIn(d.cats, category);
    const [dc, ds] = POCKET_CAT[p.id] || ['Other', 'Other'];
    const c = ctxOf(d);
    setData(x => ({
      expenses: [{ id: uid('e'), ts: Date.now(), p: p.id, a: a.id, amt: v, note: String(note || p.name).trim(), date: c.today, tags: tg, cat: cat ? cat.name : dc, sub: cat ? String(subcategory || cat.subs[0] || '') : ds }, ...x.expenses],
      accounts: chargeAccount(x.accounts, a.id, v),
      tags: [...x.tags, ...tg.filter(t => !x.tags.includes(t))]
    }));
    const st = pocketStats(getData(), p.id)!;
    card(mk('Expense added', String(note || p.name), `${p.name} · ${a.name} · ${fmt(st.left)} left`, '−' + fmt(v), p.hue));
    return JSON.stringify({ ok: true, pocket: p.name, account: a.name, left_this_week: st.left, over_budget: st.left < 0 });
  },
  create_pocket: ({ name, weekly_amount }, card) => {
    const d = getData(), ex = findIn(d.pockets, name), w = Math.max(0, Number(weekly_amount) || 0);
    if (ex) {
      setData(x => ({ pockets: x.pockets.map(p => p.id === ex.id ? { ...p, weeklyStr: String(w) } : p) }));
      card(mk('Pocket updated', ex.name, 'Weekly budget', fmt(w), ex.hue));
      return JSON.stringify({ ok: true, updated: ex.name });
    }
    const hue = HUES[d.pockets.length % HUES.length], n = String(name).trim();
    setData(x => ({ pockets: [...x.pockets, { id: uid('p'), name: n, weeklyStr: String(w), hue }] }));
    card(mk('Pocket created', n, 'Weekly budget', fmt(w), hue));
    return JSON.stringify({ ok: true, created: n });
  },
  set_pocket_budget: ({ pocket, weekly_amount }, card) => {
    const p = findIn(getData().pockets, pocket); if (!p) throw new Error(`No pocket named "${pocket}". Pockets: ${pocketNames()}`);
    const w = Math.max(0, Number(weekly_amount) || 0);
    setData(x => ({ pockets: x.pockets.map(y => y.id === p.id ? { ...y, weeklyStr: String(w) } : y) }));
    card(mk('Budget updated', p.name, 'Weekly budget', fmt(w), p.hue));
    return JSON.stringify({ ok: true });
  },
  set_income: ({ monthly_amount }, card) => {
    const v = Math.max(0, Number(monthly_amount) || 0);
    setData({ incomeStr: String(v) });
    card(mk('Income updated', 'Monthly income', monthLabel(ctxOf(getData()).month), fmt(v), 150, '$'));
    return JSON.stringify({ ok: true });
  },
  move_money: ({ from_pocket, to, amount }, card) => {
    const d = getData(), c = ctxOf(d), src = findIn(d.pockets, from_pocket); if (!src) throw new Error(`No pocket named "${from_pocket}"`);
    const left = pocketStats(d, src.id, c)!.left, v = roundAmt(Number(amount) || 0);
    if (v <= 0 || v > left + 0.004) throw new Error(`${src.name} only has ${left} left this week`);
    const tp = findIn(d.pockets.filter(p => p.id !== src.id), to), tg = !tp ? findIn(d.goals, to) : null;
    if (!tp && !tg) throw new Error(`No pocket or goal named "${to}"`);
    const dest = (tp || tg)!;
    setData(x => ({ moves: [...x.moves, { id: uid('m'), week: c.weekStart, from: src.id, to: dest.id, amt: v }], goals: tg ? x.goals.map(g => g.id === tg.id ? { ...g, saved: g.saved + v } : g) : x.goals }));
    card(mk('Money moved', `${src.name} → ${dest.name}`, tg ? 'Added to savings goal' : 'This week', fmt(v), dest.hue));
    return JSON.stringify({ ok: true });
  },
  create_goal: ({ name, target, months, already_saved }, card) => {
    const hue = HUES[(getData().goals.length + 3) % HUES.length], m = Math.max(1, Math.round(Number(months) || 1)), t = Math.max(1, Number(target) || 1), n = String(name).trim();
    setData(x => ({ goals: [...x.goals, { id: uid('g'), name: n, saved: Math.max(0, Number(already_saved) || 0), target: t, months: m, hue }] }));
    card(mk('Goal created', n, `${fmt(t / m)}/mo for ${m} months`, fmt(t), hue));
    return JSON.stringify({ ok: true });
  }
};

class NoKeyError extends Error {}

async function callClaude(messages: Msg[]): Promise<{ content: Block[]; stop_reason: string }> {
  const r = await fetch((import.meta.env.VITE_API_URL || '') + '/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ messages, context: context() }) });
  if (r.status === 503) throw new NoKeyError();
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

/** Sends one user message and runs Claude's tool calls until it answers. */
export async function sendToAssistant(text: string, voice = false) {
  const q = text.trim();
  if (!q || getState().ui.thinking) return;
  const history: Msg[] = getState().ui.chat.filter(m => m.text).slice(-12).map(m => ({ role: m.role, content: m.text }));
  setUI(u => ({ chat: [...u.chat, { role: 'user', text: q, voice }], thinking: true, tab: 'assistant' }));
  const cards: ChatCard[] = [];
  const messages: Msg[] = [...history, { role: 'user', content: q }];
  let reply = '';
  try {
    for (let turn = 0; turn < 10; turn++) {
      const res = await callClaude(messages);
      if (res.stop_reason === 'refusal') { reply = "Sorry, I can't help with that one."; break; }
      const texts = res.content.filter(b => b.type === 'text').map(b => b.text as string);
      const uses = res.content.filter(b => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || uses.length === 0) { reply = texts.join('\n').trim(); break; }
      messages.push({ role: 'assistant', content: res.content });
      const results: Block[] = uses.map(u => {
        try {
          const run = RUN[u.name as ToolName];
          if (!run) throw new Error('Unknown tool ' + u.name);
          return { type: 'tool_result', tool_use_id: u.id, content: run(u.input || {}, c => cards.push(c)) };
        } catch (e) {
          return { type: 'tool_result', tool_use_id: u.id, content: (e as Error).message, is_error: true };
        }
      });
      messages.push({ role: 'user', content: results });
    }
  } catch (e) {
    console.warn('Assistant request failed', e);
    reply = e instanceof NoKeyError
      ? "The assistant isn't set up yet. Add an Anthropic API key to the server (ANTHROPIC_API_KEY) and try again."
      : "Sorry, I couldn't reach the assistant just now. Please try again.";
  }
  setUI(u => ({ chat: [...u.chat, { role: 'assistant', text: reply || 'Done.', cards }], thinking: false }));
}

export const SUGGESTIONS = ['How much can I still spend this week?', 'Gasté 45 mil en el mercado con la Visa', 'Make me a budget for a gym pocket', 'Where am I spending the most?'];

