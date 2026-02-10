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

test.describe('Server management', () => {
  test('create a server, see it in sidebar, navigate to it, create a channel', async ({ page }) => {
    await registerAndLogin(page);

    const serverName = `TestServer-${unique()}`;

    // Click the "+" button to create a server (the green + in the sidebar)
    await page.locator('button:has-text("+")').first().click();

    // Fill in server name in the modal
    await expect(page.getByRole('heading', { name: 'Create a server' })).toBeVisible();
    await page.getByPlaceholder('My Awesome Server').fill(serverName);
    await page.getByRole('button', { name: /^create$/i }).click();

    // Should navigate to the server page
    await expect(page).toHaveURL(/\/channels\/[^@]/, { timeout: 10000 });

    // The server name should appear in the channel sidebar header
    await expect(page.locator('.w-60 h2').filter({ hasText: serverName })).toBeVisible({ timeout: 5000 });

    // Should see #general channel (auto-created)
    await expect(page.locator('button:has-text("general")')).toBeVisible({ timeout: 5000 });

    // --- Create a new channel ---
    // We need to open the create channel modal. The "+" button in the category section.
    // Use aria-label "Create channel"
    await page.getByRole('button', { name: 'Create channel' }).first().click();

    await expect(page.getByRole('heading', { name: 'Create Channel' })).toBeVisible();

    const channelName = 'test-channel';
    await page.getByPlaceholder('new-channel').fill(channelName);
    await page.getByRole('button', { name: /create channel/i }).click();

    // The new channel should appear in the channel list
    await expect(page.locator(`button:has-text("${channelName}")`)).toBeVisible({ timeout: 5000 });
  });
});
