import { test, expect, unique, registerAndLogin, openSettings } from './fixtures';

test.describe('Profile editing', () => {
  test('update display name and custom status', async ({ page }) => {
    await registerAndLogin(page);

    // Open settings overlay
    await openSettings(page);

    // Navigate to Profile section
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible({ timeout: 5000 });

    // Update display name
    const newDisplayName = `Updated-${unique()}`;
    const displayNameInput = page.getByLabel(/display name/i);
    await displayNameInput.clear();
    await displayNameInput.fill(newDisplayName);

    // Update custom status
    const newStatus = `Status-${unique()}`;
    const statusInput = page.getByPlaceholder("What's on your mind?");
    await statusInput.clear();
    await statusInput.fill(newStatus);

    // Save changes
    await page.getByRole('button', { name: /save changes/i }).click();

    // Verify success message
    await expect(page.getByText('Profile updated')).toBeVisible({ timeout: 5000 });

    // Close settings
    await page.getByRole('button', { name: /close settings/i }).click();
    await expect(page.getByTestId('settings-overlay')).not.toBeVisible({ timeout: 5000 });

    // Reopen settings and verify changes persisted
    await openSettings(page);
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByLabel(/display name/i)).toHaveValue(newDisplayName);
    await expect(page.getByPlaceholder("What's on your mind?")).toHaveValue(newStatus);
  });

  test('navigate between settings sections', async ({ page }) => {
    await registerAndLogin(page);
    await openSettings(page);

    // Default section is My Account
    await expect(page.getByRole('heading', { name: 'My Account' })).toBeVisible({ timeout: 5000 });

    // Switch to Profile
    await page.getByRole('button', { name: 'Profile' }).click();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();

    // Switch to Appearance
    await page.getByRole('button', { name: 'Appearance' }).click();
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible();

    // Switch to Notifications
    await page.getByRole('button', { name: 'Notifications' }).click();
    await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

    // Close via ESC
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('settings-overlay')).not.toBeVisible({ timeout: 5000 });
  });
});
