import { expect, test } from '../heal-fixture.js';

test('log in with email and password', async ({ page, find }) => {
  await page.goto('/login');
  await (await find('#username', 'login-email')).fill('ada@example.com');
  await (await find('#password', 'login-password')).fill('correct horse');
  await (await find('#loginBtn', 'login-submit')).click();
  await expect(page).toHaveURL(/\/search$/);
});

test('open the forgot password page', async ({ page, find }) => {
  await page.goto('/login');
  await (await find('text=Forgot password?', 'forgot')).click();
  await expect(page).toHaveURL(/\/forgot$/);
});

test('go to sign up from the login page', async ({ page, find }) => {
  await page.goto('/login');
  await (await find('#signupLink', 'signup-link')).click();
  await expect(page).toHaveURL(/\/signup$/);
});
