import { test, expect, unique, registerAndLogin } from './fixtures';

test.describe('Direct messages', () => {
  test('start a DM conversation from friends list', async ({ browser }) => {
    const id = unique();

    // Register Alice
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    // Register Bob
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    // Alice sends friend request to Bob
    await page1.getByPlaceholder('Enter a username').fill(bob.displayName);
    await page1.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page1.getByText('Friend request sent!')).toBeVisible({ timeout: 5000 });

    // Bob accepts the friend request
    await page2.getByRole('button', { name: 'Pending' }).click();
    await expect(page2.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 10000 });
    await page2.getByRole('button', { name: 'Accept' }).click();

    // Alice goes to All friends tab and clicks Message button
    await page1.getByRole('button', { name: 'All' }).click();
    await expect(page1.getByText(`all — 1`, { exact: false })).toBeVisible({ timeout: 5000 });

    // Click the Message button (chat icon) for the friend
    await page1.getByTitle('Message').click();

    // Should navigate to DM conversation
    await expect(page1).toHaveURL(/\/channels\/@me\//, { timeout: 10000 });

    // Should see the DM chat area with the friend's name
    await expect(page1.getByText(bob.displayName)).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('send and receive DM messages', async ({ browser }) => {
    const id = unique();

    // Register Alice and Bob
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    // Become friends
    await page1.getByPlaceholder('Enter a username').fill(bob.displayName);
    await page1.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page1.getByText('Friend request sent!')).toBeVisible({ timeout: 5000 });

    await page2.getByRole('button', { name: 'Pending' }).click();
    await expect(page2.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 10000 });
    await page2.getByRole('button', { name: 'Accept' }).click();

    // Alice opens DM with Bob
    await page1.getByRole('button', { name: 'All' }).click();
    await expect(page1.getByText(`all — 1`, { exact: false })).toBeVisible({ timeout: 5000 });
    await page1.getByTitle('Message').click();
    await expect(page1).toHaveURL(/\/channels\/@me\//, { timeout: 10000 });

    // Alice sends a message
    const msg = `Hello Bob ${unique()}`;
    const messageInput = page1.locator(`textarea[placeholder*="Message @"]`);
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill(msg);
    await messageInput.press('Enter');

    // Verify message appears in Alice's chat
    await expect(page1.locator('.text-\\[\\#dbdee1\\]').filter({ hasText: msg })).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('DM appears in sidebar after conversation starts', async ({ browser }) => {
    const id = unique();

    // Register Alice and Bob
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    // Become friends
    await page1.getByPlaceholder('Enter a username').fill(bob.displayName);
    await page1.getByRole('button', { name: 'Send Friend Request' }).click();
    await expect(page1.getByText('Friend request sent!')).toBeVisible({ timeout: 5000 });

    await page2.getByRole('button', { name: 'Pending' }).click();
    await expect(page2.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 10000 });
    await page2.getByRole('button', { name: 'Accept' }).click();

    // Alice opens DM with Bob
    await page1.getByRole('button', { name: 'All' }).click();
    await expect(page1.getByText(`all — 1`, { exact: false })).toBeVisible({ timeout: 5000 });
    await page1.getByTitle('Message').click();
    await expect(page1).toHaveURL(/\/channels\/@me\//, { timeout: 10000 });

    // Send a message to create the conversation
    const messageInput = page1.locator(`textarea[placeholder*="Message @"]`);
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.fill(`DM test ${unique()}`);
    await messageInput.press('Enter');

    // Navigate back to friends page
    await page1.getByRole('button', { name: 'Friends' }).click();
    await expect(page1).toHaveURL(/\/channels\/@me$/, { timeout: 10000 });

    // Verify DM conversation appears in the sidebar under "Direct Messages"
    await expect(page1.getByText('Direct Messages')).toBeVisible({ timeout: 5000 });
    await expect(page1.getByText(bob.displayName)).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });
});
