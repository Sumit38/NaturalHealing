import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

/**
 * A small reader and writer for .xlsx workbooks (first sheet only, text and numbers, no formulas or styles on
 * input). Built on fflate rather than a spreadsheet library: these are untrusted uploads, so the unpacked size
 * is capped before anything is inflated.
 */

const MAX_UNPACKED = 60 * 1024 * 1024;
const MAX_ENTRIES = 300;
const MAX_ROWS = 20_000;
const MAX_COLS = 200;

const decode = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const escape = (s: string) =>
  s
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** True for the bytes a .xlsx (a zip file) starts with. */
export const looksLikeXlsx = (data: Uint8Array) => data.length > 4 && data[0] === 0x50 && data[1] === 0x4b;

/** Text of every <t> element inside a fragment, joined (rich text splits one string over several). */
function texts(fragment: string): string {
  let out = '';
  for (const m of fragment.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) out += decode(m[1]);
  return out;
}

const colIndex = (ref: string) => {
  let n = 0;
  for (const c of ref.replace(/[^A-Za-z]/g, '').toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

/** Rows of the first worksheet. Empty trailing rows are dropped and short rows are padded to the widest one. */
export function readXlsx(data: Uint8Array): string[][] {
  let entries = 0;
  let total = 0;
  const files = unzipSync(data, {
    filter: (f) => {
      total += f.originalSize;
      if (++entries > MAX_ENTRIES || total > MAX_UNPACKED) throw new Error('The spreadsheet is too large when unpacked.');
      return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name);
    },
  });
  const text = (name: string) => (files[name] ? strFromU8(files[name]) : '');

  // Find the first sheet's file through the workbook relationships; fall back to sheet1.xml.
  let sheetFile = 'xl/worksheets/sheet1.xml';
  const first = text('xl/workbook.xml').match(/<sheet\b[^>]*\br:id="([^"]+)"/);
  if (first) {
    const rel = [...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${first[1]}"`));
    const target = rel?.match(/Target="([^"]+)"/)?.[1];
    if (target) sheetFile = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }
  const sheet = text(sheetFile) || text('xl/worksheets/sheet1.xml');
  if (!sheet) throw new Error('No worksheet found in the spreadsheet.');

  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map((m) => texts(m[1]));
  const rows: string[][] = [];
  for (const rm of sheet.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    if (rows.length >= MAX_ROWS) break;
    const row: string[] = [];
    for (const cm of (rm[1] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cm[1];
      const ref = attrs.match(/\br="([A-Za-z]+\d+)"/)?.[1];
      const type = attrs.match(/\bt="([^"]+)"/)?.[1] ?? 'n';
      const body = cm[2] ?? '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = '';
      if (type === 's' && v !== undefined) value = shared[Number(v)] ?? '';
      else if (type === 'inlineStr') value = texts(body);
      else if (v !== undefined) value = decode(v);
      const at = ref ? colIndex(ref) : row.length;
      if (at >= MAX_COLS) continue;
      while (row.length < at) row.push('');
      row[at] = value.trim();
    }
    rows.push(row);
  }
  while (rows.length && rows[rows.length - 1].every((c) => !c)) rows.pop();
  const width = rows.reduce((n, r) => Math.max(n, r.length), 0);
  return rows.filter((r) => r.some((c) => c)).map((r) => [...r, ...Array(width - r.length).fill('')]);
}

const colName = (i: number) => {
  let s = '';
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/** A workbook with one sheet. The first row is styled as a header; long text wraps. `widths` are in characters. */
export function writeXlsx(rows: string[][], sheetName = 'Sheet1', widths: number[] = []): Uint8Array {
  const sheetRows = rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => `<c r="${colName(ci)}${ri + 1}" t="inlineStr" s="${ri === 0 ? 1 : 2}"><is><t xml:space="preserve">${escape(v)}</t></is></c>`)
        .join('');
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join('');
  const cols = widths.length ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : '';
  const xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(`${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': strToU8(`${xml}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escape(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`),
    'xl/styles.xml': strToU8(
      `${xml}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2F7D57"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`,
    ),
    'xl/worksheets/sheet1.xml': strToU8(`${xml}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>${cols}<sheetData>${sheetRows}</sheetData></worksheet>`),
  };
  return zipSync(files);
}
