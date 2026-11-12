import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { sampleData } from './seed';
import { WEEKDAYS, customLockReminders, nextRing, nightly, remindsOn, ringingToday, timeOn } from './customReminders';
import { runSchedule } from './schedule';
import { upcomingReminders } from './reminders';

// 2026-11-09 is a Monday.
const mon = '2026-11-09', sat = '2026-11-14';

describe('custom reminders', () => {
  it('repeats only on the chosen weekdays, and not when off', () => {
    const r = { ...nightly('r1'), days: WEEKDAYS };
    expect(remindsOn(r, mon)).toBe(true);
    expect(remindsOn(r, sat)).toBe(false);
    expect(remindsOn({ ...r, on: false }, mon)).toBe(false);
  });

  it('lists lock-screen notifications for the next two weeks at the chosen time, opening New expense', () => {
    const d = { ...sampleData(), reminders: [{ ...nightly('r1'), days: WEEKDAYS }] };
    const now = timeOn(mon, '10:00');
    const list = customLockReminders(d, mon, 14, now);
    expect(list).toHaveLength(11); // weekdays in Nov 9–23
    expect(list[0]).toMatchObject({ at: timeOn(mon, '21:00'), url: '#add', tag: `rem:r1:${mon}` });
    expect(customLockReminders(d, mon, 14, timeOn(mon, '22:00'))[0].tag).toBe('rem:r1:2026-11-10');
  });

  it('knows the next time it rings', () => {
    const r = { ...nightly('r1'), days: [5] }; // Saturdays
    expect(nextRing(r, mon, timeOn(mon, '08:00'))).toBe(timeOn(sat, '21:00'));
    expect(nextRing({ ...r, on: false }, mon)).toBeNull();
  });

  it('adds it to the notification center once its time has come today, only once', () => {
    const d = { ...sampleData(), notifications: [], reminders: [{ ...nightly('r1'), time: '00:00' }] };
    expect(ringingToday(d, mon, timeOn(mon, '00:01')).map(r => r.id)).toEqual(['r1']);
    expect(ringingToday(d, mon, timeOn(mon, '00:00') - 1)).toEqual([]);
    const today = new Date(), iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const p = runSchedule(d, iso)!;
    const mine = p.notifications!.filter(n => n.kind === 'reminder');
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ id: `rem:r1:${iso}`, title: "Add today's expenses" });
    const again = runSchedule({ ...d, ...p }, iso);
    expect((again?.notifications ?? p.notifications!).filter(n => n.kind === 'reminder')).toHaveLength(1);
  });

  it('goes to the lock-screen list with the other reminders', () => {
    const d = { ...sampleData(), reminders: [nightly('r1')] };
    expect(upcomingReminders(d).some(r => r.tag.startsWith('rem:r1:'))).toBe(true);
  });
});
