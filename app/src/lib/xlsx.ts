// Builds the monthly expense workbook (For AI · Summary · Details · Card payments · Statement)
// in the "Cien mil" teal brand. Lists are real Excel Tables (sort/filter buttons, banded rows that
// survive sorting, totals that follow the filter). Loaded on demand to keep the library out of the main bundle.
import XLSX from 'xlsx-js-style';
import type { ExportPayload } from './exportData';

type Style = Record<string, any>;
const PCT = '0.0%';
const DATE = 'yyyy-mm-dd';
const C = { deep: '123C38', teal: '1F5F5A', mint: '8FD6CB', page: 'F5F8F4', line: 'E2DEDB', ink: '201E1D', ink3: '6B6764', green: 'DCF3E3', blue: 'D9E8FB', butter: 'FBEEC9', lilac: 'ECE3FB', red: 'D4301A', ok: '2E7D4F' };
const fill = (rgb: string) => ({ patternType: 'solid', fgColor: { rgb } });
const line = (rgb = C.line) => ({ style: 'thin', color: { rgb } });
const S: Record<string, Style> = {
  banner: { font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } }, fill: fill(C.deep), alignment: { vertical: 'center', indent: 1 } },
  bannerSub: { font: { sz: 10, color: { rgb: C.mint } }, fill: fill(C.deep), alignment: { vertical: 'top', indent: 1 } },
  section: { font: { bold: true, sz: 13, color: { rgb: C.teal } }, border: { bottom: line(C.teal) } },
  head: { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: fill(C.teal), alignment: { vertical: 'center' }, border: { bottom: line(C.deep) } },
  cell: { font: { color: { rgb: C.ink } }, border: { bottom: line() }, alignment: { vertical: 'center' } },
  zebra: { fill: fill(C.page) },
  total: { font: { bold: true, color: { rgb: C.deep } }, fill: fill(C.green), border: { top: line(C.teal), bottom: line(C.teal) } },
  note: { font: { sz: 10, color: { rgb: C.ink3 } } },
  tileLabel: { font: { sz: 9, bold: true, color: { rgb: C.ink3 } }, alignment: { indent: 1, vertical: 'bottom' } },
  tileValue: { font: { sz: 16, bold: true, color: { rgb: C.ink } }, alignment: { indent: 1, vertical: 'center' } },
  over: { font: { bold: true, color: { rgb: C.red } } },
  ok: { font: { bold: true, color: { rgb: C.ok } } },
  wrap: { font: { sz: 11, color: { rgb: C.ink } }, alignment: { wrapText: true, vertical: 'top' } }
};
const TILES = [C.green, C.blue, C.butter, C.lilac, C.green];
const merge = (...xs: (Style | null | undefined)[]) => xs.filter(Boolean).reduce<Style>((a, b) => {
  const o = { ...a };
  for (const k in b) o[k] = typeof b![k] === 'object' && !Array.isArray(b![k]) ? { ...(a[k] || {}), ...b![k] } : b![k];
  return o;
}, {});
const serial = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000; };
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface TableSpec { name: string; r: number; c0: number; cols: string[]; n: number; sums: number[] }
interface SheetExtra { tables: TableSpec[]; freeze?: number }
interface PutOpts { s?: Style | null; z?: string; f?: string; date?: boolean; c0?: number }

