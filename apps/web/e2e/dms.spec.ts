import { test, expect, unique, registerAndLogin } from './fixtures';

/** Helper: make two users friends. Returns after Bob has accepted. */
async function becomeFriends(
  page1: import('@playwright/test').Page,
  page2: import('@playwright/test').Page,
  bobDisplayName: string,
) {
  await page1.getByPlaceholder('Enter a username').fill(bobDisplayName);
  await page1.getByRole('button', { name: 'Send Friend Request' }).click();
  await expect(page1.getByText('Friend request sent!')).toBeVisible({ timeout: 5000 });

  // Bob reloads to see the incoming request, then accepts
  await page2.reload();
  await page2.getByRole('button', { name: 'Pending' }).click();
  await expect(page2.getByRole('button', { name: 'Accept' })).toBeVisible({ timeout: 10000 });
  await page2.getByRole('button', { name: 'Accept' }).click();
}

/** Helper: Alice opens DM with Bob from All friends tab */
async function openDMFromFriends(page: import('@playwright/test').Page) {
  await page.reload();
  await page.getByRole('button', { name: 'All' }).click();
  await expect(page.getByText('all — 1', { exact: false })).toBeVisible({ timeout: 5000 });
  await page.getByTitle('Message').click();
  await expect(page).toHaveURL(/\/channels\/@me\//, { timeout: 10000 });
}

test.describe('Direct messages', () => {
  test('start a DM conversation from friends list', async ({ browser }) => {
    const id = unique();

    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    await becomeFriends(page1, page2, bob.displayName);
    await openDMFromFriends(page1);

    // Should see the DM chat area with the friend's name
    await expect(page1.getByText(bob.displayName).first()).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('send and receive DM messages', async ({ browser }) => {
    const id = unique();

    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    await becomeFriends(page1, page2, bob.displayName);
    await openDMFromFriends(page1);

    // Alice sends a message
    const msg = `Hello Bob ${unique()}`;
    const messageInput = page1.locator('textarea[placeholder*="Message @"]');
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.click();
    await messageInput.fill(msg);
    await page1.keyboard.press('Enter');

    // Verify message appears in Alice's chat
    await expect(page1.getByText(msg)).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });

  test('DM appears in sidebar after conversation starts', async ({ browser }) => {
    const id = unique();

    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await registerAndLogin(page1, `alice${id}`);

    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    const bob = await registerAndLogin(page2, `bob${id}`);

    await becomeFriends(page1, page2, bob.displayName);
    await openDMFromFriends(page1);

    // Send a message to create the conversation
    const messageInput = page1.locator('textarea[placeholder*="Message @"]');
    await expect(messageInput).toBeVisible({ timeout: 5000 });
    await messageInput.click();
    await messageInput.fill(`DM test ${unique()}`);
    await page1.keyboard.press('Enter');

    // Navigate back to friends page
    await page1.getByRole('button', { name: 'Friends' }).click();
    await expect(page1).toHaveURL(/\/channels\/@me$/, { timeout: 10000 });

    // Verify DM conversation appears in the sidebar
    await expect(page1.getByText('Direct Messages')).toBeVisible({ timeout: 5000 });
    await expect(page1.getByText(bob.displayName).first()).toBeVisible({ timeout: 5000 });

    await ctx1.close();
    await ctx2.close();
  });
});
