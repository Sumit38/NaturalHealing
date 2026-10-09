import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { callerFile } from '../core.js';
import { seleniumProbe } from '../selenium.js';
import type { AutoHealer } from './auto-healer.js';
import type { CoverageRecorder, PageLike } from './coverage.js';

/** Patches selenium-webdriver's findElement in the test project, if it has it. Returns false when Selenium is not installed. */
export function installSelenium(healer: AutoHealer, cwd: string, lookupTimeout = 500, rec?: CoverageRecorder): boolean {
  const req = createRequire(join(cwd, 'package.json'));
  let lib: any, by: any, errors: any;
  try {
    const root = dirname(req.resolve('selenium-webdriver/package.json'));
    lib = req(join(root, 'lib', 'webdriver.js'));
    by = req(join(root, 'lib', 'by.js'));
    errors = req(join(root, 'lib', 'error.js'));
  } catch {
    return false;
  }
  const proto = lib.WebDriver.prototype;
  if (proto.__healing) return false;
  proto.__healing = true;
  const original = proto.findElement;
  const like = (driver: any): PageLike => ({
    url: () => driver.getCurrentUrl(),
    title: () => driver.getTitle(),
    snapshot: () => seleniumProbe(driver, lookupTimeout).snapshot(),
  });

  if (rec && typeof proto.get === 'function') {
    const get = proto.get;
    proto.get = async function (this: any, ...args: unknown[]) {
      const result = await get.apply(this, args);
      await rec.visit(like(this));
      return result;
    };
  }

  proto.findElement = function (this: any, locator: any) {
    let normal: { using: string; value: string } | undefined;
    try {
      normal = typeof locator === 'function' || locator?.marshall ? undefined : by.checkedLocator(locator);
    } catch {
      return original.call(this, locator);
    }
    if (!normal || (normal.using !== 'css selector' && normal.using !== 'xpath')) return original.call(this, locator);
    const selector = normal.value;
    const isXpath = normal.using === 'xpath';
    const file = callerFile();
    const driver = this;
    const probe = seleniumProbe(driver, lookupTimeout);
    const asBy = (s: string) => (isXpath || s.startsWith('/') || s.startsWith('(') ? { xpath: s } : { css: s });

    const result = (async () => {
      try {
        const el = await original.call(driver, locator);
        await healer.remember(probe, selector).catch(() => undefined);
        if (rec) await rec.interact(like(driver), probe, selector);
        return el;
      } catch (e) {
        if (!(e instanceof errors.NoSuchElementError)) throw e;
        let healed = selector;
        try {
          healed = await healer.heal(probe, selector, file);
        } catch {
          throw e;
        }
        if (healed === selector) throw e;
        try {
          const el = await original.call(driver, asBy(healed));
          healer.done(selector, true);
          if (rec) await rec.interact(like(driver), probe, healed);
          return el;
        } catch (e2) {
          healer.done(selector, false);
          throw e2;
        }
      }
    })();
    return new lib.WebElementPromise(driver, result);
  };
  return true;
}