function sheet() {
  const ws: Record<string, any> = {}; let maxR = 0, maxC = 0;
  const extra: SheetExtra = { tables: [] };
  const rows: { hpt: number }[] = [];
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
  const height = (r: number, hpt: number) => { rows[r] = { hpt }; };
  const merges: XLSX.Range[] = [];
  const mergeCells = (r: number, c0: number, c1: number) => merges.push({ s: { r, c: c0 }, e: { r, c: c1 } });
  // Dark teal title band across the sheet width.
  const banner = (title: string, sub: string, w: number) => {
    for (let c = 0; c < w; c++) { put(0, c, c ? '' : title, { s: S.banner }); put(1, c, c ? '' : sub, { s: S.bannerSub }); }
    mergeCells(0, 0, w - 1); mergeCells(1, 0, w - 1); height(0, 36); height(1, 22);
  };
  const section = (r: number, text: string, w: number) => { for (let c = 0; c < w; c++) put(r, c, c ? '' : text, { s: S.section }); mergeCells(r, 0, w - 1); };
  // Small coloured number tile: label on top, value below.
  const tile = (r: number, c0: number, c1: number, label: string, v: unknown, o: PutOpts, tint: string) => {
    for (let c = c0; c <= c1; c++) { put(r, c, c === c0 ? label : '', { s: merge(S.tileLabel, { fill: fill(tint) }) }); put(r + 1, c, c === c0 ? v : '', { ...(c === c0 ? o : {}), s: merge(S.tileValue, { fill: fill(tint) }) }); }
    if (c1 > c0) { mergeCells(r, c0, c1); mergeCells(r + 1, c0, c1); }
    height(r, 18); height(r + 1, 28);
  };
  // Excel Table: header row at r, n data rows (caller fills them), a totals row with SUBTOTAL so it follows filters.
  const table = (name: string, r: number, c0: number, cols: string[], n: number, sums: number[], money: string) => {
    const t = { name, r, c0, cols, n: Math.max(n, 1), sums };
    extra.tables.push(t);
    row(r, cols, { s: S.head, c0 }); height(r, 22);
    const tr = r + t.n + 1;
    cols.forEach((col, i) => sums.includes(i)
      ? put(tr, c0 + i, 0, { f: `SUBTOTAL(109,${name}[${col}])`, z: money, s: S.total })
      : put(tr, c0 + i, i ? '' : 'Total', { s: S.total }));
    return tr;
  };
  const finish = (cols: number[]) => {
    if (merges.length) ws['!merges'] = merges;
    if (rows.length) ws['!rows'] = rows;
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
    ws['!cols'] = cols.map(w => ({ wch: w }));
    return ws as XLSX.WorkSheet;
  };
  return { put, row, finish, mergeCells, banner, section, tile, table, height, extra, ws };
}

