import { execFile } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FingerprintStore } from '../src/store.js';

const fp = (i: number) => ({ node: { tag: 'a', role: 'link', name: String(i), text: '', attrs: {}, classes: [], ancestors: [], siblingIndex: 0, rect: { x: 0, y: 0, w: 1, h: 1 }, cssPath: 'a' }, viewport: { w: 1, h: 1 }, selector: '#' + i });

describe('fingerprint store', () => {
  it('keeps every write when several processes save at once', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'fp-'));
    const db = join(dir, 'fp.db');
    const script = join(dir, 'writer.mts');
    writeFileSync(script, `import { FingerprintStore } from ${JSON.stringify(pathToFileURL(resolve('src/store.ts')).href)};
const [file, who] = process.argv.slice(2);
const s = new FingerprintStore(file);
for (let i = 0; i < 40; i++) s.set(who + '-' + i, ${JSON.stringify(fp(0))});`);
    const tsx = pathToFileURL(resolve('node_modules/tsx/dist/esm/index.mjs')).href;
    await Promise.all(
      ['a', 'b', 'c', 'd'].map(
        (who) => new Promise<void>((done, fail) => execFile('node', ['--import', tsx, script, db, who], { timeout: 60_000 }, (err) => (err ? fail(err) : done()))),
      ),
    );
    assert.equal(new FingerprintStore(db).count(), 160);
  });

  it('imports an old fingerprints.json the first time a .db is opened', () => {
    const dir = mkdtempSync(join(tmpdir(), 'fp-'));
    writeFileSync(join(dir, 'fp.json'), JSON.stringify({ 't::#x': fp(1) }));
    const store = new FingerprintStore(join(dir, 'fp.db'));
    assert.equal(store.get('t::#x')?.selector, '#1');
  });
});
