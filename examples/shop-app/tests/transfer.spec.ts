import { expect, test } from '../heal-fixture.js';
import { seed } from './seed.js';

test.beforeEach(async ({ page }) => seed(page));

test('send money between accounts', async ({ page, find }) => {
  await page.goto('/transfer');
  await (await find('#fromAccount', 'from')).selectOption('chk');
  await (await find('#toAccount', 'to')).selectOption('sav');
  await (await find('#amount', 'amount')).fill('250');
  await (await find('#memo', 'memo')).fill('Rent');
  await (await find('#transferBtn', 'transfer-submit')).click();
  await (await find('#confirmYes', 'confirm-yes')).click();
  await expect(page.locator('#transferResult')).toHaveText('Sent $250 to Savings ••5678 (Rent).');
});

test('save a payee', async ({ page, find }) => {
  await page.goto('/transfer');
  await (await find('#savePayee', 'save-payee')).click();
  await expect(page.locator('#transferResult')).toHaveText('Payee saved.');
});
