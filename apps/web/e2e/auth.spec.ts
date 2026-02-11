import { test, expect, unique } from './fixtures';

test.describe('Auth flow', () => {
  test('register, logout, login, and fail with wrong password', async ({ page }) => {
    const id = unique();
    const email = `test-${id}@example.com`;
    const password = 'TestPass123!';
    const displayName = `User${id}`;

    // --- Register ---
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();

    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/display name/i).fill(displayName);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /continue/i }).click();

    // Should redirect to /channels/@me
    await expect(page).toHaveURL(/\/channels\/@me/, { timeout: 10000 });

    // --- Logout ---
    // Open settings via the gear icon in the user bar
    await page.getByRole('button', { name: /user settings/i }).click();
    await expect(page.getByRole('heading', { name: 'User Settings' })).toBeVisible();
    await page.getByRole('button', { name: /log out/i }).click();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // --- Login with correct credentials ---
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole('button', { name: /log in/i }).click();

    await expect(page).toHaveURL(/\/channels\/@me/, { timeout: 10000 });

    // --- Logout again ---
    await page.getByRole('button', { name: /user settings/i }).click();
    await page.getByRole('button', { name: /log out/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // --- Login with wrong password ---
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill('WrongPassword999!');
    await page.getByRole('button', { name: /log in/i }).click();

    // Should see an error message
    await expect(page.locator('.text-\\[\\#f23f43\\]')).toBeVisible({ timeout: 5000 });
    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });
});
