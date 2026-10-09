import { readFileSync, writeFileSync } from 'node:fs';

export interface PatchResult {
  applied: boolean;
  reason: string;
}

/**
 * Replaces the selector string literal in a test file. MVP text replace: it
 * refuses unless the literal appears exactly once, so a shared selector is
 * never rewritten blindly. A TypeScript syntax-tree patcher replaces this later.
 */
export function patchSelector(file: string, oldSelector: string, newSelector: string): PatchResult {
  const src = readFileSync(file, 'utf8');
  const literals = ["'", '"', '`'].map((q) => q + oldSelector.split(q).join('\\' + q) + q);
  const hits = literals.flatMap((lit) => {
    const found: number[] = [];
    for (let i = src.indexOf(lit); i !== -1; i = src.indexOf(lit, i + 1)) found.push(i);
    return found.map((at) => ({ at, len: lit.length }));
  });
  if (hits.length === 0) return { applied: false, reason: 'Selector literal not found in the source file.' };
  if (hits.length > 1) return { applied: false, reason: 'Selector literal appears more than once; patch needs review.' };
  const { at, len } = hits[0];
  writeFileSync(file, src.slice(0, at) + JSON.stringify(newSelector) + src.slice(at + len));
  return { applied: true, reason: 'Patched.' };
}
