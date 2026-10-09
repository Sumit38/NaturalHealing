import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { HealRecord } from './healer.js';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function writeReport(records: HealRecord[], file = '.heal/report.html'): void {
  const rows = records
    .map(
      (r) => `<tr><td>${esc(r.test)}</td><td><code>${esc(r.oldSelector)}</code></td><td><code>${esc(r.newSelector ?? '-')}</code></td>` +
        `<td>${r.confidence.toFixed(2)}</td><td>${r.verdict}</td><td>${r.status}</td><td>${esc(r.reason)}</td></tr>`,
    )
    .join('\n');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    `<!doctype html><meta charset="utf-8"><title>Heal report</title><style>body{font:14px system-ui;margin:2rem}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}table{border-collapse:collapse}</style>` +
      `<h1>Heal report</h1><table><tr><th>Test</th><th>Old</th><th>New</th><th>Confidence</th><th>Verdict</th><th>Status</th><th>Why</th></tr>${rows}</table>`,
  );
}
