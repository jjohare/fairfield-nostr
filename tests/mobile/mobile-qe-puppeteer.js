import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp';

const PIXEL_7_VIEWPORT = {
  width: 412,
  height: 915,
  deviceScaleFactor: 3.5,
  isMobile: true,
  hasTouch: true
};

let testMnemonic = null;

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `qe-mobile-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot: ${screenshotPath}`);
  return screenshotPath;
}

async function waitForSelector(page, selectors, timeout = 5000) {
  for (const selector of selectors) {
    try {
      await page.waitForSelector(selector, { timeout: timeout / selectors.length, visible: true });
      return { found: true, selector };
    } catch (e) {
      continue;
    }
  }
  return { found: false, selector: null };
}

async function clickElement(page, selectors) {
  for (const selector of selectors) {
    try {
      // Try direct selector first
      const element = await page.$(selector);
      if (element) {
        await element.click();
        return { found: true, selector };
      }

      // Try XPath for text content
      if (selector.includes('text')) {
        const text = selector.split('"')[1];
        const [button] = await page.$x(`//a[contains(text(), "${text}")] | //button[contains(text(), "${text}")]`);
        if (button) {
          await button.click();
          return { found: true, selector: `xpath: ${text}` };
        }
      }
    } catch (e) {
      continue;
    }
  }
  return { found: false, selector: null };
}

