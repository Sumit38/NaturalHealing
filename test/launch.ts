import { existsSync } from 'node:fs';

/** Chromium for Playwright: CHROME_BIN, the sandbox install, or the system Chrome channel. */
const exe = [process.env.CHROME_BIN, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => p && existsSync(p));
export const launchOptions = exe ? { executablePath: exe, args: ['--no-sandbox'] } : { channel: 'chrome', args: ['--no-sandbox'] };
