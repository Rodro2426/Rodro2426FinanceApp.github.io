// Builds the monthly expense workbook (Summary · Details · Card payments · Statement).
const STYLE_LIB = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
const PLAIN_LIB = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs';

function loadScript(src) {
  return new Promise((res, rej) => {
    if (window.XLSX && window.XLSX.__styled) return res(window.XLSX);
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => { if (window.XLSX) { window.XLSX.__styled = true; res(window.XLSX); } else rej(new Error('no XLSX')); };
    s.onerror = () => rej(new Error('load failed'));
    document.head.appendChild(s);
  });
}
async function getXLSX() {
  try { return { X: await loadScript(STYLE_LIB), styled: true }; }
  catch (e) { return { X: await import(PLAIN_LIB), styled: false }; }
}

const MONEY = '"$"#,##0';
const PCT = '0.0%';
const DATE = 'yyyy-mm-dd';
const S = {
  title: { font: { bold: true, sz: 16, color: { rgb: '201E1D' } } },
  sub: { font: { italic: true, sz: 10, color: { rgb: '7D7979' } } },
  section: { font: { bold: true, sz: 12, color: { rgb: '201E1D' } } },
  head: { font: { bold: true, color: { rgb: '7C1405' } }, fill: { patternType: 'solid', fgColor: { rgb: 'FFE0D9' } }, border: { bottom: { style: 'thin', color: { rgb: 'EC3013' } } } },
  total: { font: { bold: true }, fill: { patternType: 'solid', fgColor: { rgb: 'F3F2F2' } }, border: { top: { style: 'thin', color: { rgb: '201E1D' } } } },
  note: { font: { sz: 10, color: { rgb: '605D5D' } } },
  zebra: { fill: { patternType: 'solid', fgColor: { rgb: 'FBF9F9' } } },
  over: { font: { bold: true, color: { rgb: 'AE1800' } } },
  ok: { font: { color: { rgb: '2E7D4F' } } }
};
const merge = (...xs) => xs.filter(Boolean).reduce((a, b) => {
  const o = { ...a };
  for (const k in b) o[k] = typeof b[k] === 'object' && !Array.isArray(b[k]) ? { ...(a[k] || {}), ...b[k] } : b[k];
  return o;
}, {});
const serial = iso => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };

function sheet(X) {
  const ws = {}; let maxR = 0, maxC = 0;
  const put = (r, c, v, o = {}) => {
    const cell = o.f ? { t: 'n', f: o.f, v: typeof v === 'number' ? v : 0 } : typeof v === 'number' ? { t: 'n', v } : { t: 's', v: v == null ? '' : String(v) };
    if (o.date) { cell.t = 'n'; cell.v = serial(v); o.z = DATE; }
    if (o.z) { cell.z = o.z; }
    const st = merge(o.s, o.z ? { numFmt: o.z } : null);
    if (Object.keys(st).length) cell.s = st;
    ws[X.utils.encode_cell({ r, c })] = cell;
    maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
  };
  const row = (r, vals, o = {}) => vals.forEach((v, i) => { if (v !== undefined) put(r, i + (o.c0 || 0), v, typeof o.each === 'function' ? o.each(i, v) : o); });
  const finish = cols => { ws['!ref'] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } }); ws['!cols'] = cols.map(w => ({ wch: w })); return ws; };
  return { put, row, finish, ref: (r, c) => X.utils.encode_cell({ r, c }) };
}

export async function downloadWorkbook(d) {
  const { X, styled } = await getXLSX();
  const wb = X.utils.book_new();
  const det = d.details, nD = det.length, D0 = 6, D1 = D0 + Math.max(nD, 1) - 1; // Details data rows (1-based)
  const rng = col => `Details!$${col}$${D0}:$${col}$${D1}`;

  // ---------- Summary ----------
  {
    const sb = sheet(X);
    sb.put(1, 0, d.title, { s: S.title });
    sb.put(2, 0, d.subtitle, { s: S.sub });
    sb.row(4, ['Month', 'Purchases', 'Fees & interest', 'Total spent'], { s: S.head });
    sb.row(4, ['Category', 'Total spent', '% of total'], { s: S.head, c0: 5 });
    let r = 5;
    const months = d.months;
    months.forEach((m, i) => {
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

    const cats = {};
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
    months.forEach(m => {
      const inM = det.filter(x => x.month === m), mt = inM.reduce((a, x) => a + x.amount, 0);
      const by = {};
      inM.forEach(x => { const k = x.category + '\u0001' + x.sub; by[k] = (by[k] || 0) + x.amount; });
      Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
        const [c, s] = k.split('\u0001'), z = zi++ % 2 ? S.zebra : null;
        sb.row(r, [m, c, s], { s: z });
        sb.put(r, 3, v, { z: MONEY, s: z });
        sb.put(r, 4, mt ? v / mt : 0, { z: PCT, s: z });
        r++;
      });
    });
    X.utils.book_append_sheet(wb, sb.finish([16, 22, 20, 16, 3, 22, 16, 12]), 'Summary');
  }

  // ---------- Details ----------
  {
    const sb = sheet(X);
    sb.put(1, 0, 'Expenses by month and category', { s: S.title });
    sb.put(2, 0, 'COP · Categories and transactions ordered from highest to lowest spend within each month.', { s: S.sub });
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
    X.utils.book_append_sheet(wb, sb.finish([10, 12, 18, 18, 28, 14, 16, 18, 20, 8]), 'Details');
  }

  // ---------- Card payments ----------
  {
    const sb = sheet(X);
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
    X.utils.book_append_sheet(wb, sb.finish([10, 12, 30, 14, 18, 18, 8]), 'Card payments');
  }

  // ---------- Statement (single account) ----------
  if (d.statement) {
    const st = d.statement, sb = sheet(X);
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
    X.utils.book_append_sheet(wb, sb.finish([12, 30, 18, 14, 16]), 'Statement');
  }

  X.writeFile(wb, d.filename + '.xlsx', { cellStyles: true });
  return styled;
}
