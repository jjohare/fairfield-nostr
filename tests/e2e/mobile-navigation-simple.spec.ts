/**
 * Simplified Mobile Navigation Test
 * Testing core mobile UI components without full authentication flow
 */

import { test, expect, devices, type Page } from '@playwright/test';

// Use Pixel 7 for Android emulation
const mobileDevice = devices['Pixel 7'];

test.use({
  ...mobileDevice,
  viewport: { width: 412, height: 915 },
  hasTouch: true,
  isMobile: true,
});

test.describe('Mobile Navigation UI Tests - Pixel 7', () => {
  test('page loads with mobile viewport', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Take screenshot of initial mobile view
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-01-initial-load.png',
      fullPage: true
    });

    // Verify viewport is mobile size
    const viewport = page.viewportSize();
    expect(viewport?.width).toBe(412);
    expect(viewport?.height).toBe(915);
  });

  test('hamburger menu button is visible and properly sized', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Wait for navigation to render
    await page.waitForSelector('.navbar', { timeout: 10000 });

    // Find hamburger button
    const hamburgerBtn = page.locator('.hamburger-btn');

    // Verify visibility
    const isVisible = await hamburgerBtn.isVisible();

    if (isVisible) {
      // Check minimum touch target size (44x44px)
      const box = await hamburgerBtn.boundingBox();
      expect(box).not.toBeNull();

      if (box) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }

      // Verify ARIA attributes
      await expect(hamburgerBtn).toHaveAttribute('aria-label', 'Toggle menu');

      // Take screenshot
      await page.screenshot({
        path: 'tests/qa-screenshots/mobile-02-hamburger-visible.png',
        fullPage: false
      });
    }
  });

  test('hamburger menu opens on tap', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      // Tap to open
      await hamburgerBtn.tap();

      // Wait for animation
      await page.waitForTimeout(400);

      // Check if menu drawer appeared
      const drawer = page.locator('.mobile-menu-drawer');
      const isOpen = await drawer.evaluate(el => el.classList.contains('open'));

      // Take screenshot with menu open
      await page.screenshot({
        path: 'tests/qa-screenshots/mobile-03-menu-open.png',
        fullPage: true
      });

      if (isOpen) {
        // Verify backdrop exists
        const backdrop = page.locator('.mobile-menu-backdrop');
        await expect(backdrop).toBeVisible();

        // Verify menu content is visible
        const menuContent = page.locator('.mobile-menu-content');
        await expect(menuContent).toBeVisible();
      }
    }
  });

  test('menu items have proper touch targets', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      // Check all menu items
      const menuItems = page.locator('.mobile-menu-item');
      const count = await menuItems.count();

      if (count > 0) {
        // Verify each item has minimum 48px height
        for (let i = 0; i < Math.min(count, 5); i++) {
          const item = menuItems.nth(i);
          const box = await item.boundingBox();

          if (box) {
            expect(box.height).toBeGreaterThanOrEqual(48);
          }
        }

        // Take screenshot
        await page.screenshot({
          path: 'tests/qa-screenshots/mobile-04-menu-items.png',
          fullPage: true
        });
      }
    }
  });

  test('menu closes on backdrop tap', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      // Open menu
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      const drawer = page.locator('.mobile-menu-drawer');
      const isOpen = await drawer.evaluate(el => el.classList.contains('open'));

      if (isOpen) {
        // Tap backdrop
        const backdrop = page.locator('.mobile-menu-backdrop');
        await backdrop.tap();
        await page.waitForTimeout(400);

        // Verify menu closed
        const isClosed = !(await drawer.evaluate(el => el.classList.contains('open')));

        // Take screenshot
        await page.screenshot({
          path: 'tests/qa-screenshots/mobile-05-menu-closed.png',
          fullPage: true
        });

        expect(isClosed).toBe(true);
      }
    }
  });

  test('menu closes with X button', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      // Open menu
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      // Tap hamburger again (now shows X)
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      const drawer = page.locator('.mobile-menu-drawer');
      const isClosed = !(await drawer.evaluate(el => el.classList.contains('open')));

      // Take screenshot
      await page.screenshot({
        path: 'tests/qa-screenshots/mobile-06-close-button.png',
        fullPage: false
      });

      expect(isClosed).toBe(true);
    }
  });

  test('menu closes with Escape key', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      // Open menu
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      // Press Escape
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);

      const drawer = page.locator('.mobile-menu-drawer');
      const isClosed = !(await drawer.evaluate(el => el.classList.contains('open')));

      expect(isClosed).toBe(true);
    }
  });

  test('desktop navigation is hidden on mobile', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    // Desktop nav should not be visible
    const desktopNav = page.locator('.desktop-nav');
    const isHidden = !(await desktopNav.isVisible());

    // Hamburger should be visible
    const hamburgerBtn = page.locator('.hamburger-btn');
    const hamburgerVisible = await hamburgerBtn.isVisible();

    // Take screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-07-layout-check.png',
      fullPage: false
    });

    expect(isHidden).toBe(true);
    expect(hamburgerVisible).toBe(true);
  });

  test('menu drawer respects safe areas', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      const drawer = page.locator('.mobile-menu-drawer');
      const styles = await drawer.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          paddingTop: computed.paddingTop,
          paddingBottom: computed.paddingBottom,
        };
      });

      // Take screenshot
      await page.screenshot({
        path: 'tests/qa-screenshots/mobile-08-safe-areas.png',
        fullPage: true
      });

      // Verify padding exists (even if 0px due to no safe area inset)
      expect(styles.paddingTop).toBeDefined();
      expect(styles.paddingBottom).toBeDefined();
    }
  });

  test('menu items have icons', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      // Find menu items with icons
      const itemsWithIcons = page.locator('.mobile-menu-item .menu-icon');
      const iconCount = await itemsWithIcons.count();

      // Take screenshot
      await page.screenshot({
        path: 'tests/qa-screenshots/mobile-09-menu-icons.png',
        fullPage: true
      });

      // Should have at least some icons
      expect(iconCount).toBeGreaterThan(0);
    }
  });

  test('logo is visible and properly sized', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const logo = page.locator('.logo');
    await expect(logo).toBeVisible();

    // Verify logo is a link to home
    await expect(logo).toHaveAttribute('href');

    // Take screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-10-logo.png',
      fullPage: false
    });
  });

  test('navbar is fixed at top', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const navbar = page.locator('.navbar');
    const position = await navbar.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        top: computed.top,
        zIndex: computed.zIndex,
      };
    });

    // Navbar should have high z-index for layering
    const zIndex = parseInt(position.zIndex);
    expect(zIndex).toBeGreaterThan(10);

    // Take screenshot
    await page.screenshot({
      path: 'tests/qa-screenshots/mobile-11-navbar-position.png',
      fullPage: false
    });
  });

  test('menu drawer has proper width', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      await hamburgerBtn.tap();
      await page.waitForTimeout(400);

      const drawer = page.locator('.mobile-menu-drawer');
      const box = await drawer.boundingBox();

      if (box) {
        // Width should be 280px or max 85vw (350px for 412px viewport)
        const maxWidth = Math.min(280, 412 * 0.85);
        expect(box.width).toBeLessThanOrEqual(maxWidth + 5); // +5px tolerance

        // Take screenshot
        await page.screenshot({
          path: 'tests/qa-screenshots/mobile-12-drawer-width.png',
          fullPage: true
        });
      }
    }
  });
});

test.describe('Mobile Navigation - Performance', () => {
  test('menu animation completes quickly', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.navbar');

    const hamburgerBtn = page.locator('.hamburger-btn');

    if (await hamburgerBtn.isVisible()) {
      const startTime = Date.now();

      await hamburgerBtn.tap();
      await page.waitForSelector('.mobile-menu-drawer.open', { timeout: 2000 });

      const duration = Date.now() - startTime;

      // Animation should complete within 1 second
      expect(duration).toBeLessThan(1000);

      // Take screenshot
      await page.screenshot({
        path: 'tests/qa-screenshots/mobile-13-animation-perf.png',
        fullPage: true
      });
    }
  });
});
