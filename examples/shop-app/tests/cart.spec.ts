import { expect, test } from '../heal-fixture.js';
import { seed } from './seed.js';

// Running Shoe $59 and Leather Bag $120.
test.beforeEach(async ({ page }) => seed(page, [{ sku: 'shoe', qty: 1 }, { sku: 'bag', qty: 1 }]));

test('change the quantity of an item', async ({ page, find }) => {
  await page.goto('/cart');
  const qty = await find('#qty-1', 'qty-1');
  await qty.fill('3');
  await qty.press('Tab');
  await expect(page.locator('#total')).toHaveText('$297.00');
});

test('remove an item', async ({ page, find }) => {
  await page.goto('/cart');
  await (await find('#remove-2', 'remove-2')).click();
  await expect(page.locator('#rows tr')).toHaveCount(1);
  await expect(page.locator('#total')).toHaveText('$59.00');
});

test('apply a coupon', async ({ page, find }) => {
  await page.goto('/cart');
  await (await find('#coupon', 'coupon-input')).fill('SAVE10');
  await (await find('#applyCoupon', 'coupon-apply')).click();
  await expect(page.locator('#total')).toHaveText('$161.10');
});

test('check out', async ({ page, find }) => {
  await page.goto('/cart');
  await expect(await find('#cartTitle', 'cart-title')).toBeVisible();
  await (await find('#checkoutBtn', 'checkout')).click();
  await expect(page.locator('#checkoutResult')).toHaveText('Order placed: $179.00');
});
