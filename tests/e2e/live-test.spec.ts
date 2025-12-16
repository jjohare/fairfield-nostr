/**
 * Live Endpoint E2E Tests
 * Tests against https://dreamlab-ai.github.io/fairfield/
 */

import { test, expect, type Page } from '@playwright/test';

const LIVE_URL = 'https://dreamlab-ai.github.io/fairfield';
const ADMIN_MNEMONIC = 'glimpse marble confirm army sleep imitate lake balance home panic view brand';
const ADMIN_PUBKEY = '11ed64225dd5e2c5e18f61ad43d5ad9272d08739d3a20dd25886197b0738663c';

async function loginWithMnemonic(page: Page, mnemonic: string) {
  // Navigate to login page
  await page.goto(`${LIVE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // The Login component has 3 tabs: "Paste Phrase", "Enter Words", "Private Key"
  // Default is "Paste Phrase" mode which shows a textarea

  // Fill the mnemonic textarea
  const mnemonicTextarea = page.locator('textarea');
  await mnemonicTextarea.waitFor({ state: 'visible', timeout: 10000 });
  await mnemonicTextarea.fill(mnemonic);

  // Click "Restore Account" button
  const restoreButton = page.getByRole('button', { name: /Restore Account/i });
  await restoreButton.waitFor({ state: 'visible', timeout: 5000 });
  await restoreButton.click();

  // Wait for navigation or processing
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle');
}

test.describe('Live Endpoint Tests', () => {
  test('site loads and shows Fairfield branding', async ({ page }) => {
    await page.goto(LIVE_URL);
    await page.waitForLoadState('networkidle');

    // Take screenshot of landing page
    await page.screenshot({ path: '/tmp/playwright-screenshots/01-landing.png', fullPage: true });

    // Should see Fairfield title or login options
    const hasTitle = await page.getByText(/Fairfield/i).isVisible({ timeout: 5000 }).catch(() => false);
    const hasLogin = await page.getByRole('link', { name: /login/i }).isVisible({ timeout: 3000 }).catch(() => false);
    const hasSignup = await page.getByRole('link', { name: /create.*account|sign.*up/i }).isVisible({ timeout: 3000 }).catch(() => false);

    console.log(`Title visible: ${hasTitle}, Login: ${hasLogin}, Signup: ${hasSignup}`);
    console.log(`Current URL: ${page.url()}`);
    expect(hasTitle || hasLogin || hasSignup).toBe(true);
  });

  test('login page renders correctly with mnemonic option', async ({ page }) => {
    await page.goto(`${LIVE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: '/tmp/playwright-screenshots/02-login-page.png', fullPage: true });

    // Check for "Restore Your Account" title
    const hasRestoreTitle = await page.getByText('Restore Your Account').isVisible({ timeout: 5000 }).catch(() => false);
    console.log('Login page has "Restore Your Account" title:', hasRestoreTitle);

    // Check for mnemonic textarea
    const hasTextarea = await page.locator('textarea').isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Login page has mnemonic textarea:', hasTextarea);

    // Check for tabs
    const hasPasteTab = await page.getByRole('button', { name: /Paste Phrase/i }).isVisible({ timeout: 3000 }).catch(() => false);
    console.log('Login page has Paste Phrase tab:', hasPasteTab);
  });

  test('admin login with mnemonic', async ({ page }) => {
    await page.goto(`${LIVE_URL}/login`);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: '/tmp/playwright-screenshots/03-before-login.png', fullPage: true });

    // Fill mnemonic
    const mnemonicTextarea = page.locator('textarea');
    await mnemonicTextarea.waitFor({ state: 'visible', timeout: 10000 });
    await mnemonicTextarea.fill(ADMIN_MNEMONIC);

    await page.screenshot({ path: '/tmp/playwright-screenshots/03b-mnemonic-filled.png', fullPage: true });

    // Click Restore Account
    const restoreButton = page.getByRole('button', { name: /Restore Account/i });
    await restoreButton.click();

    // Wait for processing
    await page.waitForTimeout(5000);
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: '/tmp/playwright-screenshots/04-after-login.png', fullPage: true });

    // Check if logged in by looking at URL
    const currentUrl = page.url();
    const loggedIn = !currentUrl.includes('/login') && (currentUrl.includes('/chat') || currentUrl.includes('/pending'));
    console.log(`After login URL: ${currentUrl}`);
    console.log(`Login successful: ${loggedIn}`);

    // Check for any error messages
    const hasError = await page.locator('.alert-error').isVisible({ timeout: 2000 }).catch(() => false);
    if (hasError) {
      const errorText = await page.locator('.alert-error').textContent();
      console.log(`Error message: ${errorText}`);
    }
  });

  test('check chat page for nicknames and avatars', async ({ page }) => {
    // First login
    await loginWithMnemonic(page, ADMIN_MNEMONIC);

    const afterLoginUrl = page.url();
    console.log(`After login, URL is: ${afterLoginUrl}`);

    // Navigate to chat if not already there
    if (!afterLoginUrl.includes('/chat')) {
      await page.goto(`${LIVE_URL}/chat`);
      await page.waitForLoadState('networkidle');
    }
    await page.waitForTimeout(3000);

    await page.screenshot({ path: '/tmp/playwright-screenshots/05-chat-page.png', fullPage: true });

    // Check for avatar elements
    const avatarElements = await page.locator('img[alt*="avatar"], .avatar, [class*="avatar"]').count();
    console.log(`Avatar elements found: ${avatarElements}`);

    // Check for user display names
    const displayNames = await page.locator('.display-name, .username, [class*="displayName"], [class*="userName"]').count();
    console.log(`Display name elements found: ${displayNames}`);

    // Get all section headers
    const sectionNames = await page.locator('h2, h3, [class*="section"]').allTextContents();
    console.log('Section headers:', sectionNames.filter(s => s.trim()).slice(0, 10));
  });

  test('check admin dashboard for pending requests', async ({ page }) => {
    // Login as admin
    await loginWithMnemonic(page, ADMIN_MNEMONIC);
    await page.waitForTimeout(2000);

    // Navigate to admin
    await page.goto(`${LIVE_URL}/admin`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: '/tmp/playwright-screenshots/06-admin-page.png', fullPage: true });

    // Check page content
    const pageUrl = page.url();
    console.log(`Admin page URL: ${pageUrl}`);

    // If redirected to login, admin access may have issues
    if (pageUrl.includes('/login')) {
      console.log('WARNING: Redirected to login from admin page - not logged in as admin');
      return;
    }

    // Check for pending requests section
    const hasPending = await page.getByText(/pending|request|approval/i).isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`Admin has pending requests section: ${hasPending}`);

    // Get all dashboard elements
    const dashboardContent = await page.locator('.card, .stat').allTextContents();
    console.log('Dashboard content:', dashboardContent.slice(0, 5));
  });

  test('verify section names are correct', async ({ page }) => {
    await loginWithMnemonic(page, ADMIN_MNEMONIC);

    await page.goto(`${LIVE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    await page.screenshot({ path: '/tmp/playwright-screenshots/07-sections.png', fullPage: true });

    // Check for expected section names
    const hasFairfieldGuests = await page.getByText('Fairfield Guests').isVisible({ timeout: 5000 }).catch(() => false);
    const hasMiniMooNoir = await page.getByText('MiniMooNoir').isVisible({ timeout: 5000 }).catch(() => false);
    const hasDreamLab = await page.getByText('DreamLab').isVisible({ timeout: 5000 }).catch(() => false);

    console.log(`Section visibility:`);
    console.log(`  - Fairfield Guests: ${hasFairfieldGuests}`);
    console.log(`  - MiniMooNoir: ${hasMiniMooNoir}`);
    console.log(`  - DreamLab: ${hasDreamLab}`);

    // Get page HTML to inspect
    const pageContent = await page.content();
    const sectionMatches = pageContent.match(/(Fairfield Guests|MiniMooNoir|DreamLab)/g);
    console.log('Sections found in HTML:', sectionMatches);
  });

  test('inspect DOM for profile display issues', async ({ page }) => {
    await loginWithMnemonic(page, ADMIN_MNEMONIC);
    await page.waitForTimeout(2000);

    await page.goto(`${LIVE_URL}/chat`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Get all user-related elements
    const userElements = await page.evaluate(() => {
      const elements = document.querySelectorAll('[class*="user"], [class*="profile"], [class*="avatar"], [class*="name"]');
      return Array.from(elements).map(el => ({
        tag: el.tagName,
        className: el.className,
        innerText: el.textContent?.substring(0, 100)
      }));
    });

    console.log('User-related elements found:', userElements.length);
    if (userElements.length > 0) {
      console.log('Sample elements:', JSON.stringify(userElements.slice(0, 5), null, 2));
    }

    // Check for console errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(1000);
    if (errors.length > 0) {
      console.log('Console errors:', errors.slice(0, 5));
    }
  });
});
