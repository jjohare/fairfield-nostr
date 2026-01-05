/**
 * Comprehensive Browser UX/UI Test
 * Tests the Nostr BBS app across multiple user agents, checking console errors,
 * feature functionality, and visual rendering.
 */

import { chromium, firefox, Browser, Page, BrowserContext, ConsoleMessage } from 'playwright';

const BASE_URL = 'http://localhost:5173';

// Admin credentials from .env
const ADMIN_SEED = 'loyal bench cheap find pause draft various chief slide lunar sight useless';
const ADMIN_PUBKEY = 'd2508ff0e0f4f0791d25fac8a8e400fa2930086c2fe50c7dbb7f265aeffe2031';

// User agents to test
const USER_AGENTS = {
  desktop: {
    name: 'Desktop Chrome',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  },
  tablet: {
    name: 'iPad Pro',
    viewport: { width: 1024, height: 1366 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  mobile: {
    name: 'iPhone 14 Pro',
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
  },
  android: {
    name: 'Samsung Galaxy S23',
    viewport: { width: 360, height: 780 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
  }
};

interface TestResult {
  userAgent: string;
  consoleErrors: string[];
  consoleWarnings: string[];
  screenshots: string[];
  features: { [key: string]: boolean };
  scrollTest: boolean;
  loadTime: number;
}

const results: TestResult[] = [];

async function collectConsoleMessages(page: Page): Promise<{ errors: string[], warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(`[ERROR] ${msg.text()}`);
    } else if (msg.type() === 'warning') {
      warnings.push(`[WARN] ${msg.text()}`);
    }
  });

  page.on('pageerror', (error: Error) => {
    errors.push(`[PAGE ERROR] ${error.message}`);
  });

  return { errors, warnings };
}

async function testScrolling(page: Page): Promise<boolean> {
  try {
    // Scroll down
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(500);

    // Scroll back up
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Smooth scroll test
    await page.evaluate(() => {
      window.scrollBy({ top: 300, behavior: 'smooth' });
    });
    await page.waitForTimeout(800);

    return true;
  } catch (e) {
    console.error('Scroll test failed:', e);
    return false;
  }
}

async function takeScreenshot(page: Page, name: string, userAgent: string): Promise<string> {
  const filename = `/home/devuser/workspace/project/tests/e2e/screenshots/${userAgent.replace(/\s+/g, '-')}-${name}.png`;
  await page.screenshot({ path: filename, fullPage: false });
  return filename;
}

async function testHomePage(page: Page, uaName: string): Promise<{ [key: string]: boolean }> {
  const features: { [key: string]: boolean } = {};

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    features['page_loads'] = true;

    // Check for main elements
    features['has_header'] = await page.locator('header, nav, [class*="header"], [class*="nav"]').first().isVisible().catch(() => false);
    features['has_main_content'] = await page.locator('main, [class*="main"], [class*="content"]').first().isVisible().catch(() => false);
    features['has_login_option'] = await page.locator('text=/login|sign in|connect/i').first().isVisible().catch(() => false);

    await takeScreenshot(page, 'home', uaName);

  } catch (e) {
    console.error(`Home page test failed for ${uaName}:`, e);
    features['page_loads'] = false;
  }

  return features;
}

async function testLoginAsAdmin(page: Page, uaName: string): Promise<{ [key: string]: boolean }> {
  const features: { [key: string]: boolean } = {};

  try {
    // Look for login/connect button
    const loginBtn = page.locator('text=/login|sign in|connect|get started/i').first();
    if (await loginBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await loginBtn.click();
      await page.waitForTimeout(1000);
      features['login_modal_opens'] = true;
      await takeScreenshot(page, 'login-modal', uaName);

      // Look for seed phrase / mnemonic input option
      const seedOption = page.locator('text=/seed|mnemonic|recovery|phrase|import/i').first();
      if (await seedOption.isVisible({ timeout: 3000 }).catch(() => false)) {
        await seedOption.click();
        await page.waitForTimeout(500);
        features['seed_input_available'] = true;

        // Try to find input field for seed
        const seedInput = page.locator('input[type="text"], input[type="password"], textarea').first();
        if (await seedInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await seedInput.fill(ADMIN_SEED);
          features['seed_entered'] = true;
          await takeScreenshot(page, 'seed-entered', uaName);

          // Look for submit/continue button
          const submitBtn = page.locator('button:has-text(/login|submit|continue|confirm|import/i)').first();
          if (await submitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await submitBtn.click();
            await page.waitForTimeout(2000);
            features['login_submitted'] = true;
            await takeScreenshot(page, 'after-login', uaName);
          }
        }
      }
    } else {
      features['login_modal_opens'] = false;
    }
  } catch (e) {
    console.error(`Admin login test failed for ${uaName}:`, e);
  }

  return features;
}

async function exploreFeatures(page: Page, uaName: string): Promise<{ [key: string]: boolean }> {
  const features: { [key: string]: boolean } = {};

  try {
    // Check for navigation elements
    const navItems = await page.locator('nav a, [class*="nav"] a, [class*="menu"] a, [class*="sidebar"] a').all();
    features['has_navigation'] = navItems.length > 0;
    console.log(`Found ${navItems.length} navigation items`);

    // Try clicking through main sections
    const sections = ['home', 'chat', 'channels', 'forums', 'settings', 'profile', 'about'];
    for (const section of sections) {
      const link = page.locator(`a:has-text("${section}"), [href*="${section}"]`).first();
      if (await link.isVisible({ timeout: 1000 }).catch(() => false)) {
        await link.click();
        await page.waitForTimeout(1000);
        features[`section_${section}`] = true;
        await takeScreenshot(page, `section-${section}`, uaName);
        await testScrolling(page);
      }
    }

    // Check for common UI components
    features['has_buttons'] = await page.locator('button').first().isVisible({ timeout: 1000 }).catch(() => false);
    features['has_forms'] = await page.locator('form, input, textarea').first().isVisible({ timeout: 1000 }).catch(() => false);
    features['has_modals'] = await page.locator('[class*="modal"], [role="dialog"]').first().isVisible({ timeout: 1000 }).catch(() => false);

    // Check responsive elements
    features['mobile_menu_visible'] = await page.locator('[class*="mobile"], [class*="hamburger"], [class*="menu-toggle"]').first().isVisible({ timeout: 1000 }).catch(() => false);

  } catch (e) {
    console.error(`Feature exploration failed for ${uaName}:`, e);
  }

  return features;
}

