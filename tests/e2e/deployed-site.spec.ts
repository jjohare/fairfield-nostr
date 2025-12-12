import { test, expect } from '@playwright/test';

const DEPLOYED_URL = 'https://jjohare.github.io/fairfield-nostr';

test.describe('Deployed Site - Fairfield Nostr PWA', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to deployed site
    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });
  });

  test('homepage loads correctly', async ({ page }) => {
    // Wait for app to hydrate
    await page.waitForLoadState('domcontentloaded');

    // Take screenshot
    await page.screenshot({ path: '/tmp/playwright-screenshots/01-homepage.png', fullPage: true });

    // Check page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check for main content
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('navigation elements are present', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Screenshot the current state
    await page.screenshot({ path: '/tmp/playwright-screenshots/02-nav-check.png', fullPage: true });

    // Get page content for debugging
    const html = await page.content();
    console.log('Page HTML length:', html.length);

    // Check for any visible text content
    const textContent = await page.locator('body').textContent();
    console.log('Body text (first 500 chars):', textContent?.substring(0, 500));
  });

  test('signup page loads', async ({ page }) => {
    await page.goto(`${DEPLOYED_URL}/signup`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/playwright-screenshots/03-signup.png', fullPage: true });

    const content = await page.locator('body').textContent();
    console.log('Signup page content:', content?.substring(0, 300));
  });

  test('setup page loads', async ({ page }) => {
    await page.goto(`${DEPLOYED_URL}/setup`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/playwright-screenshots/04-setup.png', fullPage: true });

    const content = await page.locator('body').textContent();
    console.log('Setup page content:', content?.substring(0, 300));
  });

  test('chat page loads', async ({ page }) => {
    await page.goto(`${DEPLOYED_URL}/chat`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/playwright-screenshots/05-chat.png', fullPage: true });

    const content = await page.locator('body').textContent();
    console.log('Chat page content:', content?.substring(0, 300));
  });

  test('dm page loads', async ({ page }) => {
    await page.goto(`${DEPLOYED_URL}/dm`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/playwright-screenshots/06-dm.png', fullPage: true });

    const content = await page.locator('body').textContent();
    console.log('DM page content:', content?.substring(0, 300));
  });

  test('admin page loads', async ({ page }) => {
    await page.goto(`${DEPLOYED_URL}/admin`, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/playwright-screenshots/07-admin.png', fullPage: true });

    const content = await page.locator('body').textContent();
    console.log('Admin page content:', content?.substring(0, 300));
  });

  test('check for JavaScript errors', async ({ page }) => {
    const errors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      errors.push(err.message);
    });

    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000); // Wait for any async errors

    console.log('JavaScript errors found:', errors.length);
    errors.forEach((err, i) => console.log(`Error ${i + 1}:`, err));

    await page.screenshot({ path: '/tmp/playwright-screenshots/08-error-check.png', fullPage: true });
  });

  test('service worker registration', async ({ page }) => {
    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });

    // Check if service worker is registered
    const swRegistered = await page.evaluate(async () => {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        return registrations.length > 0;
      }
      return false;
    });

    console.log('Service worker registered:', swRegistered);

    await page.screenshot({ path: '/tmp/playwright-screenshots/09-sw-check.png', fullPage: true });
  });

  test('responsive design - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });
    await page.screenshot({ path: '/tmp/playwright-screenshots/10-mobile.png', fullPage: true });
  });

  test('check all interactive elements', async ({ page }) => {
    await page.goto(DEPLOYED_URL, { waitUntil: 'networkidle' });

    // Find all buttons
    const buttons = await page.locator('button').all();
    console.log('Number of buttons:', buttons.length);

    // Find all links
    const links = await page.locator('a').all();
    console.log('Number of links:', links.length);

    // Find all inputs
    const inputs = await page.locator('input').all();
    console.log('Number of inputs:', inputs.length);

    await page.screenshot({ path: '/tmp/playwright-screenshots/11-elements.png', fullPage: true });
  });
});
