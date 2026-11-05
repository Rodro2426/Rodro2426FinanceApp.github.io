// Turns new activity in shared trips (other people's expenses, payments and messages) into Home notifications.
import { checkTripActivity, loadItems, markRead, myUid, type TripActivity } from './social';
import { getState, openSheet, setData, setUI } from './store';
import { fmt } from './derive';
import { sharesOf } from './settle';
import { todayISO } from './dates';
import type { Notif } from './types';

/** The notifications for one batch of activity. Messages are grouped: one notification per trip per day, updated as more arrive. */
export function tripNotifs(acts: TripActivity[], uid: string, today: string, existing: Notif[], now = Date.now()): Notif[] {
  const out: Notif[] = [];
  acts.forEach(({ trip, items, messages }) => {
    const title = `${trip.emoji} ${trip.name}`.trim();
    const who = (id: string) => trip.names[id] ?? trip.guests.find(g => g.id === id)?.name ?? 'Someone';
    items.forEach(it => {
      let body: string;
      if (it.kind === 'payment') body = it.to === uid ? `${who(it.paidBy)} paid you ${fmt(it.amount)}` : `${who(it.paidBy)} paid ${who(it.to ?? '')} ${fmt(it.amount)}`;
      else {
        const mine = sharesOf(it)[uid];
        body = `${who(it.createdBy)} added ${it.desc} · ${fmt(it.amount)}${mine ? ` · your share ${fmt(mine)}` : ''}`;
      }
      out.push({ id: `trip:${trip.id}:item:${it.id}`, date: today, ts: now, kind: 'trip', title, body, read: false, dismissed: false, bannered: false, link: { trip: trip.id, item: it.id } });
    });
    if (messages.length) {
      const id = `trip:${trip.id}:chat:${today}`;
      const before = existing.find(n => n.id === id && !n.dismissed);
      const count = messages.length + (before ? Number(before.body.match(/^(\d+) new messages/)?.[1] ?? 1) : 0);
      const last = messages[messages.length - 1];
      const text = last.text.length > 80 ? last.text.slice(0, 79) + '…' : last.text;
      out.push({ id, date: today, ts: now, kind: 'trip', title, body: count > 1 ? `${count} new messages · ${last.name}: ${text}` : `${last.name}: ${text}`, read: false, dismissed: false, bannered: false, link: { trip: trip.id, chat: true } });
    }
  });
  return out;
}

let busy = false;
/** Checks the trips once and adds what's new to the notifications. Skipped during the tour (practice data). */
export async function pollTrips() {
  if (busy || getState().ui.tour) return;
  busy = true;
  try {
    const acts = await checkTripActivity();
    const page = getState().ui.page;
    // Messages in a chat you're looking at right now don't need a notification.
    const shown = acts.map(a => (page === `tripchat:${a.trip.id}` ? { ...a, messages: [] } : a)).filter(a => a.items.length || a.messages.length);
    if (!shown.length) return;
    setData(x => {
      const fresh = tripNotifs(shown, myUid(), todayISO(), x.notifications);
      const ids = new Set(fresh.map(n => n.id));
      return { notifications: [...fresh, ...x.notifications.filter(n => !ids.has(n.id))] };
    });
  } catch { /* offline or signed out: try again next time */ } finally { busy = false; }
}

/** Opens what a trip notification is about: the chat, or the trip with that expense open. */
export async function openTripLink(link: NonNullable<Notif['link']>) {
  if (link.chat) { setUI({ sheet: null, page: `tripchat:${link.trip}` }); markRead(link.trip); return; }
  setUI({ sheet: null, page: `trip:${link.trip}` });
  if (link.item) { await loadItems(link.trip).catch(() => {}); openSheet({ name: 'tripItem', trip: link.trip, id: link.item }); }
}