async function testCreateAccountFlow(browser) {
  console.log('\n🧪 TEST 1: Create Account Flow');
  console.log('='.repeat(60));

  const page = await browser.newPage();
  await page.setViewport(PIXEL_7_VIEWPORT);
  const errors = [];

  try {
    console.log('📱 Loading app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '01-initial-load');

    // Find Create Account
    console.log('🔍 Looking for Create Account...');
    const createSelectors = [
      'a.btn-primary',
      'text"Create Account"',
      'a:has-text("Create Account")',
      '[data-testid="create-account"]',
      'button.create-account',
      '#create-account',
      'button[name="create"]',
      'a[href*="create"]'
    ];

    const createResult = await clickElement(page, createSelectors);

    if (!createResult.found) {
      // Try to find any button text
      const buttons = await page.$$eval('button, a', els =>
        els.map(el => ({ tag: el.tagName, text: el.textContent?.trim(), id: el.id, className: el.className }))
      );

      errors.push({
        severity: 'CRITICAL',
        flow: 'Create Account',
        issue: 'Create Account button not found',
        availableButtons: buttons.filter(b => b.text),
        screenshot: await takeScreenshot(page, '01-create-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    console.log(`✅ Clicked Create Account: ${createResult.selector}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '02-after-create-click');

    // Handle tutorial/skip
    console.log('🔍 Checking for tutorial...');
    const tutorialSelectors = [
      'text"Skip Tutorial"',
      'button.btn-ghost.btn-sm',
      'text"Skip"',
      'text"Next"',
      '[data-testid="skip"]'
    ];

    for (let i = 0; i < 5; i++) {
      const skipResult = await clickElement(page, tutorialSelectors);
      if (skipResult.found) {
        console.log(`✅ Clicked tutorial button: ${skipResult.selector}`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } else {
        console.log(`Tutorial navigation ended after ${i} clicks`);
        break;
      }
    }

    await takeScreenshot(page, '03-after-tutorial');

    // Debug: Check current page content
    const pageText = await page.evaluate(() => document.body.innerText);
    const currentUrl = await page.url();
    console.log(`Current URL: ${currentUrl}`);
    console.log(`Page contains: ${pageText.substring(0, 200)}...`);

    // Check for all elements on page
    const allElements = await page.$$eval('button, a, input, textarea', els =>
      els.map(el => ({
        tag: el.tagName,
        text: el.textContent?.trim().substring(0, 50),
        type: el.type,
        id: el.id,
        className: el.className
      }))
    );
    console.log(`Found ${allElements.length} interactive elements:`, JSON.stringify(allElements.slice(0, 10), null, 2));

    // Generate Keys (the "Create Account" button on the account page)
    console.log('🔍 Looking for Create/Generate Account button...');
    const generateSelectors = [
      'text"Create Account"',
      'button.btn-primary.w-full',
      'button:has-text("Generate")',
      'button:has-text("Create Keys")',
      '[data-testid="generate-keys"]',
      'button.generate',
      'button[name="generate"]'
    ];

    const generateResult = await clickElement(page, generateSelectors);

    if (!generateResult.found) {
      const buttons = await page.$$eval('button, a', els =>
        els.map(el => ({ text: el.textContent?.trim(), id: el.id, className: el.className }))
      );

      errors.push({
        severity: 'CRITICAL',
        flow: 'Create Account',
        issue: 'Generate Keys button not found',
        availableButtons: buttons.filter(b => b.text),
        screenshot: await takeScreenshot(page, '03-generate-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    console.log(`✅ Clicked Generate Keys: ${generateResult.selector}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    await takeScreenshot(page, '04-keys-generated');

    // Find mnemonic
    console.log('🔍 Looking for mnemonic phrase...');
    const mnemonicSelectors = [
      'textarea',
      'input[type="text"]',
      '[data-testid="mnemonic"]',
      '.mnemonic',
      '.seed-phrase',
      'pre',
      'code'
    ];

    let mnemonicFound = false;
    for (const selector of mnemonicSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => {
            return el.value || el.textContent || el.innerText;
          }, element);

          if (text && text.split(/\s+/).length >= 12) {
            testMnemonic = text.trim();
            console.log(`✅ Found mnemonic (${text.split(/\s+/).length} words): ${text.substring(0, 50)}...`);
            mnemonicFound = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!mnemonicFound) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Create Account',
        issue: 'Mnemonic phrase not found or displayed',
        screenshot: await takeScreenshot(page, '04-mnemonic-not-found')
      });
    }

    // Continue/Confirm
    console.log('🔍 Looking for Continue/Confirm...');
    const continueSelectors = [
      'button:has-text("Continue")',
      'button:has-text("Confirm")',
      'button:has-text("Next")',
      'button:has-text("I understand")',
      '[data-testid="confirm"]'
    ];

    const continueResult = await clickElement(page, continueSelectors);

    if (continueResult.found) {
      console.log(`✅ Clicked Continue: ${continueResult.selector}`);
      await new Promise(resolve => setTimeout(resolve, 3000));
      await takeScreenshot(page, '05-after-continue');

      // Check for success
      const successSelectors = [
        'text/Welcome',
        'text/Success',
        '[data-testid="profile"]',
        'button:has-text("Post")',
        'button:has-text("Logout")'
      ];

      const successResult = await waitForSelector(page, successSelectors, 5000);

      if (successResult.found) {
        console.log(`✅ Account creation successful: ${successResult.selector}`);
      } else {
        errors.push({
          severity: 'HIGH',
          flow: 'Create Account',
          issue: 'No success indicator after account creation',
          screenshot: await takeScreenshot(page, '05-no-success')
        });
      }
    } else {
      errors.push({
        severity: 'HIGH',
        flow: 'Create Account',
        issue: 'Continue/Confirm button not found',
        screenshot: await takeScreenshot(page, '04-continue-not-found')
      });
    }

  } catch (error) {
    errors.push({
      severity: 'CRITICAL',
      flow: 'Create Account',
      issue: `Unexpected error: ${error.message}`,
      stack: error.stack,
      screenshot: await takeScreenshot(page, 'create-error')
    });
  } finally {
    try { await page.close(); } catch (e) { /* ignore close errors */ }
  }

  return errors;
}

async function testLoginFlow(browser) {
  console.log('\n🧪 TEST 2: Login Flow');
  console.log('='.repeat(60));

  if (!testMnemonic) {
    console.log('⚠️  No test mnemonic available - skipping login test');
    return [{
      severity: 'CRITICAL',
      flow: 'Login',
      issue: 'No test mnemonic from account creation - cannot test login'
    }];
  }

  const page = await browser.newPage();
  await page.setViewport(PIXEL_7_VIEWPORT);
  const errors = [];

  try {
    console.log('📱 Loading app for login...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '10-login-initial');

    // Find Login button
    console.log('🔍 Looking for Login button...');
    const loginSelectors = [
      'button:has-text("Login")',
      'a:has-text("Login")',
      'button:has-text("Sign In")',
      '[data-testid="login"]',
      'button.login'
    ];

    const loginResult = await clickElement(page, loginSelectors);

    if (!loginResult.found) {
      const buttons = await page.$$eval('button, a', els =>
        els.map(el => ({ text: el.textContent?.trim() }))
      );

      errors.push({
        severity: 'CRITICAL',
        flow: 'Login',
        issue: 'Login button not found',
        availableButtons: buttons.filter(b => b.text),
        screenshot: await takeScreenshot(page, '10-login-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    console.log(`✅ Clicked Login: ${loginResult.selector}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '11-login-form');

    // Enter mnemonic
    console.log('🔍 Looking for mnemonic input...');
    const inputSelectors = [
      'textarea',
      'input[type="text"]',
      '[data-testid="mnemonic-input"]',
      'input[name="mnemonic"]'
    ];

    let inputFound = false;
    for (const selector of inputSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          await element.type(testMnemonic, { delay: 10 });
          console.log(`✅ Entered mnemonic in: ${selector}`);
          inputFound = true;
          await takeScreenshot(page, '12-mnemonic-entered');
          break;
        }
      } catch (e) {
        continue;
      }
    }

    if (!inputFound) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Login',
        issue: 'Mnemonic input field not found',
        screenshot: await takeScreenshot(page, '11-input-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    // Submit login
    console.log('🔍 Looking for Submit button...');
    const submitSelectors = [
      'button:has-text("Login")',
      'button:has-text("Submit")',
      'button[type="submit"]',
      '[data-testid="submit"]'
    ];

    const submitResult = await clickElement(page, submitSelectors);

    if (!submitResult.found) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Login',
        issue: 'Submit button not found',
        screenshot: await takeScreenshot(page, '12-submit-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    console.log(`✅ Clicked Submit: ${submitResult.selector}`);
    await new Promise(resolve => setTimeout(resolve, 4000));
    await takeScreenshot(page, '13-after-login');

    // Verify success
    const successSelectors = [
      '[data-testid="profile"]',
      'button:has-text("Logout")',
      'button:has-text("Post")',
      'text/Welcome'
    ];

    const successResult = await waitForSelector(page, successSelectors, 5000);

    if (successResult.found) {
      console.log(`✅ Login successful: ${successResult.selector}`);
    } else {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Login',
        issue: 'Login failed - no success indicator',
        screenshot: await takeScreenshot(page, '13-login-failed')
      });
    }

  } catch (error) {
    errors.push({
      severity: 'CRITICAL',
      flow: 'Login',
      issue: `Unexpected error: ${error.message}`,
      stack: error.stack,
      screenshot: await takeScreenshot(page, 'login-error')
    });
  } finally {
    try { await page.close(); } catch (e) { /* ignore close errors */ }
  }

  return errors;
}

async function testKeyBackupFlow(browser) {
  console.log('\n🧪 TEST 3: Key Backup Flow');
  console.log('='.repeat(60));

  if (!testMnemonic) {
    console.log('⚠️  No test mnemonic - skipping backup test');
    return [{
      severity: 'HIGH',
      flow: 'Key Backup',
      issue: 'No test mnemonic available - cannot test backup flow'
    }];
  }

  const page = await browser.newPage();
  await page.setViewport(PIXEL_7_VIEWPORT);
  const errors = [];

  try {
    // Quick login first
    console.log('📱 Logging in for backup test...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(resolve => setTimeout(resolve, 2000));

    const loginBtn = await page.$('button:has-text("Login"), a:has-text("Login")');
    if (loginBtn) {
      await loginBtn.click();
      await new Promise(resolve => setTimeout(resolve, 1500));

      const input = await page.$('textarea, input[type="text"]');
      if (input) {
        await input.type(testMnemonic, { delay: 5 });
        await new Promise(resolve => setTimeout(resolve, 500));

        const submit = await page.$('button:has-text("Login"), button[type="submit"]');
        if (submit) {
          await submit.click();
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
      }
    }

    await takeScreenshot(page, '20-logged-in');

    // Find Profile/Settings
    console.log('🔍 Looking for Profile/Settings...');
    const profileSelectors = [
      '[data-testid="profile"]',
      'button:has-text("Profile")',
      'a:has-text("Profile")',
      'button:has-text("Settings")',
      '[data-testid="settings"]',
      'button[aria-label="Profile"]'
    ];

    const profileResult = await clickElement(page, profileSelectors);

    if (!profileResult.found) {
      const buttons = await page.$$eval('button, a', els =>
        els.map(el => ({ text: el.textContent?.trim(), id: el.id }))
      );

      errors.push({
        severity: 'HIGH',
        flow: 'Key Backup',
        issue: 'Profile/Settings not found',
        availableButtons: buttons.filter(b => b.text),
        screenshot: await takeScreenshot(page, '20-profile-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    console.log(`✅ Opened Profile: ${profileResult.selector}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '21-profile-page');

    // Find Backup option
    console.log('🔍 Looking for Backup/Export...');
    const backupSelectors = [
      'button:has-text("Backup")',
      'button:has-text("Export")',
      'button:has-text("Show Keys")',
      'button:has-text("Recovery")',
      '[data-testid="backup"]',
      '[data-testid="export-keys"]'
    ];

    const backupResult = await clickElement(page, backupSelectors);

    if (!backupResult.found) {
      const buttons = await page.$$eval('button', els =>
        els.map(el => ({ text: el.textContent?.trim() }))
      );

      errors.push({
        severity: 'HIGH',
        flow: 'Key Backup',
        issue: 'Backup/Export option not found',
        availableButtons: buttons.filter(b => b.text),
        screenshot: await takeScreenshot(page, '21-backup-not-found')
      });
      try { await page.close(); } catch (e) { /* ignore */ }
      return errors;
    }

    console.log(`✅ Clicked Backup: ${backupResult.selector}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await takeScreenshot(page, '22-backup-view');

    // Verify keys displayed
    console.log('🔍 Verifying keys displayed...');
    const keySelectors = [
      'textarea',
      '[data-testid="mnemonic"]',
      '.mnemonic',
      'pre',
      'code'
    ];

    let keysFound = false;
    for (const selector of keySelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          const text = await page.evaluate(el => {
            return el.value || el.textContent || el.innerText;
          }, element);

          if (text && text.length > 20) {
            console.log(`✅ Keys displayed: ${text.substring(0, 30)}...`);
            keysFound = true;
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }

    if (!keysFound) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Key Backup',
        issue: 'Keys not displayed in backup view',
        screenshot: await takeScreenshot(page, '22-keys-not-shown')
      });
    }

  } catch (error) {
    errors.push({
      severity: 'CRITICAL',
      flow: 'Key Backup',
      issue: `Unexpected error: ${error.message}`,
      stack: error.stack,
      screenshot: await takeScreenshot(page, 'backup-error')
    });
  } finally {
    try { await page.close(); } catch (e) { /* ignore close errors */ }
  }

  return errors;
}

async function main() {
  console.log('🚀 Mobile QE Testing - Nostr-BBS (Puppeteer)');
  console.log('Device: Pixel 7 (412x915)');
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security'
    ]
  });

  const allErrors = [];

  try {
    const createErrors = await testCreateAccountFlow(browser);
    allErrors.push(...createErrors);

    const loginErrors = await testLoginFlow(browser);
    allErrors.push(...loginErrors);

    const backupErrors = await testKeyBackupFlow(browser);
    allErrors.push(...backupErrors);

  } finally {
    await browser.close();
  }

  // Generate report
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS');
  console.log('='.repeat(60));

  if (allErrors.length === 0) {
    console.log('✅ ALL TESTS PASSED');
  } else {
    console.log(`❌ FOUND ${allErrors.length} ERRORS:\n`);

    const critical = allErrors.filter(e => e.severity === 'CRITICAL');
    const high = allErrors.filter(e => e.severity === 'HIGH');
    const medium = allErrors.filter(e => e.severity === 'MEDIUM');

    console.log(`🔴 CRITICAL: ${critical.length}`);
    console.log(`🟠 HIGH: ${high.length}`);
    console.log(`🟡 MEDIUM: ${medium.length}\n`);

    allErrors.forEach((error, index) => {
      console.log(`\n${index + 1}. [${error.severity}] ${error.flow}`);
      console.log(`   Issue: ${error.issue}`);
      if (error.availableButtons) {
        console.log(`   Available buttons: ${JSON.stringify(error.availableButtons.slice(0, 5))}`);
      }
      if (error.screenshot) {
        console.log(`   Screenshot: ${error.screenshot}`);
      }
    });
  }

  const critical = allErrors.filter(e => e.severity === 'CRITICAL');
  const high = allErrors.filter(e => e.severity === 'HIGH');
  const medium = allErrors.filter(e => e.severity === 'MEDIUM');

  const reportPath = '/tmp/qe-mobile-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    device: 'Pixel 7',
    viewport: PIXEL_7_VIEWPORT,
    baseUrl: BASE_URL,
    testMnemonicGenerated: !!testMnemonic,
    totalErrors: allErrors.length,
    errorsBySeverity: {
      critical: critical.length,
      high: high.length,
      medium: medium.length
    },
    errors: allErrors
  }, null, 2));

  console.log(`\n📄 Full report: ${reportPath}`);
  console.log('📸 Screenshots: /tmp/qe-mobile-*.png');
  console.log('='.repeat(60));

  process.exit(allErrors.length > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});
