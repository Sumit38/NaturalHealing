import { expect, test } from '../heal-fixture.js';
import { seed } from './seed.js';

test.beforeEach(async ({ page }) => seed(page));

test('search by name and category', async ({ page, find }) => {
  await page.goto('/search');
  await (await find('#searchBox', 'search-input')).fill('shoe');
  await (await find('#category', 'category')).selectOption('Shoes');
  await (await find('#searchBtn', 'search-submit')).click();
  await expect(page.locator('#resultCount')).toHaveText('1 result');
});

test('add the second product to the cart', async ({ page, find }) => {
  await page.goto('/search');
  await (await find('#add-2', 'add-2')).click();
  await (await find('.nav-cart', 'nav-cart')).click();
  await expect(page.locator('#rows tr')).toHaveCount(1);
  await expect(page.locator('#rows')).toContainText('Leather Bag');
});

test('log out', async ({ page, find }) => {
  await page.goto('/search');
  await (await find('#logoutBtn', 'logout')).click();
  await expect(page).toHaveURL(/\/login$/);
});
