// Builds the monthly expense workbook (Summary · Details · Card payments · Statement).
// Loaded on demand so the spreadsheet library stays out of the main bundle.
import XLSX from 'xlsx-js-style';
import type { ExportPayload } from './exportData';

type Style = Record<string, any>;
const PCT = '0.0%';
const DATE = 'yyyy-mm-dd';
const S: Record<string, Style> = {
  title: { font: { bold: true, sz: 16, color: { rgb: '201E1D' } } },
  sub: { font: { italic: true, sz: 10, color: { rgb: '7D7979' } } },
  section: { font: { bold: true, sz: 12, color: { rgb: '201E1D' } } },
  head: { font: { bold: true, color: { rgb: '7C1405' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFE0D9' } }, border: { bottom: { style: 'thin', color: { rgb: 'EC3013' } } } },
  total: { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F3F2F2' } }, border: { top: { style: 'thin', color: { rgb: '201E1D' } } } },
  note: { font: { sz: 10, color: { rgb: '605D5D' } } },
  zebra: { fill: { patternType: 'solid', fgColor: { rgb: 'FBF9F9' } } },
  over: { font: { bold: true, color: { rgb: 'AE1800' } } },
  ok: { font: { color: { rgb: '2E7D4F' } } },
  wrap: { font: { sz: 11, color: { rgb: '201E1D' } }, alignment: { wrapText: true, vertical: 'top' } }
};
const merge = (...xs: (Style | null | undefined)[]) => xs.filter(Boolean).reduce<Style>((a, b) => {
  const o = { ...a };
  for (const k in b) o[k] = typeof b![k] === 'object' && !Array.isArray(b![k]) ? { ...(a[k] || {}), ...b![k] } : b![k];
  return o;
}, {});
const serial = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

interface PutOpts { s?: Style | null; z?: string; f?: string; date?: boolean; c0?: number }
function sheet() {
  const ws: Record<string, any> = {}; let maxR = 0, maxC = 0;
  const put = (r: number, c: number, v: unknown, o: PutOpts = {}) => {
    const cell: Record<string, any> = o.f ? { t: 'n', f: o.f, v: typeof v === 'number' ? v : 0 } : typeof v === 'number' ? { t: 'n', v } : { t: 's', v: v == null ? '' : String(v) };
    let z = o.z;
    if (o.date) { cell.t = 'n'; cell.v = serial(String(v)); z = DATE; }
    if (z) cell.z = z;
    const st = merge(o.s, z ? { numFmt: z } : null);
    if (Object.keys(st).length) cell.s = st;
    ws[XLSX.utils.encode_cell({ r, c })] = cell;
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
  };
  const row = (r: number, vals: unknown[], o: PutOpts = {}) => vals.forEach((v, i) => { if (v !== undefined) put(r, i + (o.c0 || 0), v, o); });
  const merges: XLSX.Range[] = [];
  const mergeCells = (r: number, c0: number, c1: number) => merges.push({ s: { r, c: c0 }, e: { r, c: c1 } });
  const finish = (cols: number[]) => { if (merges.length) ws['!merges'] = merges; ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } }); ws['!cols'] = cols.map(w => ({ wch: w })); return ws as XLSX.WorkSheet; };
  return { put, row, finish, mergeCells, ws };
}

export function downloadWorkbook(d: ExportPayload) {
  const MONEY = d.currency === 'COP' ? '"$"#,##0' : `"${d.currency}"#,##0.00`;
  const wb = XLSX.utils.book_new();
  const det = d.details, nD = det.length, D0 = 6, D1 = D0 + Math.max(nD, 1) - 1;
  const rng = (col: string) => `Details!$${col}$${D0}:$${col}$${D1}`;

  // ---------- For AI (first sheet) ----------
  {
    const ai = d.ai, sb = sheet(), W = 8;
    sb.put(0, 0, ai.title, { s: S.title });
    let r = 2;
    ai.intro.forEach(t => {
      sb.put(r, 0, t, { s: S.wrap }); sb.mergeCells(r, 0, W - 1);
      sb.ws['!rows'] = sb.ws['!rows'] || [];
      sb.ws['!rows'][r] = { hpt: 15 * Math.max(1, Math.ceil(t.length / 120)) };
      r++;
    });
    ai.sections.forEach(sec => {
      r++;
      sb.put(r++, 0, sec.title, { s: S.section });
      if (sec.note) { sb.put(r, 0, sec.note, { s: S.note }); sb.mergeCells(r, 0, W - 1); r++; }
      sb.row(r++, sec.header, { s: S.head });
      if (!sec.rows.length) { sb.put(r++, 0, 'None', { s: S.note }); return; }
      sec.rows.forEach((row, i) => {
        const z = i % 2 ? S.zebra : null;
        row.forEach((cell, c) => {
          if (cell !== null && typeof cell === 'object') sb.put(r, c, cell.v, { z: cell.fmt === 'money' ? MONEY : PCT, s: z });
          else sb.put(r, c, cell, { s: z });
        });
        r++;
      });
    });
    XLSX.utils.book_append_sheet(wb, sb.finish([34, 18, 18, 16, 16, 14, 16, 18]), 'For AI');
  }

  // ---------- Summary ----------
  {
    const sb = sheet();
    sb.put(1, 0, d.title, { s: S.title });
    sb.put(2, 0, d.subtitle, { s: S.sub });
    sb.row(4, ['Month', 'Purchases', 'Fees & interest', 'Total spent'], { s: S.head });
    sb.row(4, ['Category', 'Total spent', '% of total'], { s: S.head, c0: 5 });
    let r = 5;
    d.months.forEach((m, i) => {
      const tot = det.filter(x => x.month === m).reduce((a, x) => a + x.amount, 0);
      const fin = det.filter(x => x.month === m && x.category === 'Financial').reduce((a, x) => a + x.amount, 0);
      const z = i % 2 ? S.zebra : null;
      sb.put(r, 0, m, { s: z });
      sb.put(r, 2, fin, { f: `SUMIFS(${rng('F')},${rng('A')},A${r + 1},${rng('C')},"Financial")`, z: MONEY, s: z });
      sb.put(r, 3, tot, { f: `SUMIFS(${rng('F')},${rng('A')},A${r + 1})`, z: MONEY, s: z });
      sb.put(r, 1, tot - fin, { f: `D${r + 1}-C${r + 1}`, z: MONEY, s: z });
      r++;
    });
    const mEnd = r;
    const grand = det.reduce((a, x) => a + x.amount, 0);
    sb.put(r, 0, 'TOTAL', { s: S.total });
    ['B', 'C', 'D'].forEach((L, i) => sb.put(r, i + 1, 0, { f: `SUM(${L}6:${L}${mEnd})`, z: MONEY, s: S.total }));

    const cats: Record<string, number> = {};
    det.forEach(x => { cats[x.category] = (cats[x.category] || 0) + x.amount; });
    const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    let cr = 5;
    catList.forEach(([c, v], i) => {
      const z = i % 2 ? S.zebra : null;
      sb.put(cr, 5, c, { s: z });
      sb.put(cr, 6, v, { f: `SUMIF(${rng('C')},F${cr + 1},${rng('F')})`, z: MONEY, s: z });
      sb.put(cr, 7, grand ? v / grand : 0, { f: `IF(SUM($G$6:$G$${5 + catList.length})=0,0,G${cr + 1}/SUM($G$6:$G$${5 + catList.length}))`, z: PCT, s: z });
      cr++;
    });
    sb.put(cr, 5, 'TOTAL', { s: S.total });
    sb.put(cr, 6, grand, { f: `SUM(G6:G${cr})`, z: MONEY, s: S.total });
    sb.put(cr, 7, 1, { z: PCT, s: S.total });

    r = Math.max(r, cr) + 2;
    d.notes.forEach(n => sb.put(r++, 0, n, { s: S.note }));

    if (d.pockets && d.pockets.length) {
      r += 1;
      sb.put(r++, 0, `Pockets vs plan · ${d.months[0]}`, { s: S.section });
      r++;
      sb.row(r, ['Pocket', 'Planned', 'Spent', 'Left', 'Used'], { s: S.head });
      const p0 = r + 1;
      r++;
      d.pockets.forEach((p, i) => {
        const z = i % 2 ? S.zebra : null;
        sb.put(r, 0, p.name, { s: z });
        sb.put(r, 1, p.planned, { z: MONEY, s: z });
        sb.put(r, 2, p.spent, { f: `SUMIFS(${rng('F')},${rng('G')},A${r + 1})`, z: MONEY, s: z });
        sb.put(r, 3, p.planned - p.spent, { f: `B${r + 1}-C${r + 1}`, z: MONEY, s: merge(z, p.planned - p.spent < 0 ? S.over : S.ok) });
        sb.put(r, 4, p.planned ? p.spent / p.planned : 0, { f: `IF(B${r + 1}=0,0,C${r + 1}/B${r + 1})`, z: PCT, s: z });
        r++;
      });
      sb.put(r, 0, 'TOTAL', { s: S.total });
      ['B', 'C', 'D'].forEach((L, i) => sb.put(r, i + 1, 0, { f: `SUM(${L}${p0 + 1}:${L}${r})`, z: MONEY, s: S.total }));
      sb.put(r, 4, 0, { f: `IF(B${r + 1}=0,0,C${r + 1}/B${r + 1})`, z: PCT, s: S.total });
      r += 2;
    }

    r += 1;
    sb.put(r++, 0, 'Categories by month · highest to lowest', { s: S.section });
    r++;
    sb.row(r++, ['Month', 'Category', 'Subcategory', 'Spent', '% of month'], { s: S.head });
    let zi = 0;
    d.months.forEach(m => {
      const inM = det.filter(x => x.month === m), mt = inM.reduce((a, x) => a + x.amount, 0);
      const by: Record<string, number> = {};
      inM.forEach(x => { const k = x.category + '\u0001' + x.sub; by[k] = (by[k] || 0) + x.amount; });
      Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        const [c, s] = k.split('\u0001'), z = zi++ % 2 ? S.zebra : null;
        sb.row(r, [m, c, s], { s: z });
        sb.put(r, 3, v, { z: MONEY, s: z });
        sb.put(r, 4, mt ? v / mt : 0, { z: PCT, s: z });
        r++;
      });
    });
    XLSX.utils.book_append_sheet(wb, sb.finish([16, 22, 20, 16, 3, 22, 16, 12]), 'Summary');
  }

  // ---------- Details ----------
  {
    const sb = sheet();
    sb.put(1, 0, 'Expenses by month and category', { s: S.title });
    sb.put(2, 0, `${d.currency} · Categories and transactions ordered from highest to lowest spend within each month.`, { s: S.sub });
    sb.row(4, ['Month', 'Date', 'Category', 'Subcategory', 'Merchant / description', 'Amount', 'Pocket', 'Account', 'Tags', 'ID'], { s: S.head });
    det.forEach((x, i) => {
      const r = 5 + i, z = i % 2 ? S.zebra : null;
      sb.put(r, 0, x.month, { s: z });
      sb.put(r, 1, x.date, { date: true, s: z });
      sb.row(r, [x.category, x.sub, x.merchant], { c0: 2, s: z });
      sb.put(r, 5, x.amount, { z: MONEY, s: z });
      sb.row(r, [x.pocket, x.account, x.tags, x.id], { c0: 6, s: z });
    });
    const tr = 5 + Math.max(nD, 1);
    sb.put(tr, 4, 'TOTAL', { s: S.total });
    sb.put(tr, 5, 0, { f: `SUM(F6:F${tr})`, z: MONEY, s: S.total });
    XLSX.utils.book_append_sheet(wb, sb.finish([10, 12, 18, 18, 28, 14, 16, 18, 20, 8]), 'Details');
  }

  // ---------- Card payments ----------
  {
    const sb = sheet();
    sb.put(1, 0, 'Card payments', { s: S.title });
    sb.put(2, 0, 'Kept for reference; not counted as spending.', { s: S.sub });
    sb.row(4, ['Month', 'Date', 'Description', 'Amount', 'From', 'To', 'ID'], { s: S.head });
    d.payments.forEach((p, i) => {
      const r = 5 + i, z = i % 2 ? S.zebra : null;
      sb.put(r, 0, p.month, { s: z });
      sb.put(r, 1, p.date, { date: true, s: z });
      sb.put(r, 2, p.desc, { s: z });
      sb.put(r, 3, p.amount, { z: MONEY, s: z });
      sb.row(r, [p.from, p.to, p.id], { c0: 4, s: z });
    });
    const tr = 6 + Math.max(d.payments.length, 1);
    sb.put(tr, 2, 'Total payments', { s: S.total });
    sb.put(tr, 3, 0, { f: `SUM(D6:D${tr - 1})`, z: MONEY, s: S.total });
    XLSX.utils.book_append_sheet(wb, sb.finish([10, 12, 30, 14, 18, 18, 8]), 'Card payments');
  }

  // ---------- Statement (single account) ----------
  if (d.statement) {
    const st = d.statement, sb = sheet();
    sb.put(1, 0, `${st.account} · statement`, { s: S.title });
    sb.put(2, 0, st.card ? 'Balance owed on the card after each movement.' : 'Account balance after each movement.', { s: S.sub });
    sb.row(4, ['Date', 'Description', 'Category', 'Amount', st.card ? 'Owed after' : 'Balance after'], { s: S.head });
    let r = 5;
    sb.put(r, 1, st.card ? 'Opening balance owed' : 'Opening balance', { s: S.total });
    sb.put(r, 4, st.opening, { z: MONEY, s: S.total }); r++;
    st.rows.forEach((x, i) => {
      const z = i % 2 ? S.zebra : null;
      sb.put(r, 0, x.date, { date: true, s: z });
      sb.row(r, [x.desc, x.category], { c0: 1, s: z });
      sb.put(r, 3, x.amount, { z: MONEY, s: z });
      sb.put(r, 4, x.after, { z: MONEY, s: z });
      r++;
    });
    sb.put(r, 1, st.card ? 'Closing balance owed' : 'Closing balance', { s: S.total });
    sb.put(r, 4, st.closing, { z: MONEY, s: S.total });
    XLSX.utils.book_append_sheet(wb, sb.finish([12, 30, 18, 14, 16]), 'Statement');
  }

  XLSX.writeFile(wb, d.filename + '.xlsx', { cellStyles: true });
}
