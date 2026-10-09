/**
 * A small sample site and an ordinary Playwright Test project, so a first-time user can watch the whole cycle:
 * v1 is the healthy site, v2 is a release (ids renamed, plus a real bug: validation stopped working),
 * v3 is the release after the developers fixed the bug.
 */

const STYLE = `<style>
  body{margin:0;font:16px system-ui,sans-serif;background:#f4f6f8;color:#1b2430}
  header{background:#17324d;color:#fff;padding:14px 28px;display:flex;gap:22px;align-items:center}
  header b{margin-right:12px} header a{color:#cfe3f7;text-decoration:none} header a:hover{color:#fff}
  main{max-width:520px;margin:40px auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 2px 12px #0001}
  h1{margin:0 0 18px;font-size:22px} label{display:block;font-size:13px;color:#5b6675;margin-bottom:6px}
  input[type=email],select{width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cdd5df;border-radius:8px;font:inherit;margin-bottom:14px}
  button{padding:10px 20px;border:0;border-radius:8px;background:#2f6f4e;color:#fff;font:inherit;font-weight:600;cursor:pointer}
  button.danger{background:#b3261e} .row{display:flex;gap:10px;align-items:center;margin-top:8px}
  #toast{display:none;margin-top:16px;color:#1a7f4b;font-weight:600} #error{display:none;margin:-6px 0 12px;color:#b3261e;font-size:14px}
</style>`;

const NAV = (v: number) => `<header><b>Acme</b><a href="/demo/app?v=${v}">Settings</a><a href="/demo/billing?v=${v}">Billing</a><a href="/demo/profile?v=${v}">Profile</a><a href="/demo/security?v=${v}">Security</a></header>`;

function settings(v: 1 | 2 | 3): string {
  const ids = v === 1 ? { email: 'email', save: 'saveBtn', cls: 'primary', label: 'Save' } : { email: 'emailField', save: 'btn-save-9f2', cls: 'cta cta--green', label: 'Save changes' };
  const validates = v !== 2; // v2 ships the bug: any value is accepted
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Acme - Account settings</title>${STYLE}${NAV(v)}
<main>
  <h1>Account settings</h1>
  <label for="${ids.email}">Email</label>
  <input id="${ids.email}" type="email" placeholder="you@example.com">
  <div id="error">Enter a valid email address</div>
  <label style="display:flex;gap:8px;align-items:center;color:#1b2430;font-size:15px"><input type="checkbox" id="news"> Email me product news</label>
  <div class="row">
    <button id="${ids.save}" class="${ids.cls}">${ids.label}</button>
    <button id="deleteBtn" class="danger">Delete account</button>
    <a href="#">Cancel</a>
  </div>
  <div id="toast">Settings saved</div>
</main>
<script>
  const validates = ${validates};
  document.getElementById('${ids.save}').addEventListener('click', () => {
    const ok = !validates || /^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(document.getElementById('${ids.email}').value);
    document.getElementById('error').style.display = ok ? 'none' : 'block';
    document.getElementById('toast').style.display = ok ? 'block' : 'none';
  });
</script></html>`;
}

function other(name: string, v: number): string {
  const body: Record<string, string> = {
    billing: '<label for="plan">Plan</label><select id="plan"><option>Starter</option><option>Team</option></select><div class="row"><button id="invoice">Download invoice</button><button id="card">Update card</button></div>',
    profile: '<label for="display">Display name</label><input id="display" type="email" placeholder="Your name"><div class="row"><button id="savep">Save profile</button></div>',
    security: '<div class="row"><button id="pw">Change password</button><button id="2fa">Turn on two-step sign-in</button></div>',
  };
  const title = name[0].toUpperCase() + name.slice(1);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Acme - ${title}</title>${STYLE}${NAV(v)}<main><h1>${title}</h1>${body[name]}</main></html>`;
}


