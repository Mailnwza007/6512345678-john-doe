import { test, expect, Page } from '@playwright/test';

// Interface for user credentials
interface UserCredentials {
  username: string;
  password: string;
}

interface Users {
  standard: UserCredentials;
  lockedOut: UserCredentials;
}

async function login(page: Page, username: string, password: string): Promise<void> {
  await page.goto('https://www.saucedemo.com/');
  await page.locator('#user-name').fill(username);
  await page.locator('#password').fill(password);
  await page.locator('#login-button').click();
  await expect(page).toHaveURL(/inventory.html/); // ยืนยันว่ามาถึงหน้า inventory
}

test.describe('SauceDemo E-commerce Tests', () => {
  // Fixture สำหรับข้อมูลผู้ใช้
  const user: Users = {
    standard: { username: 'standard_user', password: 'secret_sauce' },
    lockedOut: { username: 'locked_out_user', password: 'secret_sauce' },
  };

  // Hook ก่อนการทดสอบแต่ละเคส
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.goto('https://www.saucedemo.com/');
  });

  // กลุ่มการทดสอบสำหรับการล็อกอิน
  test.describe('Login Functionality', () => {
    test('should login successfully with standard user', async ({ page }: { page: Page }) => {
      await page.locator('#user-name').fill(user.standard.username);
      await page.locator('#password').fill(user.standard.password);
      await page.locator('#login-button').click();

      // ตรวจสอบว่าล็อกอินสำเร็จโดยดู URL หรือ element บนหน้า inventory
      await expect(page).toHaveURL(/inventory.html/);
      await expect(page.locator('.inventory_list')).toBeVisible();
    });

    test('should show error for locked out user', async ({ page }: { page: Page }) => {
      await page.locator('#user-name').fill(user.lockedOut.username);
      await page.locator('#password').fill(user.lockedOut.password);
      await page.locator('#login-button').click();

      // ตรวจสอบข้อความ error
      const errorMessage: string | null = await page.locator('.error-message-container').textContent();
      await expect(errorMessage).toContain('Epic sadface: Sorry, this user has been locked out.');
    });
  });

  test.describe('Inventory Page', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
      await login(page, 'standard_user', 'secret_sauce');
      // Ensure inventory page is fully loaded
      await page.waitForLoadState('networkidle', { timeout: 10000 });
      await page.waitForSelector('.inventory_list', { state: 'visible', timeout: 10000 });
    });

    test('should sort items by price low to high', async ({ page }: { page: Page }) => {
      // Try primary locator, fallback to class-based or generic select
      const sortDropdown = (await page.locator('[data-test="product_sort_container"]').count())
        ? page.locator('[data-test="product_sort_container"]')
        : page.locator('select[class*="product_sort_container"], select');

      // Wait for the dropdown to be visible
      await page.waitForSelector('[data-test="product_sort_container"], select[class*="product_sort_container"], select', { state: 'visible', timeout: 15000 });

      await sortDropdown.selectOption('lohi');
      await page.waitForTimeout(1000); // Wait for DOM to update after sorting

      const prices: string[] = await page.locator('.inventory_item_price').allTextContents();
      const numericPrices: number[] = prices
        .map((p: string) => parseFloat(p.replace('$', '')))
        .filter((p: number) => !isNaN(p)); // Filter out invalid prices
      const sorted: number[] = [...numericPrices].sort((a: number, b: number) => a - b);

      expect(numericPrices).toEqual(sorted);
    });
  });

  test.describe('Checkout Process', () => {
    test.beforeEach(async ({ page }: { page: Page }) => {
      // ล็อกอินและเพิ่มสินค้าลงตะกร้า
      await page.locator('#user-name').fill(user.standard.username);
      await page.locator('#password').fill(user.standard.password);
      await page.locator('#login-button').click();
      await page.locator('[data-test="add-to-cart-sauce-labs-backpack"]').click();
      await page.locator('.shopping_cart_link').click();
      await page.locator('[data-test="checkout"]').click();
    });

    test('should complete checkout process', async ({ page }: { page: Page }) => {
      await page.locator('#first-name').fill('John');
      await page.locator('#last-name').fill('Doe');
      await page.locator('#postal-code').fill('12345');
      await page.locator('[data-test="continue"]').click();
      await page.locator('[data-test="finish"]').click();

      // ตรวจสอบว่าการสั่งซื้อสำเร็จ
      await expect(page.locator('.complete-header')).toHaveText('Thank you for your order!');
    });
  });
});