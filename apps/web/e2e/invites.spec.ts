import { test, expect, unique, registerAndLogin, createServer } from './fixtures';

test.describe('Server invites', () => {
  test('invite modal shows invite code and copy button', async ({ page }) => {
    await registerAndLogin(page);
    await createServer(page);

    // Open invite modal — button is hidden until hover, so force-click
    await page.getByRole('button', { name: 'Invite people' }).click({ force: true });

    // Verify invite modal is visible
    await expect(page.getByRole('heading', { name: /invite people to/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Share this invite code')).toBeVisible();

    // Verify invite code input has a value
    const inviteInput = page.locator('input[readonly]');
    const inviteCode = await inviteInput.inputValue();
    expect(inviteCode.length).toBeGreaterThan(0);

    // Verify copy button is present
    await expect(page.getByRole('button', { name: 'Copy' })).toBeVisible();
  });

  test('second user joins server via invite code', async ({ browser }) => {
    const id = unique();

    // User 1 creates a server
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `host${id}`);
    const serverName = await createServer(page1);

    // Open invite modal and get the invite code
    await page1.getByRole('button', { name: 'Invite people' }).click({ force: true });
    await expect(page1.getByRole('heading', { name: /invite people to/i })).toBeVisible({ timeout: 5000 });
    const inviteCode = await page1.locator('input[readonly]').inputValue();
    expect(inviteCode.length).toBeGreaterThan(0);

    // User 2 registers and joins via invite code
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await registerAndLogin(page2, `guest${id}`);

    // Click the "Join" button in server sidebar to open JoinServerModal
    await page2.locator('button:has-text("Join")').first().click();
    await expect(page2.getByRole('heading', { name: 'Join a server' })).toBeVisible({ timeout: 5000 });

    // Fill in the invite code
    await page2.getByPlaceholder('Enter invite code').fill(inviteCode);
    await page2.getByRole('button', { name: /join server/i }).click();

    // Should navigate to the server
    await expect(page2).toHaveURL(/\/channels\/[^@]/, { timeout: 10000 });

    // The server name should be visible in the sidebar
    await expect(page2.getByRole('heading', { name: serverName })).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });
});
