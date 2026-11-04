// Backup to a single .json file (everything, including photos) and restore from it.
import type { Data } from './types';
import { getData, normalize, replaceData, setData } from './store';
import { todayISO } from './dates';

interface BackupFile { app: 'pockets'; format: 1; exportedAt: string; data: Data }

export function backupFileName(date = todayISO()) { return `Pockets backup ${date}.json`; }

/**
 * Opens the share sheet with the backup file (so it can go to iCloud Drive via
 * "Save to Files"); falls back to a normal download where sharing files isn't supported.
 * Returns 'shared' | 'downloaded' | 'cancelled'.
 */
export async function makeBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const body: BackupFile = { app: 'pockets', format: 1, exportedAt: new Date().toISOString(), data: getData() };
  const json = JSON.stringify(body);
  const name = backupFileName();
  const file = new File([json], name, { type: 'application/json' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Pockets backup' });
      markBackedUp();
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled';
      // Some browsers refuse; fall through to a download.
    }
  }
  const url = URL.createObjectURL(file), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  markBackedUp();
  return 'downloaded';
}

function markBackedUp() { setData(x => ({ settings: { ...x.settings, lastBackup: todayISO() } })); }

export interface BackupSummary { exportedAt: string; name: string; accounts: number; expenses: number; pockets: number; scheduled: number; trades: number }

/** Reads and checks a backup file. Throws a readable message if it isn't one. */
export async function readBackup(f: File): Promise<{ data: Data; summary: BackupSummary }> {
  let parsed: unknown;
  try { parsed = JSON.parse(await f.text()); } catch { throw new Error("That file isn't a Pockets backup."); }
  const b = parsed as Partial<BackupFile>;
  const d = b && b.app === 'pockets' ? b.data : undefined;
  if (!d || d.version !== 1 || !Array.isArray(d.accounts) || !Array.isArray(d.expenses) || !d.settings) throw new Error("That file isn't a Pockets backup.");
  const data = normalize(d);
  return {
    data,
    summary: {
      exportedAt: b.exportedAt || '', name: data.settings.name, accounts: data.accounts.length, expenses: data.expenses.length,
      pockets: data.pockets.length, scheduled: data.bills.length, trades: data.investments.trades.length
    }
  };
}

/** Replaces everything on this device with the backup (keeps the restored "last backup" date). */
export function restoreBackup(data: Data) { replaceData(data); }

/** Lets the person pick a file from Files / iCloud Drive. */
export function pickBackupFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.onchange = () => resolve(input.files && input.files[0] ? input.files[0] : null);
    input.click();
  });
}
