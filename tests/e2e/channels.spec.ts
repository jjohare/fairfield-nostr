/**
 * E2E Tests: Channel Management
 *
 * Tests channel functionality including:
 * - Channel list display
 * - Cohort filtering
 * - Join requests
 * - Channel selection
 */

import { test, expect } from '@playwright/test';

// Test mnemonic for consistent login
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

test.describe('Channel Management', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Clear storage and login
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Perform login
    await page.getByRole('button', { name: /login|restore|import/i }).click();
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(TEST_MNEMONIC);
    await page.getByRole('button', { name: /restore|import|login/i }).click();

    // Wait for dashboard/channels page
    await page.waitForURL(/dashboard|channels|home/i, { timeout: 5000 });
  });

  test('channel list displays correctly', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Verify channel list is visible
    const channelList = page.locator('[data-testid="channel-list"]');
    await expect(channelList).toBeVisible();

    // Check for loading state completion
    const loadingIndicator = page.locator('[data-loading="true"]');
    await expect(loadingIndicator).toHaveCount(0);
  });

  test('channels show required information', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Get first channel
    const firstChannel = page.locator('[data-testid="channel-item"]').first();

    if (await firstChannel.count() > 0) {
      // Check channel has name
      const channelName = firstChannel.locator('[data-testid="channel-name"]');
      await expect(channelName).toBeVisible();

      // Check channel has description
      const channelDescription = firstChannel.locator('[data-testid="channel-description"]');
      await expect(channelDescription).toBeVisible();

      // Check channel has member count
      const memberCount = firstChannel.locator('[data-testid="member-count"]');
      await expect(memberCount).toBeVisible();
    }
  });

  test('cohort filter shows business channels', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find cohort filter
    const businessFilter = page.getByRole('button', { name: /business/i });

    if (await businessFilter.count() > 0) {
      await businessFilter.click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify only business channels are shown
      const channels = page.locator('[data-testid="channel-item"]');
      const count = await channels.count();

      if (count > 0) {
        // Check each channel has business cohort badge
        for (let i = 0; i < count; i++) {
          const channel = channels.nth(i);
          const cohortBadge = channel.locator('[data-cohort="business"]');
          await expect(cohortBadge).toBeVisible();
        }
      }
    }
  });

  test('cohort filter shows moomaa-tribe channels', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find cohort filter
    const moomaaFilter = page.getByRole('button', { name: /moomaa-tribe|moomaa/i });

    if (await moomaaFilter.count() > 0) {
      await moomaaFilter.click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify only moomaa channels are shown
      const channels = page.locator('[data-testid="channel-item"]');
      const count = await channels.count();

      if (count > 0) {
        // Check each channel has moomaa cohort badge
        for (let i = 0; i < count; i++) {
          const channel = channels.nth(i);
          const cohortBadge = channel.locator('[data-cohort="moomaa-tribe"]');
          await expect(cohortBadge).toBeVisible();
        }
      }
    }
  });

  test('all filter shows all channels', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Click all filter
    const allFilter = page.getByRole('button', { name: /all channels|all/i });

    if (await allFilter.count() > 0) {
      await allFilter.click();

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Get channel count
      const channels = page.locator('[data-testid="channel-item"]');
      const allCount = await channels.count();

      // Click business filter
      const businessFilter = page.getByRole('button', { name: /business/i });
      if (await businessFilter.count() > 0) {
        await businessFilter.click();
        await page.waitForTimeout(500);
        const businessCount = await channels.count();

        // Click all again
        await allFilter.click();
        await page.waitForTimeout(500);
        const finalCount = await channels.count();

        // All should show at least as many as filtered
        expect(finalCount).toBeGreaterThanOrEqual(businessCount);
      }
    }
  });

  test('request to join button appears for non-member channels', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find a channel the user is not a member of
    const nonMemberChannel = page.locator('[data-testid="channel-item"][data-is-member="false"]').first();

    if (await nonMemberChannel.count() > 0) {
      // Check for "Request to Join" button
      const joinButton = nonMemberChannel.getByRole('button', { name: /request to join|join/i });
      await expect(joinButton).toBeVisible();
      await expect(joinButton).toBeEnabled();
    }
  });

  test('request to join button sends join request', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find a non-member channel
    const nonMemberChannel = page.locator('[data-testid="channel-item"][data-is-member="false"]').first();

    if (await nonMemberChannel.count() > 0) {
      const joinButton = nonMemberChannel.getByRole('button', { name: /request to join|join/i });

      // Click join button
      await joinButton.click();

      // Wait for request to be sent
      await page.waitForTimeout(1000);

      // Button should change to "Pending" or be disabled
      const buttonText = await joinButton.textContent();
      expect(buttonText?.toLowerCase()).toMatch(/pending|requested/);

      // Or check if button is disabled
      const isDisabled = await joinButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test('member channels show open/view button', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find a channel the user is a member of
    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      // Check for "Open" or "View" button
      const openButton = memberChannel.getByRole('button', { name: /open|view|enter/i });
      await expect(openButton).toBeVisible();
      await expect(openButton).toBeEnabled();
    }
  });

  test('channel selection opens channel view', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find a member channel
    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      // Get channel name for verification
      const channelName = await memberChannel.locator('[data-testid="channel-name"]').textContent();

      // Click to open channel
      const openButton = memberChannel.getByRole('button', { name: /open|view|enter/i });
      await openButton.click();

      // Wait for channel view to load
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Verify channel view shows correct channel
      const channelHeader = page.locator('[data-testid="channel-header"]');
      await expect(channelHeader).toContainText(channelName || '');
    }
  });

  test('channels display encryption indicator', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Get all channels
    const channels = page.locator('[data-testid="channel-item"]');
    const count = await channels.count();

    if (count > 0) {
      const firstChannel = channels.first();

      // Check for encryption indicator (icon or badge)
      const encryptionIndicator = firstChannel.locator('[data-testid="encryption-indicator"], .encryption-badge');

      // Should exist and show encryption status
      if (await encryptionIndicator.count() > 0) {
        await expect(encryptionIndicator).toBeVisible();
      }
    }
  });

  test('empty state shown when no channels available', async ({ page }) => {
    // This test assumes we can create a state with no channels
    // by filtering to a non-existent cohort or mocking empty response

    // Try to find a filter that would show no results
    const filters = ['business', 'moomaa-tribe'];

    for (const filterName of filters) {
      const filter = page.getByRole('button', { name: new RegExp(filterName, 'i') });

      if (await filter.count() > 0) {
        await filter.click();
        await page.waitForTimeout(500);

        const channels = page.locator('[data-testid="channel-item"]');
        const count = await channels.count();

        if (count === 0) {
          // Check for empty state message
          const emptyMessage = page.getByText(/no channels|no results|empty/i);
          await expect(emptyMessage).toBeVisible();
          break;
        }
      }
    }
  });

  test('channel search filters results', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Find search input
    const searchInput = page.getByPlaceholder(/search|find channel/i);

    if (await searchInput.count() > 0) {
      // Get initial channel count
      const initialCount = await page.locator('[data-testid="channel-item"]').count();

      // Enter search term
      await searchInput.fill('test');
      await page.waitForTimeout(500);

      // Get filtered count
      const filteredCount = await page.locator('[data-testid="channel-item"]').count();

      // Filtered count should be less than or equal to initial
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test('channel visibility badges display correctly', async ({ page }) => {
    // Wait for channels to load
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    // Check for visibility indicators
    const channels = page.locator('[data-testid="channel-item"]');
    const count = await channels.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 3); i++) {
        const channel = channels.nth(i);

        // Check if channel has visibility attribute
        const visibility = await channel.getAttribute('data-visibility');

        if (visibility) {
          expect(['listed', 'unlisted', 'preview']).toContain(visibility);
        }
      }
    }
  });
});