export function buildWorkbook(d: ExportPayload): Uint8Array {
  const MONEY = d.currency === 'COP' ? '"$"#,##0' : `"${d.currency}"#,##0.00`;
  const wb = XLSX.utils.book_new();
  const extras: SheetExtra[] = [];
  const add = (sb: ReturnType<typeof sheet>, cols: number[], name: string) => { XLSX.utils.book_append_sheet(wb, sb.finish(cols), name); extras.push(sb.extra); };
  const det = d.details, nD = det.length, D0 = 6, D1 = D0 + Math.max(nD, 1) - 1;
  const rng = (col: string) => `Details!$${col}$${D0}:$${col}$${D1}`;
  const zebra = (i: number) => i % 2 ? merge(S.cell, S.zebra) : S.cell;

  // ---------- For AI (first sheet) ----------
  {
    const ai = d.ai, sb = sheet(), W = 8;
    sb.banner(ai.title, 'Context for an AI assistant · paste or upload this file and ask questions', W);
    let r = 3;
    ai.intro.forEach(t => {
      sb.put(r, 0, t, { s: S.wrap }); sb.mergeCells(r, 0, W - 1);
      sb.height(r, 15 * Math.max(1, Math.ceil(t.length / 120)));
      r++;
    });
    ai.sections.forEach(sec => {
      r++;
      sb.section(r, sec.title, W);
      r++;
      if (sec.note) { sb.put(r, 0, sec.note, { s: S.note }); sb.mergeCells(r, 0, W - 1); r++; }
      sb.row(r++, sec.header, { s: S.head });
      if (!sec.rows.length) { sb.put(r++, 0, 'None', { s: S.note }); return; }
      sec.rows.forEach((row, i) => {
        row.forEach((cell, c) => {
          if (cell !== null && typeof cell === 'object') sb.put(r, c, cell.v, { z: cell.fmt === 'money' ? MONEY : PCT, s: zebra(i) });
          else sb.put(r, c, cell, { s: zebra(i) });
        });
        r++;
      });
    });
    add(sb, [34, 18, 18, 16, 16, 14, 16, 18], 'For AI');
  }

  // ---------- Summary ----------
  {
    const sb = sheet(), H = 6; // header row of the two side-by-side tables
    sb.banner(d.title, d.subtitle, 8);
    sb.row(H, ['Month', 'Purchases', 'Fees & interest', 'Total spent'], { s: S.head });
    sb.row(H, ['Category', 'Total spent', '% of total'], { s: S.head, c0: 5 });
    sb.height(H, 22);
    let r = H + 1;
    d.months.forEach((m, i) => {
      const tot = det.filter(x => x.month === m).reduce((a, x) => a + x.amount, 0);
      const fin = det.filter(x => x.month === m && x.category === 'Financial').reduce((a, x) => a + x.amount, 0);
      const z = zebra(i);
      sb.put(r, 0, m, { s: z });
      sb.put(r, 2, fin, { f: `SUMIFS(${rng('F')},${rng('A')},A${r + 1},${rng('C')},"Financial")`, z: MONEY, s: z });
      sb.put(r, 3, tot, { f: `SUMIFS(${rng('F')},${rng('A')},A${r + 1})`, z: MONEY, s: z });
      sb.put(r, 1, tot - fin, { f: `D${r + 1}-C${r + 1}`, z: MONEY, s: z });
      r++;
    });
    const mTot = r + 1; // Excel row of the month TOTAL
    const grand = det.reduce((a, x) => a + x.amount, 0);
    const fees = det.filter(x => x.category === 'Financial').reduce((a, x) => a + x.amount, 0);
    sb.put(r, 0, 'TOTAL', { s: S.total });
    ['B', 'C', 'D'].forEach((L, i) => sb.put(r, i + 1, 0, { f: `SUM(${L}${H + 2}:${L}${r})`, z: MONEY, s: S.total }));

    const cats: Record<string, number> = {};
    det.forEach(x => { cats[x.category] = (cats[x.category] || 0) + x.amount; });
    const catList = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const g0 = H + 2, g1 = H + 1 + catList.length;
    let cr = H + 1;
    catList.forEach(([c, v], i) => {
      const z = zebra(i);
      sb.put(cr, 5, c, { s: z });
      sb.put(cr, 6, v, { f: `SUMIF(${rng('C')},F${cr + 1},${rng('F')})`, z: MONEY, s: z });
      sb.put(cr, 7, grand ? v / grand : 0, { f: `IF(SUM($G$${g0}:$G$${g1})=0,0,G${cr + 1}/SUM($G$${g0}:$G$${g1}))`, z: PCT, s: z });
      cr++;
    });
    sb.put(cr, 5, 'TOTAL', { s: S.total });
    sb.put(cr, 6, grand, { f: `SUM(G${g0}:G${cr})`, z: MONEY, s: S.total });
    sb.put(cr, 7, 1, { z: PCT, s: S.total });

    // Headline tiles (row 3–4), live formulas over the tables below.
    const top = catList[0];
    sb.tile(3, 0, 0, 'TOTAL SPENT', grand, { f: `D${mTot}`, z: MONEY }, TILES[0]);
    sb.tile(3, 1, 1, 'PURCHASES', grand - fees, { f: `B${mTot}`, z: MONEY }, TILES[1]);
    sb.tile(3, 2, 2, 'FEES & INTEREST', fees, { f: `C${mTot}`, z: MONEY }, TILES[2]);
    sb.tile(3, 3, 3, 'TRANSACTIONS', nD, { f: `COUNT(${rng('F')})` }, TILES[3]);
    sb.tile(3, 5, 7, 'TOP CATEGORY', top ? `${top[0]} · ${Math.round(grand ? top[1] / grand * 100 : 0)}%` : '—', {}, TILES[4]);

    r = Math.max(r, cr) + 2;
    d.notes.forEach(n => sb.put(r++, 0, n, { s: S.note }));

    if (d.pockets && d.pockets.length) {
      r += 1;
      sb.section(r, `Pockets vs plan · ${d.months[0]}`, 5);
      r += 2;
      sb.row(r, ['Pocket', 'Planned', 'Spent', 'Left', 'Used'], { s: S.head });
      const p0 = r + 1;
      r++;
      d.pockets.forEach((p, i) => {
        const z = zebra(i);
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
    sb.section(r, 'Categories by month · use the arrows to sort or filter', 5);
    r += 2;
    const rows: [string, string, string, number, number][] = [];
    d.months.forEach(m => {
      const inM = det.filter(x => x.month === m), mt = inM.reduce((a, x) => a + x.amount, 0);
      const by: Record<string, number> = {};
      inM.forEach(x => { const k = x.category + '\u0001' + x.sub; by[k] = (by[k] || 0) + x.amount; });
      Object.entries(by).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => { const [c, s] = k.split('\u0001'); rows.push([m, c, s, v, mt ? v / mt : 0]); });
    });
    sb.table('ByMonth', r, 0, ['Month', 'Category', 'Subcategory', 'Spent', '% of month'], rows.length, [3], MONEY);
    rows.forEach(([m, c, s, v, p], i) => {
      sb.row(r + 1 + i, [m, c, s], { s: S.cell });
      sb.put(r + 1 + i, 3, v, { z: MONEY, s: S.cell });
      sb.put(r + 1 + i, 4, p, { z: PCT, s: S.cell });
    });
    add(sb, [18, 22, 20, 18, 12, 22, 16, 12], 'Summary');
  }

  // ---------- Details ----------
  {
    const sb = sheet();
    sb.banner('Expenses by month and category', `${d.currency} · Use the arrows on each header to sort or filter · the total follows your filter`, 10);
    sb.table('Expenses', D0 - 2, 0, ['Month', 'Date', 'Category', 'Subcategory', 'Merchant / description', 'Amount', 'Pocket', 'Account', 'Tags', 'ID'], nD, [5], MONEY);
    det.forEach((x, i) => {
      const r = D0 - 1 + i;
      sb.put(r, 0, x.month, { s: S.cell });
      sb.put(r, 1, x.date, { date: true, s: S.cell });
      sb.row(r, [x.category, x.sub, x.merchant], { c0: 2, s: S.cell });
      sb.put(r, 5, x.amount, { z: MONEY, s: S.cell });
      sb.row(r, [x.pocket, x.account, x.tags, x.id], { c0: 6, s: S.cell });
    });
    sb.extra.freeze = D0 - 1;
    add(sb, [10, 12, 18, 18, 30, 15, 16, 18, 20, 8], 'Details');
  }

  // ---------- Card payments ----------
  {
    const sb = sheet();
    sb.banner('Card payments', 'Kept for reference; not counted as spending.', 7);
    sb.table('Payments', 4, 0, ['Month', 'Date', 'Description', 'Amount', 'From', 'To', 'ID'], d.payments.length, [3], MONEY);
    d.payments.forEach((p, i) => {
      const r = 5 + i;
      sb.put(r, 0, p.month, { s: S.cell });
      sb.put(r, 1, p.date, { date: true, s: S.cell });
      sb.put(r, 2, p.desc, { s: S.cell });
      sb.put(r, 3, p.amount, { z: MONEY, s: S.cell });
      sb.row(r, [p.from, p.to, p.id], { c0: 4, s: S.cell });
    });
    sb.extra.freeze = 5;
    add(sb, [10, 12, 30, 15, 18, 18, 8], 'Card payments');
  }

  // ---------- Statement (single account) ----------
  if (d.statement) {
    const st = d.statement, sb = sheet();
    sb.banner(`${st.account} · statement`, st.card ? 'Balance owed on the card after each movement.' : 'Account balance after each movement.', 5);
    sb.tile(2, 0, 1, st.card ? 'OPENING BALANCE OWED' : 'OPENING BALANCE', st.opening, { z: MONEY }, C.blue);
    sb.tile(2, 3, 4, st.card ? 'CLOSING BALANCE OWED' : 'CLOSING BALANCE', st.closing, { z: MONEY }, C.green);
    sb.table('Movements', 5, 0, ['Date', 'Description', 'Category', 'Amount', st.card ? 'Owed after' : 'Balance after'], st.rows.length, [3], MONEY);
    st.rows.forEach((x, i) => {
      const r = 6 + i;
      sb.put(r, 0, x.date, { date: true, s: S.cell });
      sb.row(r, [x.desc, x.category], { c0: 1, s: S.cell });
      sb.put(r, 3, x.amount, { z: MONEY, s: S.cell });
      sb.put(r, 4, x.after, { z: MONEY, s: S.cell });
    });
    sb.extra.freeze = 6;
    add(sb, [14, 30, 18, 15, 18], 'Statement');
  }

  return polish(XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true }), extras);
}

