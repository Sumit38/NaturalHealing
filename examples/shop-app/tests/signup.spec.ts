import { expect, test } from '../heal-fixture.js';

test('sign up a new customer', async ({ page, find }) => {
  await page.goto('/signup');
  await (await find('#firstName', 'first-name')).fill('Ada');
  await (await find('#lastName', 'last-name')).fill('Lovelace');
  await (await find('#signupEmail', 'signup-email')).fill('ada@example.com');
  await (await find('#terms', 'terms')).check();
  await (await find('#signupBtn', 'signup-submit')).click();
  await expect(page.locator('#signupResult')).toHaveText('Welcome, Ada Lovelace!');
});

test('opt in to the newsletter', async ({ page, find }) => {
  await page.goto('/signup');
  const box = await find('#newsletter', 'newsletter');
  await box.check();
  await expect(box).toBeChecked();
});
