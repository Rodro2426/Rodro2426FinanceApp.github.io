// Create or edit one of your own reminders (Calendar → Reminders).
import { useState } from 'react';
import { useApp, setData, closeSheet, flash } from '../lib/store';
import { TEXT } from '../lib/constants';
import { DAY_LETTERS, uid } from '../lib/derive';
import { ALL_WEEK, WEEKDAYS, WEEKEND, nightly, remindersOf } from '../lib/customReminders';
import type { CustomReminder } from '../lib/types';
import { FieldLabel, GhostDanger, PrimaryBtn, Toggle, textInput } from '../ui/bits';
import { SheetFrame } from './Sheet';

const same = (a: number[], b: number[]) => a.length === b.length && a.every(x => b.includes(x));

export function ReminderSheet({ id }: { id: string | null }) {
  const { data: d } = useApp();
  const old = id ? remindersOf(d).find(r => r.id === id) : undefined;
  const start = old ?? nightly(uid('rem'));
  const [title, setTitle] = useState(start.title);
  const [body, setBody] = useState(start.body);
  const [time, setTime] = useState(start.time);
  const [days, setDays] = useState<number[]>(start.days);
  const [on, setOn] = useState(start.on);
  const [confirmDel, setConfirmDel] = useState(false);
  const bad = !title.trim() || !/^\d{2}:\d{2}$/.test(time) || !days.length;

  const save = () => {
    if (bad) return;
    const r: CustomReminder = { id: start.id, title: title.trim().slice(0, 80), body: body.trim().slice(0, 160), time, days: [...days].sort(), on };
    setData(x => ({ reminders: old ? remindersOf(x).map(y => (y.id === r.id ? r : y)) : [...remindersOf(x), r] }));
    closeSheet(); flash(old ? 'Reminder saved' : `Reminder set for ${time}`);
  };
  const remove = () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    setData(x => ({ reminders: remindersOf(x).filter(y => y.id !== start.id) }));
    closeSheet(); flash('Reminder deleted');
  };
  const toggleDay = (k: number) => setDays(s => (s.includes(k) ? s.filter(x => x !== k) : [...s, k]));
  const preset = (label: string, set: number[]) => (
    <button key={label} onClick={() => setDays(set)} aria-pressed={same(days, set)} style={{ height: 34, padding: '0 13px', borderRadius: 999, border: 0, background: same(days, set) ? TEXT : 'var(--surface)', color: same(days, set) ? 'var(--on-text)' : TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
  );

  return (
    <SheetFrame title={old ? 'Edit reminder' : 'New reminder'}>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <FieldLabel m="4px 4px 6px">Title</FieldLabel>
        <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} aria-label="Title" style={textInput} />
        <FieldLabel m="14px 4px 6px">Message</FieldLabel>
        <input value={body} onChange={e => setBody(e.target.value)} maxLength={160} aria-label="Message" placeholder="Optional" style={textInput} />
        <FieldLabel m="14px 4px 6px">Time</FieldLabel>
        <input type="time" value={time} onChange={e => setTime(e.target.value)} aria-label="Time" style={{ ...textInput, fontSize: 20, fontWeight: 700, minHeight: 56, WebkitAppearance: 'none', appearance: 'none' }} />
        <FieldLabel m="14px 4px 6px">Repeat on</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: 4 }}>
          {DAY_LETTERS.map((l, k) => (
            <button key={k} onClick={() => toggleDay(k)} aria-pressed={days.includes(k)} style={{ height: 44, borderRadius: 14, border: 0, background: days.includes(k) ? 'var(--color-accent)' : 'var(--surface)', color: days.includes(k) ? '#fff' : TEXT, fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {preset('Every day', ALL_WEEK)}{preset('Weekdays', WEEKDAYS)}{preset('Weekends', WEEKEND)}
        </div>
        {!days.length && <span style={{ margin: '6px 4px 0', fontSize: 12.5, color: 'var(--color-accent-700)' }}>Pick at least one day.</span>}
        <div style={{ marginTop: 14, background: 'var(--surface)', borderRadius: 22, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700 }}>On</span>
          <Toggle on={on} onChange={setOn} label="Reminder on" />
        </div>
        <span style={{ margin: '8px 4px 0', fontSize: 12.5, lineHeight: 1.4, color: 'var(--color-neutral-700)' }}>It arrives on your lock screen (with notifications on) and in the notification center. Tapping it opens New expense.</span>
        <PrimaryBtn onClick={save} disabled={bad} mt={16}>{old ? 'Save reminder' : 'Create reminder'}</PrimaryBtn>
        {old && <GhostDanger onClick={remove}>{confirmDel ? 'Tap again to delete' : 'Delete reminder'}</GhostDanger>}
      </div>
    </SheetFrame>
  );
}
