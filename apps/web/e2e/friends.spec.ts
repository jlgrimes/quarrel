import { test, expect } from '@playwright/test';

const unique = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function registerAndLogin(page: import('@playwright/test').Page, username?: string) {
  const id = username || unique();
  const email = `test-${id}@example.com`;
  const password = 'TestPass123!';

  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/display name/i).fill(id);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/channels\/@me/, { timeout: 10000 });
  return { email, password, username: id };
}

test.describe('Friends page', () => {
  test('friends page loads with tabs', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await registerAndLogin(page);

    await expect(page.getByText('Friends')).toBeVisible({ timeout: 5000 });

    // Verify tabs are present
    await expect(page.getByRole('button', { name: 'Online' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pending' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Blocked' })).toBeVisible();

    // Verify "Add Friend" section
    await expect(page.getByText('Add Friend')).toBeVisible();
    await expect(page.getByPlaceholder('Enter a username')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Friend Request' })).toBeVisible();

    // Can click between tabs
    await page.getByRole('button', { name: 'All' }).click();
    await expect(page.getByText("You don't have any friends yet.")).toBeVisible();

    await page.getByRole('button', { name: 'Pending' }).click();
    await expect(page.getByText('No pending friend requests.')).toBeVisible();

    await ctx.close();
  });

  test('send friend request by username', async ({ browser }) => {
    const id = unique();

    // Register user 1 (Alice)
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    // Register user 2 (Bob)
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    // Alice sends friend request to Bob by username
    await page1.getByPlaceholder('Enter a username').fill(bob.username);
    await page1.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page1.getByText('Friend request sent!')).toBeVisible({ timeout: 5000 });

    // Alice should see request in Pending tab
    await page1.getByRole('button', { name: 'Pending' }).click();
    await expect(page1.getByText(`pending — 1`, { exact: false })).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('shows error for non-existent username', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await registerAndLogin(page);

    await page.getByPlaceholder('Enter a username').fill('nonexistent_user_xyz');
    await page.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page.getByText('User not found')).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('shows error when friending yourself', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const user = await registerAndLogin(page);

    await page.getByPlaceholder('Enter a username').fill(user.username);
    await page.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page.getByText('Cannot friend yourself')).toBeVisible({ timeout: 5000 });

    await ctx.close();
  });

  test('accept friend request flow', async ({ browser }) => {
    const id = unique();

    // Register Alice
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const alice = await registerAndLogin(page1, `alice${id}`);

    // Register Bob
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    // Alice sends request to Bob
    await page1.getByPlaceholder('Enter a username').fill(bob.username);
    await page1.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page1.getByText('Friend request sent!')).toBeVisible({ timeout: 5000 });

    // Bob navigates to Pending tab and accepts
    await page2.getByRole('button', { name: 'Pending' }).click();
    await expect(page2.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 10000 });
    await page2.getByRole('button', { name: 'Accept' }).click();

    // Bob should see the friend in All tab
    await page2.getByRole('button', { name: 'All' }).click();
    await expect(page2.getByText(`all — 1`, { exact: false })).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });
});
