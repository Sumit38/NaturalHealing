import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { playwrightProbe } from '../healer.js';
import { callerFile } from '../core.js';
import type { AutoHealer } from './auto-healer.js';
import type { CoverageRecorder, PageLike } from './coverage.js';
import type { Snapshot } from '../model.js';

/** Locator methods that act on an element or read it. Assertions go through _expect and are never touched. */
const ACTIONS = [
  'click', 'dblclick', 'fill', 'clear', 'check', 'uncheck', 'setChecked', 'hover', 'press', 'type', 'pressSequentially',
  'selectOption', 'selectText', 'focus', 'blur', 'tap', 'dispatchEvent', 'setInputFiles', 'scrollIntoViewIfNeeded',
  'textContent', 'innerText', 'innerHTML', 'inputValue', 'getAttribute', 'dragTo',
];

const pageLike = (page: any, snapshot: () => Promise<Snapshot>): PageLike => ({
  url: () => page.url(),
  title: () => page.title(),
  snapshot,
});

/** Patches Playwright's Locator in the test project, if it has one. Returns false when Playwright is not installed. */
export function installPlaywright(healer: AutoHealer, cwd: string, lookupTimeout = 500, rec?: CoverageRecorder): boolean {
  const req = createRequire(join(cwd, 'package.json'));
  let Locator: any;
  let Page: any;
  let currentTestInfo: (() => { titlePath: string[] } | undefined) | undefined;
  try {
    const dir = dirname(req.resolve('playwright-core/package.json'));
    Locator = req(join(dir, 'lib', 'client', 'locator.js')).Locator;
    Page = req(join(dir, 'lib', 'client', 'page.js')).Page;
  } catch {
    return false;
  }
  try {
    // Present when the project uses @playwright/test; gives each heal the name of the running test.
    currentTestInfo = req(join(dirname(req.resolve('playwright/package.json')), 'lib', 'common', 'globals.js')).currentTestInfo;
  } catch {
    /* plain playwright-core: tests share one name */
  }
  if (!Locator || Locator.prototype.__healing) return false;
  Locator.prototype.__healing = true;

  const lookFor = (page: any) => {
    const probe = playwrightProbe(page, lookupTimeout);
    return { probe, like: pageLike(page, () => probe.snapshot()) };
  };

  if (rec && Page && typeof Page.prototype.goto === 'function') {
    const goto = Page.prototype.goto;
    Page.prototype.goto = async function (this: any, ...args: unknown[]) {
      const result = await goto.apply(this, args);
      await rec.visit(lookFor(this).like);
      return result;
    };
  }

  const busy = new WeakSet<object>();
  for (const name of ACTIONS) {
    const original = Locator.prototype[name];
    if (typeof original !== 'function') continue;
    Locator.prototype[name] = async function (this: any, ...args: unknown[]) {
      if (busy.has(this)) return original.apply(this, args);
      const file = callerFile();
      const selector: string = this._selector;
      let replacement: any;
      let healed = selector;
      let page: any;
      try {
        page = this._frame.page();
        if (!page || this._frame !== page.mainFrame()) return original.apply(this, args); // iframes: left alone
        const title = currentTestInfo?.()?.titlePath;
        if (title?.length) healer.setTest(title.slice(1).join(' > ') || title.join(' > '));
        busy.add(this);
        const { probe, like } = lookFor(page);
        const found = await probe.count(selector);
        if (found === 1) await healer.remember(probe, selector);
        else if (found === 0) healed = await healer.heal(probe, selector, file);
        if (healed !== selector) {
          replacement = new Locator(this._frame, healed);
          busy.add(replacement);
        }
        if (rec && (found >= 1 || healed !== selector)) await rec.interact(like, probe, healed);
      } catch {
        // Never let a failure inside healing hide the test's own result: fall back to the plain call.
        replacement = undefined;
      } finally {
        busy.delete(this);
      }
      try {
        if (!replacement) return await original.apply(this, args);
        try {
          const result = await original.apply(replacement, args);
          healer.done(selector, true);
          return result;
        } catch (e) {
          healer.done(selector, false);
          throw e;
        }
      } finally {
        // The action may have moved the browser to another page; note it.
        if (rec && page) await rec.visit(lookFor(page).like).catch(() => undefined);
      }
    };
  }
  return true;
}
