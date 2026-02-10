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

async function createServer(page: import('@playwright/test').Page) {
  const serverName = `TestServer-${unique()}`;
  await page.locator('button:has-text("+")').first().click();
  await expect(page.getByRole('heading', { name: 'Create a server' })).toBeVisible();
  await page.getByPlaceholder('My Awesome Server').fill(serverName);
  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(page).toHaveURL(/\/channels\/[^@]/, { timeout: 10000 });
  return serverName;
}

test.describe('Messaging', () => {
  test('send messages and see them in chat', async ({ page }) => {
    const { displayName } = await registerAndLogin(page);
    await createServer(page);

    // Wait for #general channel to auto-load
    await expect(page.locator('button:has-text("general")')).toBeVisible({ timeout: 5000 });

    // The message input should be visible with placeholder
    const messageInput = page.locator('textarea[placeholder*="Message #"]');
    await expect(messageInput).toBeVisible({ timeout: 5000 });

    // Send first message
    const msg1 = `Hello world ${unique()}`;
    await messageInput.fill(msg1);
    await messageInput.press('Enter');

    // Verify message appears in chat
    await expect(page.locator('.text-\\[\\#dbdee1\\]').filter({ hasText: msg1 })).toBeVisible({ timeout: 5000 });

    // Send second message
    const msg2 = `Second message ${unique()}`;
    await messageInput.fill(msg2);
    await messageInput.press('Enter');

    // Verify both messages are visible
    await expect(page.locator('.text-\\[\\#dbdee1\\]').filter({ hasText: msg1 })).toBeVisible();
    await expect(page.locator('.text-\\[\\#dbdee1\\]').filter({ hasText: msg2 })).toBeVisible();

    // Verify the author name appears
    await expect(page.locator('.font-medium.text-white').filter({ hasText: displayName })).toBeVisible();
  });
});
