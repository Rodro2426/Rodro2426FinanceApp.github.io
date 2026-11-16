import { describe, expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import XLSX from 'xlsx-js-style';
import { sampleData } from './seed';
import { allMonths, exportData } from './exportData';
import { buildWorkbook } from './xlsx';

describe('Excel workbook', () => {
  const d = sampleData();
  const acct = d.accounts[0].id;
  const bytes = buildWorkbook(exportData(d, allMonths(d).at(-1)!, acct));
  if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, bytes);
  const zip = XLSX.CFB.read(bytes, { type: 'array' });
  const file = (p: string) => new TextDecoder().decode(zip.FileIndex[zip.FullPaths.indexOf('Root Entry/' + p)].content as Uint8Array);

  it('adds real Excel Tables for the sortable lists', () => {
    const tables = zip.FullPaths.filter((p: string) => p.includes('xl/tables/table'));
    expect(tables.length).toBe(4); // ByMonth, Expenses, Payments, Movements
    expect(file('[Content_Types].xml').match(/spreadsheetml\.table\+xml/g)!.length).toBe(4);
    expect(file('xl/worksheets/sheet3.xml')).toContain('<tablePart r:id="rIdT1"/>');
    expect(file('xl/tables/table2.xml')).toContain('name="Expenses"');
  });

  it('table header cells match the table column names', () => {
    const wb = XLSX.read(bytes, { type: 'array' });
    const ws = wb.Sheets.Details;
    expect(ws.A5.v).toBe('Month');
    expect(ws.F5.v).toBe('Amount');
    expect(file('xl/tables/table2.xml')).toContain('ref="A5:J');
  });

  it('hides gridlines, freezes headers and registers the brand table style', () => {
    expect(file('xl/worksheets/sheet3.xml')).toContain('showGridLines="0"');
    expect(file('xl/worksheets/sheet3.xml')).toContain('state="frozen"');
    expect(file('xl/styles.xml')).toContain('<tableStyle name="Pockets"');
  });
});