async function testWithUserAgent(browser: Browser, uaConfig: typeof USER_AGENTS.desktop, uaKey: string): Promise<TestResult> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing with: ${uaConfig.name}`);
  console.log(`Viewport: ${uaConfig.viewport.width}x${uaConfig.viewport.height}`);
  console.log(`${'='.repeat(60)}`);

  const context: BrowserContext = await browser.newContext({
    viewport: uaConfig.viewport,
    userAgent: uaConfig.userAgent,
    deviceScaleFactor: uaKey === 'mobile' || uaKey === 'android' ? 3 : 1,
  });

  const page: Page = await context.newPage();
  const { errors, warnings } = await collectConsoleMessages(page);

  const startTime = Date.now();

  // Test home page
  const homeFeatures = await testHomePage(page, uaConfig.name);

  // Test scrolling
  const scrollTest = await testScrolling(page);

  // Test admin login
  const loginFeatures = await testLoginAsAdmin(page, uaConfig.name);

  // Explore features
  const exploreResults = await exploreFeatures(page, uaConfig.name);

  const loadTime = Date.now() - startTime;

  await context.close();

  const result: TestResult = {
    userAgent: uaConfig.name,
    consoleErrors: errors,
    consoleWarnings: warnings,
    screenshots: [],
    features: { ...homeFeatures, ...loginFeatures, ...exploreResults },
    scrollTest,
    loadTime
  };

  // Report findings
  console.log(`\nResults for ${uaConfig.name}:`);
  console.log(`  Load time: ${loadTime}ms`);
  console.log(`  Console errors: ${errors.length}`);
  console.log(`  Console warnings: ${warnings.length}`);
  console.log(`  Scroll test: ${scrollTest ? 'PASS' : 'FAIL'}`);
  console.log(`  Features tested: ${Object.keys(result.features).length}`);

  if (errors.length > 0) {
    console.log('\n  Console Errors:');
    errors.slice(0, 5).forEach(e => console.log(`    ${e}`));
    if (errors.length > 5) console.log(`    ... and ${errors.length - 5} more`);
  }

  return result;
}

async function createNormalUser(page: Page): Promise<boolean> {
  try {
    console.log('\nCreating normal user account...');

    // Look for create/register option
    const createBtn = page.locator('text=/create|register|new account|sign up|generate/i').first();
    if (await createBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createBtn.click();
      await page.waitForTimeout(1000);

      // Look for generate new key option
      const generateBtn = page.locator('text=/generate|create new|new key/i').first();
      if (await generateBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await generateBtn.click();
        await page.waitForTimeout(2000);
        await takeScreenshot(page, 'new-user-created', 'normal-user');
        return true;
      }
    }
    return false;
  } catch (e) {
    console.error('Failed to create normal user:', e);
    return false;
  }
}

async function main() {
  // Create screenshots directory
  const { mkdir } = await import('fs/promises');
  await mkdir('/home/devuser/workspace/project/tests/e2e/screenshots', { recursive: true });

  console.log('Starting comprehensive browser UX/UI test');
  console.log(`Target: ${BASE_URL}`);
  console.log(`Display: ${process.env.DISPLAY || ':1'}`);

  // Launch browser with display
  const browser = await chromium.launch({
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  try {
    // Test each user agent
    for (const [key, config] of Object.entries(USER_AGENTS)) {
      const result = await testWithUserAgent(browser, config, key);
      results.push(result);
    }

    // Test normal user creation with desktop
    const context = await browser.newContext({
      viewport: USER_AGENTS.desktop.viewport,
      userAgent: USER_AGENTS.desktop.userAgent,
    });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    const userCreated = await createNormalUser(page);
    console.log(`\nNormal user creation: ${userCreated ? 'SUCCESS' : 'SKIPPED/FAILED'}`);
    await context.close();

  } finally {
    await browser.close();
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  console.log('FINAL TEST SUMMARY');
  console.log('='.repeat(60));

  let totalErrors = 0;
  let totalWarnings = 0;

  for (const result of results) {
    console.log(`\n${result.userAgent}:`);
    console.log(`  Errors: ${result.consoleErrors.length}`);
    console.log(`  Warnings: ${result.consoleWarnings.length}`);
    console.log(`  Load time: ${result.loadTime}ms`);
    console.log(`  Scroll: ${result.scrollTest ? 'OK' : 'FAIL'}`);

    totalErrors += result.consoleErrors.length;
    totalWarnings += result.consoleWarnings.length;

    const passedFeatures = Object.entries(result.features).filter(([_, v]) => v).length;
    const totalFeatures = Object.keys(result.features).length;
    console.log(`  Features: ${passedFeatures}/${totalFeatures} passed`);
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`Total console errors across all tests: ${totalErrors}`);
  console.log(`Total console warnings across all tests: ${totalWarnings}`);
  console.log(`Screenshots saved to: tests/e2e/screenshots/`);
  console.log('='.repeat(60));
}

main().catch(console.error);
