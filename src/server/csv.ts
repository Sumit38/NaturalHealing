/** CSV reading and writing for the spreadsheets testers upload and download. */

/** Picks the delimiter from the header line: comma, semicolon or tab, whichever appears most outside quotes. */
export function detectDelimiter(text: string): string {
  const first = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? '';
  let quoted = false;
  const count: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (const c of first) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && c in count) count[c]++;
  }
  const best = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

/** Undoes the apostrophe that exports add in front of text a spreadsheet would run as a formula. */
const untext = (x: string) => x.trim().replace(/^'(?=[=+\-@])/, '');

/** Splits CSV text into rows, honouring quotes, escaped quotes and CRLF. Blank rows are dropped. */
export function parseCsvRows(text: string, delimiter = detectDelimiter(text)): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  const endRow = () => {
    row.push(cell);
    if (row.some((x) => x.trim())) out.push(row.map(untext));
    row = [];
    cell = '';
  };
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      endRow();
    } else cell += c;
  }
  endRow();
  return out;
}

const csvCell = (v: string) => {
  // A spreadsheet runs text that starts with = + - @ as a formula; keep it as text.
  const safe = /^[=+\-@]/.test(v) ? "'" + v : v;
  return /[",\n\r]/.test(safe) ? '"' + safe.replace(/"/g, '""') + '"' : safe;
};

/** Writes rows as CSV with a UTF-8 byte-order mark, so Excel reads accents and symbols correctly. */
export function writeCsv(rows: string[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
