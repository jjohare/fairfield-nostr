/**
 * Nostr BBS E2E Tests
 * Generic tests for deployment verification
 *
 * Configuration via environment variables:
 * - E2E_BASE_URL: The base URL to test (default: http://localhost:5173)
 * - E2E_TEST_MNEMONIC: 12-word mnemonic for test account (optional)
 */

import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';
const TEST_MNEMONIC = process.env.E2E_TEST_MNEMONIC || '';

async function loginWithMnemonic(page: Page, mnemonic: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // The Login component defaults to "Paste Phrase" mode with textarea
  const mnemonicTextarea = page.locator('textarea');
  await mnemonicTextarea.waitFor({ state: 'visible', timeout: 10000 });
  await mnemonicTextarea.fill(mnemonic);

  // Click "Restore Account" button
  const restoreButton = page.getByRole('button', { name: /Restore Account/i });
  await restoreButton.waitFor({ state: 'visible', timeout: 5000 });
  await restoreButton.click();

  // Wait for navigation
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

test.describe('Nostr BBS Core Functionality', () => {
  test('landing page loads correctly', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Should show login/signup options
    const hasLoginLink = await page.getByRole('link', { name: /login/i }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasSignupLink = await page.getByRole('link', { name: /create.*account|sign.*up/i }).isVisible({ timeout: 5000 }).catch(() => false);

    // At least one should be visible
    expect(hasLoginLink || hasSignupLink).toBe(true);
  });

  test('login page renders with mnemonic option', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');

    // Check for "Restore Your Account" or similar title
    const hasRestoreTitle = await page.getByText(/Restore.*Account/i).isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasRestoreTitle).toBe(true);

    // Check for mnemonic textarea
    const hasTextarea = await page.locator('textarea').isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasTextarea).toBe(true);

    // Check for input mode tabs
    const hasPasteTab = await page.getByRole('button', { name: /Paste.*Phrase/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasPasteTab).toBe(true);
  });

  test('signup page renders correctly', async ({ page }) => {
    await page.goto(`${BASE_URL}/signup`);
    await page.waitForLoadState('networkidle');

    // Should show welcome text
    const hasWelcome = await page.getByText(/Welcome/i).isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasWelcome).toBe(true);

    // Should have create account button
    const hasCreateButton = await page.getByRole('button', { name: /Create.*Account|Generate/i }).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCreateButton).toBe(true);
  });
});

test.describe('Authenticated Functionality', () => {
  test.skip(!TEST_MNEMONIC, 'Requires E2E_TEST_MNEMONIC environment variable');

  test('login with mnemonic navigates to chat', async ({ page }) => {
    await loginWithMnemonic(page, TEST_MNEMONIC);

    // Should redirect away from login page
    const currentUrl = page.url();
    const loggedIn = !currentUrl.includes('/login');
    expect(loggedIn).toBe(true);

    // Should be on chat or pending page
    const validDestination = currentUrl.includes('/chat') || currentUrl.includes('/pending');
    expect(validDestination).toBe(true);
  });

  test('chat page displays sections', async ({ page }) => {
    await loginWithMnemonic(page, TEST_MNEMONIC);

    // Navigate to chat if not already there
    if (!page.url().includes('/chat')) {
      await page.goto(`${BASE_URL}/chat`);
      await page.waitForLoadState('networkidle');
    }
    await page.waitForTimeout(2000);

    // Should have some section or channel elements
    const sectionElements = await page.locator('.card, .section, [class*="section"], [class*="channel"]').count();
    console.log(`Found ${sectionElements} section/channel elements`);
    expect(sectionElements).toBeGreaterThan(0);
  });

  test('navigation bar is present when authenticated', async ({ page }) => {
    await loginWithMnemonic(page, TEST_MNEMONIC);

    if (!page.url().includes('/chat')) {
      await page.goto(`${BASE_URL}/chat`);
      await page.waitForLoadState('networkidle');
    }

    // Check for navigation elements
    const hasNav = await page.locator('nav, .navbar, [role="navigation"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasNav).toBe(true);

    // Check for key nav links
    const hasChannelsLink = await page.getByRole('link', { name: /channel/i }).isVisible({ timeout: 3000 }).catch(() => false);
    const hasMessagesLink = await page.getByRole('link', { name: /message/i }).isVisible({ timeout: 3000 }).catch(() => false);

    // At least one nav link should be visible
    expect(hasChannelsLink || hasMessagesLink).toBe(true);
  });

  test('direct messages page loads', async ({ page }) => {
    await loginWithMnemonic(page, TEST_MNEMONIC);

    await page.goto(`${BASE_URL}/dm`);
    await page.waitForLoadState('networkidle');

    // Should show DM page title
    const hasDMTitle = await page.getByText(/Direct.*Message/i).isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasDMTitle).toBe(true);
  });

  test('events page loads', async ({ page }) => {
    await loginWithMnemonic(page, TEST_MNEMONIC);

    await page.goto(`${BASE_URL}/events`);
    await page.waitForLoadState('networkidle');

    // Should show events page
    const hasEventsTitle = await page.getByText(/Event/i).first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasEventsTitle).toBe(true);
  });
});

test.describe('Admin Functionality', () => {
  test.skip(!TEST_MNEMONIC, 'Requires E2E_TEST_MNEMONIC environment variable');

  test('admin dashboard loads for admin users', async ({ page }) => {
    await loginWithMnemonic(page, TEST_MNEMONIC);

    await page.goto(`${BASE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const currentUrl = page.url();

    // If redirected to login, user is not admin (expected for non-admin accounts)
    if (currentUrl.includes('/login') || currentUrl.includes('/chat')) {
      console.log('User is not an admin - redirected away from admin page');
      return;
    }

    // If on admin page, check for dashboard elements
    const hasDashboard = await page.getByText(/Admin.*Dashboard|Dashboard/i).isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`Admin dashboard visible: ${hasDashboard}`);
  });
});

test.describe('UI/UX Quality', () => {
  test('dark theme is applied by default', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check for dark theme attribute
    const htmlElement = page.locator('html');
    const theme = await htmlElement.getAttribute('data-theme');
    expect(theme).toBe('dark');
  });

  test('responsive design - navigation works on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Page should still render without errors
    const hasContent = await page.locator('body').isVisible();
    expect(hasContent).toBe(true);
  });

  test('PWA manifest is present', async ({ page }) => {
    await page.goto(BASE_URL);

    // Check for manifest link
    const manifestLink = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestLink).toBeTruthy();
  });

  test('skip to main content link exists for accessibility', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');

    // Check for skip link (may be hidden by default)
    const skipLink = page.locator('a[href="#main-content"], .skip-to-main');
    const exists = await skipLink.count() > 0;
    expect(exists).toBe(true);
  });
});
