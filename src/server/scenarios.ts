/** Planned test scenarios, supplied as CSV, and the matching of automated tests to them. */
import { parseCsvRows } from './csv.js';

export interface Scenario {
  id: string;
  title: string;
  area?: string;
  priority?: string;
}

const HEADERS: Record<keyof Scenario, RegExp> = {
  id: /^(id|key|tc|test ?case( id)?|scenario ?id|case ?id)$/i,
  title: /^(title|name|scenario|summary|description|test ?case ?name)$/i,
  area: /^(area|module|feature|component|page|section)$/i,
  priority: /^(priority|severity|risk|criticality)$/i,
};

/** Reads a scenario list. With a header row columns are found by name; without one, one column is the title, two are id and title. */
export function parseScenarios(csv: string): Scenario[] {
  const all = parseCsvRows(csv);
  if (!all.length) return [];
  const header = all[0];
  const col = (k: keyof Scenario) => header.findIndex((h) => HEADERS[k].test(h));
  const hasHeader = col('title') !== -1 || col('id') !== -1;
  let idx = { id: col('id'), title: col('title'), area: col('area'), priority: col('priority') };
  let data = all.slice(1);
  if (!hasHeader) {
    data = all;
    idx = all[0].length >= 2 ? { id: 0, title: 1, area: all[0].length > 2 ? 2 : -1, priority: all[0].length > 3 ? 3 : -1 } : { id: -1, title: 0, area: -1, priority: -1 };
  } else if (idx.title === -1) {
    idx.title = idx.id; // only an id column
  }
  return data
    .map((r, i): Scenario => {
      const title = (r[idx.title] ?? '').trim();
      const id = (idx.id >= 0 ? r[idx.id] : '')?.trim() || `S${String(i + 1).padStart(2, '0')}`;
      return { id, title: title || id, area: idx.area >= 0 ? r[idx.area] || undefined : undefined, priority: idx.priority >= 0 ? r[idx.priority] || undefined : undefined };
    })
    .filter((s) => s.title);
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A test belongs to a scenario when its name contains the scenario id, or the two titles contain one another. */
export function matches(scenario: Scenario, testTitle: string): boolean {
  if (new RegExp(`(^|[^a-z0-9])${escapeRe(scenario.id)}([^a-z0-9]|$)`, 'i').test(testTitle)) return true;
  const a = norm(scenario.title);
  const b = norm(testTitle);
  return a.length >= 6 && b.length >= 6 && (b.includes(a) || a.includes(b));
}