// SheetJS can't write Excel Tables, hidden gridlines, frozen headers or tab colours, so we add them to the zip.
function polish(buf: ArrayBuffer, extras: SheetExtra[]): Uint8Array {
  const CFB = XLSX.CFB, zip = CFB.read(new Uint8Array(buf), { type: 'array' });
  const at = (p: string) => zip.FileIndex[zip.FullPaths.indexOf('Root Entry/' + p)];
  const read = (p: string) => new TextDecoder().decode(at(p).content as Uint8Array);
  const write = (p: string, s: string) => { const e = at(p), b = new TextEncoder().encode(s); if (e) e.content = b as any; else CFB.utils.cfb_add(zip, '/' + p, b); };

  // Brand table style: mint banding + hairline rows. Header and totals keep their own cell colours.
  write('xl/styles.xml', read('xl/styles.xml')
    .replace(/<dxfs count="0"\/>/, `<dxfs count="2"><dxf><fill><patternFill patternType="solid"><bgColor rgb="FFEDF4EF"/></patternFill></fill></dxf><dxf><border><bottom style="thin"><color rgb="FF${C.line}"/></bottom><horizontal style="thin"><color rgb="FF${C.line}"/></horizontal></border></dxf></dxfs>`)
    .replace(/<tableStyles [^>]*\/>/, '<tableStyles count="1" defaultTableStyle="TableStyleMedium9" defaultPivotStyle="PivotStyleLight16"><tableStyle name="Pockets" pivot="0" count="2"><tableStyleElement type="wholeTable" dxfId="1"/><tableStyleElement type="firstRowStripe" dxfId="0"/></tableStyle></tableStyles>'));

  let ct = read('[Content_Types].xml'), tid = 0;
  extras.forEach((x, i) => {
    const p = `xl/worksheets/sheet${i + 1}.xml`;
    let xml = read(p)
      .replace(/(<worksheet[^>]*>)/, `$1<sheetPr><tabColor rgb="FF${i ? C.teal : C.mint}"/></sheetPr>`)
      .replace('<sheetView workbookViewId="0"/>', `<sheetView showGridLines="0" workbookViewId="0">${x.freeze ? `<pane ySplit="${x.freeze}" topLeftCell="A${x.freeze + 1}" activePane="bottomLeft" state="frozen"/>` : ''}</sheetView>`);
    if (x.tables.length) {
      const rels: string[] = [];
      x.tables.forEach((t, k) => {
        tid++;
        const ref = (rows: number) => XLSX.utils.encode_range({ s: { r: t.r, c: t.c0 }, e: { r: t.r + rows, c: t.c0 + t.cols.length - 1 } });
        const cols = t.cols.map((c, j) => `<tableColumn id="${j + 1}" name="${esc(c)}"${t.sums.includes(j) ? ' totalsRowFunction="sum"' : j ? '' : ' totalsRowLabel="Total"'}/>`).join('');
        write(`xl/tables/table${tid}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${tid}" name="${t.name}" displayName="${t.name}" ref="${ref(t.n + 1)}" totalsRowCount="1"><autoFilter ref="${ref(t.n)}"/><tableColumns count="${t.cols.length}">${cols}</tableColumns><tableStyleInfo name="Pockets" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`);
        ct = ct.replace('</Types>', `<Override PartName="/xl/tables/table${tid}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/></Types>`);
        rels.push(`<Relationship Id="rIdT${k + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${tid}.xml"/>`);
      });
      xml = xml.replace('</worksheet>', `<tableParts count="${x.tables.length}">${x.tables.map((_, k) => `<tablePart r:id="rIdT${k + 1}"/>`).join('')}</tableParts></worksheet>`);
      // shortcut: assumes SheetJS writes no sheet rels (true while we add no comments/links); merge if that changes.
      write(`xl/worksheets/_rels/sheet${i + 1}.xml.rels`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join('')}</Relationships>`);
    }
    write(p, xml);
  });
  write('[Content_Types].xml', ct);
  return new Uint8Array(CFB.write(zip, { fileType: 'zip', type: 'array' }) as ArrayLike<number>);
}

export function downloadWorkbook(d: ExportPayload) {
  const blob = new Blob([buildWorkbook(d) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = url; el.download = d.filename + '.xlsx'; document.body.appendChild(el); el.click(); el.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