/** A sign-in page and a dashboard, for trying the use-case and test-case flows. Version 2 renames the controls and the button. */
function login(v: 1 | 2 | 3): string {
  const ids = v === 1 ? { email: 'email', pw: 'password', btn: 'signin', label: 'Sign in' } : { email: 'loginEmail', pw: 'loginPassword', btn: 'btn-auth-77', label: v === 2 ? 'Sign in now' : 'Log in' };
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Acme - Sign in</title>${STYLE}<header><b>Acme</b></header>
<main>
  <h1>Sign in</h1>
  <label for="${ids.email}">Email</label>
  <input id="${ids.email}" type="email" placeholder="you@example.com" autocomplete="off">
  <label for="${ids.pw}">Password</label>
  <input id="${ids.pw}" type="password" autocomplete="off" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid #cdd5df;border-radius:8px;font:inherit;margin-bottom:14px">
  <label style="display:flex;gap:8px;align-items:center;color:#1b2430;font-size:15px"><input type="checkbox" id="remember"> Remember me</label>
  <div id="login-error" role="alert" style="display:none;color:#b3261e;margin:10px 0"></div>
  <div class="row"><button id="${ids.btn}">${ids.label}</button><a href="#">Forgot password?</a></div>
</main>
<script>
  const show = (m) => { const e = document.getElementById('login-error'); e.textContent = m; e.style.display = 'block'; };
  document.getElementById('${ids.btn}').addEventListener('click', () => {
    const email = document.getElementById('${ids.email}').value.trim();
    const pw = document.getElementById('${ids.pw}').value;
    if (!email) return show('Email is required');
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) return show('Enter a valid email address');
    if (pw.length < 8) return show('Password must be at least 8 characters');
    if (email.toLowerCase() === 'sam@example.com' && pw === 'Password1!') { location.href = '/demo/dashboard?v=${v}'; return; }
    show('Invalid credentials');
  });
</script></html>`;
}

function dashboard(v: number): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><title>Acme - Dashboard</title>${STYLE}${NAV(v)}
<main><h1>Dashboard</h1><p>Welcome back, Sam</p><div class="row"><button id="newreport">New report</button></div></main></html>`;
}

/** The page for a path under /demo/, or undefined. */
export function demoPage(path: string, version: string): string | undefined {
  const v = (version === '3' ? 3 : version === '2' ? 2 : 1) as 1 | 2 | 3;
  if (path === '/demo/app') return settings(v);
  if (path === '/demo/login') return login(v);
  // A field that is only marked invalid (like many real forms): a red border and no message.
  if (path === '/demo/flagged') return `<!doctype html><html><meta charset="utf-8"><title>Flagged page</title><style>.field-error{border:2px solid #b3261e}</style>
<h1>Flagged page</h1><label for="e">E</label><input id="e" type="text" placeholder="E"><button id="go">Check</button>
<script>document.getElementById('go').addEventListener('click',()=>document.getElementById('e').classList.add('field-error'))</script></html>`;
  if (path === '/demo/dashboard') return dashboard(v);
  const m = path.match(/^\/demo\/(billing|profile|security)$/);
  return m ? other(m[1], v) : undefined;
}

/** The tester's side of the demo: an ordinary Playwright Test project that knows nothing about healing. */
export const DEMO_FILES: Record<string, string> = {
  'playwright.config.cjs': `module.exports = {
  testDir: '.',
  timeout: 20000,
  workers: 1,
  use: { headless: true, channel: process.env.DEMO_CHANNEL || undefined },
};
`,
  'account.spec.cjs': `const { test, expect } = require('@playwright/test');

test('TC-01 Update email address', async ({ page }) => {
  await page.goto(process.env.APP_URL);
  await page.locator('#email').fill('sam@example.com');
  await page.locator('#saveBtn').click({ timeout: 4000 });
  await expect(page.locator('#toast')).toBeVisible();
});

test('TC-02 Reject an invalid email', async ({ page }) => {
  await page.goto(process.env.APP_URL);
  await page.locator('#email').fill('not-an-email');
  await page.locator('#saveBtn').click({ timeout: 4000 });
  await expect(page.locator('#error')).toBeVisible({ timeout: 2000 });
});

test('TC-03 Open the billing page', async ({ page }) => {
  await page.goto(process.env.APP_URL);
  await page.getByRole('link', { name: 'Billing' }).click();
  await expect(page.locator('h1')).toHaveText('Billing');
});

test.skip('TC-06 Export account data', async () => {
  // Not automated yet.
});
`,
};

/** Scenarios the team planned for this app; some have no test, which the report shows as unattended. */
export const DEMO_SCENARIOS_CSV = `id,title,area,priority
TC-01,Update email address,Settings,High
TC-02,Reject an invalid email,Settings,High
TC-03,Open the billing page,Billing,Medium
TC-04,Change password,Security,Critical
TC-05,Delete account,Settings,High
TC-06,Export account data,Settings,Low
`;

/** A use case that matches the sample sign-in page, for the "try an example" button. */
export const DEMO_USE_CASE = `Use Case: Sign in to Acme
Actor: Registered customer
Preconditions: The customer has an Acme account
Main Flow:
1. The user opens the sign in page
2. The user enters email and password
3. The user clicks the Sign in button
4. The system redirects the user to the dashboard page
5. The system shows "Welcome back, Sam"
Alternate Flows:
A1. Wrong password: the system shows "Invalid credentials"
A2. Email left blank: the system shows "Email is required"
Business Rules:
- The password must be at least 8 characters
- The email must be a valid address
`;

/** The sign-in account the sample page accepts. */
export const DEMO_TEST_DATA = { email: 'sam@example.com', password: 'Password1!' };
