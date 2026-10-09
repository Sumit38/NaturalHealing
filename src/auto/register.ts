/**
 * Preload module: `node --import <this file> ...` (or via NODE_OPTIONS). Hooks Playwright and Selenium in the
 * test project so existing tests heal without any change to them.
 */
import { basename } from 'node:path';
import { AutoHealer } from './auto-healer.js';
import { CoverageRecorder } from './coverage.js';
import { installPlaywright } from './playwright.js';
import { installSelenium } from './selenium.js';

if (!process.env.HEAL_OFF && process.env.HEAL_DIR) {
  const healer = new AutoHealer();
  // Plain scripts have no test name; test runners replace this per test.
  if (process.argv[1]) healer.setTest(basename(process.argv[1]));
  const cwd = process.cwd();
  const timeout = process.env.HEAL_LOOKUP_TIMEOUT ? Number(process.env.HEAL_LOOKUP_TIMEOUT) : 500;
  const coverage = process.env.HEAL_COVERAGE === '0' ? undefined : new CoverageRecorder(process.env.HEAL_DIR);
  installPlaywright(healer, cwd, timeout, coverage);
  installSelenium(healer, cwd, timeout, coverage);
}
