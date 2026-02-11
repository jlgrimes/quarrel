import { test, expect, unique, registerAndLogin, createServer, sendMessage } from './fixtures';

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
    await sendMessage(page, msg1);

    // Verify message appears in chat
    await expect(page.getByText(msg1)).toBeVisible({ timeout: 5000 });

    // Send second message
    const msg2 = `Second message ${unique()}`;
    await sendMessage(page, msg2);

    // Verify both messages are visible
    await expect(page.getByText(msg1)).toBeVisible();
    await expect(page.getByText(msg2)).toBeVisible();

    // Verify the author name appears
    await expect(page.getByText(displayName).first()).toBeVisible();
  });
});
