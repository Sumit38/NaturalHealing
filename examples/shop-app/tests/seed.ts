import type { Page } from '@playwright/test';

/** Signs in and fills the cart without touching the UI, once per test (not on every navigation). */
export async function seed(page: Page, cart: { sku: string; qty: number }[] = []): Promise<void> {
  await page.addInitScript((c) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('user', 'ada@example.com');
    localStorage.setItem('cart', JSON.stringify(c));
    sessionStorage.setItem('seeded', '1');
  }, cart);
}
