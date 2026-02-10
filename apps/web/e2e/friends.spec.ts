import { test, expect } from '@playwright/test';

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function registerAndLogin(page: import('@playwright/test').Page) {
  const id = unique();
  const email = `test-${id}@example.com`;
  const password = 'TestPass123!';
  const displayName = `User${id}`;

  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/display name/i).fill(displayName);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/channels\/@me/, { timeout: 10000 });
  return { email, password, displayName };
}

test.describe('Friends page', () => {
  test('friends page loads with tabs for two registered users', async ({ browser }) => {
    // --- Register user 1 ---
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1);

    // Verify friends page is visible at /channels/@me
    await expect(page1.getByText('Friends')).toBeVisible({ timeout: 5000 });

    // Verify tabs are present
    await expect(page1.getByRole('button', { name: 'Online' })).toBeVisible();
    await expect(page1.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page1.getByRole('button', { name: 'Pending' })).toBeVisible();
    await expect(page1.getByRole('button', { name: 'Blocked' })).toBeVisible();

    // Verify "Add Friend" section
    await expect(page1.getByText('Add Friend')).toBeVisible();
    await expect(page1.getByPlaceholder('Enter a username')).toBeVisible();
    await expect(page1.getByRole('button', { name: 'Send Friend Request' })).toBeVisible();

    // Can click between tabs
    await page1.getByRole('button', { name: 'All' }).click();
    await expect(page1.getByText("You don't have any friends yet.")).toBeVisible();

    await page1.getByRole('button', { name: 'Pending' }).click();
    await expect(page1.getByText('No pending friend requests.')).toBeVisible();

    await ctx1.close();

    // --- Register user 2 ---
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await registerAndLogin(page2);

    // Verify friends page also works for user 2
    await expect(page2.getByText('Friends')).toBeVisible({ timeout: 5000 });
    await expect(page2.getByRole('button', { name: 'Online' })).toBeVisible();

    await ctx2.close();
  });
});
