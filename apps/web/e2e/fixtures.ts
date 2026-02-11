import { test as base, expect, type Page } from '@playwright/test';

export { expect };

export const unique = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export async function registerAndLogin(
  page: Page,
  username?: string
): Promise<{ email: string; password: string; displayName: string }> {
  const id = username || unique();
  const email = `test-${id}@example.com`;
  const password = 'TestPass123!';

  await page.goto('/register');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/display name/i).fill(id);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/channels\/@me/, { timeout: 10000 });
  return { email, password, displayName: id };
}

export async function createServer(
  page: Page,
  name?: string
): Promise<string> {
  const serverName = name || `TestServer-${unique()}`;
  await page.locator('button:has-text("+")').first().click();
  await expect(
    page.getByRole('heading', { name: 'Create a server' })
  ).toBeVisible();
  await page.getByPlaceholder('My Awesome Server').fill(serverName);
  await page.getByRole('button', { name: /^create$/i }).click();
  await expect(page).toHaveURL(/\/channels\/[^@]/, { timeout: 10000 });
  return serverName;
}

export async function sendMessage(page: Page, content: string): Promise<void> {
  const messageInput = page.locator('textarea[placeholder*="Message"]');
  await expect(messageInput).toBeVisible({ timeout: 5000 });
  await messageInput.click();
  await messageInput.fill(content);
  await page.keyboard.press('Enter');
  // Wait for input to clear (indicates message was sent)
  await expect(messageInput).toHaveValue('', { timeout: 5000 });
}

export async function openSettings(page: Page): Promise<void> {
  await page.getByRole('button', { name: /user settings/i }).click();
  await expect(page.getByTestId('settings-overlay')).toBeVisible({
    timeout: 5000,
  });
}

export const test = base;
