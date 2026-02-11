import { test, expect, unique, registerAndLogin, createServer } from './fixtures';

test.describe('Server management', () => {
  test('create a server, see it in sidebar, navigate to it, create a channel', async ({ page }) => {
    await registerAndLogin(page);

    const serverName = await createServer(page);

    // The server name should appear in the channel sidebar header
    await expect(page.getByRole('heading', { name: serverName })).toBeVisible({ timeout: 5000 });

    // Should see #general channel (auto-created)
    await expect(page.locator('button:has-text("general")')).toBeVisible({ timeout: 5000 });

    // --- Create a new channel ---
    await page.getByRole('button', { name: 'Create channel' }).first().click();

    await expect(page.getByRole('heading', { name: 'Create Channel' })).toBeVisible();

    const channelName = 'test-channel';
    await page.getByPlaceholder('new-channel').fill(channelName);
    await page.getByRole('button', { name: /create channel/i }).click();

    // The new channel should appear in the channel list
    await expect(page.locator(`button:has-text("${channelName}")`)).toBeVisible({ timeout: 5000 });
  });
});
