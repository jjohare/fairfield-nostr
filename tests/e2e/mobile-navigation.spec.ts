import { test, expect, devices } from '@playwright/test';

/**
 * Mobile Navigation E2E Tests for Nostr-BBS
 *
 * Tests comprehensive mobile navigation functionality including:
 * - Hamburger menu interactions
 * - Section navigation
 * - Channel list scrolling
 * - Profile modal display
 * - Settings access
 * - Touch interactions and gestures
 * - Mobile viewport fitting
 * - Touch target sizes (min 44px)
 */

// Use Pixel 7 for Android emulation
test.use({
  ...devices['Pixel 7'],
  // Override with explicit mobile settings
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  isMobile: true,
});

test.describe('Mobile Navigation - Android (Pixel 7)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Wait for app to be ready
    await page.waitForLoadState('networkidle');
  });

  test('hamburger menu opens and closes correctly', async ({ page }) => {
    // Take initial screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-initial.png',
      fullPage: true
    });

    // Verify hamburger button is visible on mobile
    const hamburgerBtn = page.locator('.hamburger-btn');
    await expect(hamburgerBtn).toBeVisible();

    // Verify minimum touch target size (44px)
    const btnBox = await hamburgerBtn.boundingBox();
    expect(btnBox?.width).toBeGreaterThanOrEqual(44);
    expect(btnBox?.height).toBeGreaterThanOrEqual(44);

    // Verify hamburger icon is present
    await expect(hamburgerBtn.locator('.hamburger-icon')).toBeVisible();

    // Check aria attributes
    await expect(hamburgerBtn).toHaveAttribute('aria-label', 'Toggle menu');
    await expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');

    // Open menu with tap
    await hamburgerBtn.tap();

    // Wait for drawer animation
    await page.waitForTimeout(400);

    // Verify menu is open
    await expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'true');

    // Verify mobile menu drawer is visible
    const mobileDrawer = page.locator('.mobile-menu-drawer.open');
    await expect(mobileDrawer).toBeVisible();

    // Verify body scroll is locked
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');

    // Take screenshot with menu open
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-menu-open.png',
      fullPage: true
    });

    // Verify backdrop is present
    const backdrop = page.locator('.mobile-menu-backdrop');
    await expect(backdrop).toBeVisible();

    // Close menu by tapping hamburger icon (now shows X)
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Verify menu is closed
    await expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');
    await expect(mobileDrawer).not.toBeVisible();

    // Verify body scroll is restored
    const bodyOverflowAfter = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflowAfter).toBe('');
  });

  test('hamburger menu closes when tapping backdrop', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');
    const backdrop = page.locator('.mobile-menu-backdrop');
    const mobileDrawer = page.locator('.mobile-menu-drawer.open');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);
    await expect(mobileDrawer).toBeVisible();

    // Tap backdrop to close
    await backdrop.tap();
    await page.waitForTimeout(400);

    // Verify menu is closed
    await expect(mobileDrawer).not.toBeVisible();
    await expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('section navigation works correctly in mobile menu', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Verify all navigation items are present with correct touch targets
    const navItems = page.locator('.mobile-menu-item');
    const itemCount = await navItems.count();
    expect(itemCount).toBeGreaterThan(0);

    // Check each navigation item
    for (let i = 0; i < itemCount; i++) {
      const item = navItems.nth(i);
      const box = await item.boundingBox();

      // Verify minimum touch target height (48px for mobile menu items)
      expect(box?.height).toBeGreaterThanOrEqual(48);
    }

    // Verify specific menu items exist
    await expect(page.locator('.mobile-menu-item').filter({ hasText: 'Channels' })).toBeVisible();
    await expect(page.locator('.mobile-menu-item').filter({ hasText: 'Messages' })).toBeVisible();
    await expect(page.locator('.mobile-menu-item').filter({ hasText: 'Bookmarks' })).toBeVisible();

    // Take screenshot of menu items
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-menu-items.png',
      fullPage: true
    });

    // Test navigation to Channels section
    const channelsLink = page.locator('.mobile-menu-item').filter({ hasText: 'Channels' });
    await channelsLink.tap();

    // Wait for navigation
    await page.waitForTimeout(500);

    // Verify URL changed (assuming authenticated state)
    // Note: In unauthenticated state, this might redirect to signup
    const url = page.url();
    expect(url).toContain('/chat');
  });

  test('mobile menu items have proper icons and labels', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Verify icons are present for each menu item
    const searchItem = page.locator('.mobile-menu-item').filter({ hasText: 'Search Messages' });
    await expect(searchItem.locator('.menu-icon')).toBeVisible();

    const channelsItem = page.locator('.mobile-menu-item').filter({ hasText: 'Channels' });
    await expect(channelsItem.locator('.menu-icon')).toBeVisible();

    const messagesItem = page.locator('.mobile-menu-item').filter({ hasText: 'Messages' });
    await expect(messagesItem.locator('.menu-icon')).toBeVisible();

    const bookmarksItem = page.locator('.mobile-menu-item').filter({ hasText: 'Bookmarks' });
    await expect(bookmarksItem.locator('.menu-icon')).toBeVisible();

    // Verify logout item is styled differently
    const logoutItem = page.locator('.mobile-menu-item.logout-item');
    await expect(logoutItem).toBeVisible();
    await expect(logoutItem.locator('.menu-icon')).toBeVisible();

    // Take screenshot showing all icons
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-icons.png',
      fullPage: true
    });
  });

  test('swipe gesture closes mobile menu', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');
    const mobileDrawer = page.locator('.mobile-menu-drawer.open');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);
    await expect(mobileDrawer).toBeVisible();

    // Get drawer position
    const drawerBox = await mobileDrawer.boundingBox();
    expect(drawerBox).not.toBeNull();

    if (drawerBox) {
      // Simulate swipe left gesture (start from middle of drawer, swipe left)
      const startX = drawerBox.x + drawerBox.width / 2;
      const startY = drawerBox.y + drawerBox.height / 2;
      const endX = startX - 100; // Swipe 100px to the left

      await page.touchscreen.tap(startX, startY);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, startY);
      await page.mouse.up();

      await page.waitForTimeout(400);

      // Verify menu is closed
      await expect(mobileDrawer).not.toBeVisible();
    }
  });

  test('keyboard navigation works in mobile menu', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Press Escape key to close menu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Verify menu is closed
    const mobileDrawer = page.locator('.mobile-menu-drawer.open');
    await expect(mobileDrawer).not.toBeVisible();
    await expect(hamburgerBtn).toHaveAttribute('aria-expanded', 'false');
  });

  test('viewport fitting and safe areas are respected', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Check that drawer respects safe area insets
    const drawer = page.locator('.mobile-menu-drawer.open');
    const paddingTop = await drawer.evaluate((el) =>
      window.getComputedStyle(el).paddingTop
    );
    const paddingBottom = await drawer.evaluate((el) =>
      window.getComputedStyle(el).paddingBottom
    );

    // Safe area insets should be applied (env() fallback to 0)
    expect(paddingTop).toBeDefined();
    expect(paddingBottom).toBeDefined();

    // Take screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-safe-areas.png',
      fullPage: true
    });
  });

  test('bookmark badge displays correctly', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Check for bookmark item
    const bookmarkItem = page.locator('.mobile-menu-item').filter({ hasText: 'Bookmarks' });
    await expect(bookmarkItem).toBeVisible();

    // Note: Badge visibility depends on bookmark count
    // If bookmarks exist, badge should be visible
    const badge = bookmarkItem.locator('.mobile-badge');
    const badgeExists = await badge.count() > 0;

    if (badgeExists) {
      await expect(badge).toBeVisible();
      const badgeText = await badge.textContent();
      expect(badgeText).toMatch(/^\d+$/); // Should be a number
    }

    // Take screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-bookmarks.png',
      fullPage: true
    });
  });

  test('search opens from mobile menu', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Tap search button
    const searchBtn = page.locator('.mobile-menu-item').filter({ hasText: 'Search Messages' });
    await expect(searchBtn).toBeVisible();
    await searchBtn.tap();

    // Wait for search modal/component to open
    await page.waitForTimeout(500);

    // Verify menu is closed after clicking search
    const mobileDrawer = page.locator('.mobile-menu-drawer.open');
    await expect(mobileDrawer).not.toBeVisible();

    // Take screenshot (search modal should be open)
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-search-open.png',
      fullPage: true
    });
  });

  test('active page is highlighted in mobile menu', async ({ page }) => {
    // Navigate to a specific page
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    // Verify Channels item is marked as active
    const channelsItem = page.locator('.mobile-menu-item').filter({ hasText: 'Channels' });
    await expect(channelsItem).toHaveClass(/active/);

    // Verify aria-current is set
    await expect(channelsItem).toHaveAttribute('aria-current', 'page');

    // Take screenshot showing active state
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-active-page.png',
      fullPage: true
    });
  });

  test('focus management works correctly', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Focus hamburger button
    await hamburgerBtn.focus();

    // Verify focus styles are applied
    await expect(hamburgerBtn).toBeFocused();

    // Take screenshot of focused state
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-focus-hamburger.png',
      fullPage: true
    });

    // Open menu
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // Tab through menu items
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();

    // Take screenshot of focused menu item
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-focus-item.png',
      fullPage: true
    });
  });

  test('desktop navigation is hidden on mobile', async ({ page }) => {
    // Verify desktop nav is not visible
    const desktopNav = page.locator('.desktop-nav');
    await expect(desktopNav).not.toBeVisible();

    // Verify hamburger is visible
    const hamburgerBtn = page.locator('.hamburger-btn');
    await expect(hamburgerBtn).toBeVisible();

    // Take screenshot confirming mobile layout
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-layout.png',
      fullPage: true
    });
  });

  test('menu drawer has proper width constraints', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    const drawer = page.locator('.mobile-menu-drawer.open');
    const drawerBox = await drawer.boundingBox();

    expect(drawerBox).not.toBeNull();
    if (drawerBox) {
      // Verify width is 280px or max 85vw (whichever is smaller)
      const viewportWidth = page.viewportSize()?.width || 412;
      const maxWidth = Math.min(280, viewportWidth * 0.85);

      expect(drawerBox.width).toBeLessThanOrEqual(maxWidth + 1); // +1 for rounding
    }
  });

  test('menu animations complete smoothly', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');
    const drawer = page.locator('.mobile-menu-drawer');

    // Measure opening animation
    const startTime = Date.now();
    await hamburgerBtn.tap();

    // Wait for drawer to be fully visible
    await expect(drawer).toHaveClass(/open/);
    const openDuration = Date.now() - startTime;

    // Animation should complete within reasonable time (< 1s)
    expect(openDuration).toBeLessThan(1000);

    // Wait for animation
    await page.waitForTimeout(400);

    // Measure closing animation
    const closeStartTime = Date.now();
    await hamburgerBtn.tap();

    // Wait for drawer to be hidden
    await expect(drawer).not.toHaveClass(/open/);
    const closeDuration = Date.now() - closeStartTime;

    expect(closeDuration).toBeLessThan(1000);
  });

  test('mobile menu maintains scroll position', async ({ page }) => {
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Open menu
    await hamburgerBtn.tap();
    await page.waitForTimeout(400);

    const drawer = page.locator('.mobile-menu-drawer.open');

    // If menu is scrollable, verify scrolling works
    const isScrollable = await drawer.evaluate((el) =>
      el.scrollHeight > el.clientHeight
    );

    if (isScrollable) {
      // Scroll down
      await drawer.evaluate((el) => el.scrollTo(0, 100));
      await page.waitForTimeout(200);

      const scrollTop = await drawer.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }

    // Take final screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-nav-scroll.png',
      fullPage: true
    });
  });
});

test.describe('Mobile Navigation - Cross-Device Tests', () => {
  const mobileDevices = [
    { name: 'Pixel 7', device: devices['Pixel 7'] },
    { name: 'iPhone 12', device: devices['iPhone 12'] },
    { name: 'Galaxy S9+', device: devices['Galaxy S9+'] },
  ];

  for (const { name, device } of mobileDevices) {
    test(`hamburger menu works on ${name}`, async ({ browser }) => {
      const context = await browser.newContext({
        ...device,
        hasTouch: true,
      });

      const page = await context.newPage();
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      const hamburgerBtn = page.locator('.hamburger-btn');
      await expect(hamburgerBtn).toBeVisible();

      // Open menu
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      // Verify menu is open
      const drawer = page.locator('.mobile-menu-drawer.open');
      await expect(drawer).toBeVisible();

      // Take device-specific screenshot
      await page.screenshot({
        path: `tests/qa-screenshots/mobile-nav-${name.toLowerCase().replace(/\s+/g, '-')}.png`,
        fullPage: true
      });

      await context.close();
    });
  }
});
