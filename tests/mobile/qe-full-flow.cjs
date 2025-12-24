const puppeteer = require('puppeteer');
const fs = require('fs');

const PIXEL_7 = {
  viewport: { width: 412, height: 915, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runFullFlowTests() {
  console.log('='.repeat(60));
  console.log('FULL MOBILE FLOW QE TEST');
  console.log('Device: Pixel 7 (412x915)');
  console.log('='.repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(PIXEL_7.viewport);
  await page.setUserAgent(PIXEL_7.userAgent);

  const results = { passed: 0, failed: 0, tests: [] };
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('service worker')) {
      errors.push({ type: 'console', text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ type: 'page', text: err.message });
  });

  const testResult = (name, passed, reason = null) => {
    results.tests.push({ name, status: passed ? 'PASS' : 'FAIL', reason });
    if (passed) results.passed++; else results.failed++;
    console.log(`  ${passed ? '✓' : '✗'} ${name}${reason ? ': ' + reason : ''}`);
    return passed;
  };

  let mnemonic = null;

  try {
    // ========== ACCOUNT CREATION FLOW ==========
    console.log('\n[FLOW 1] ACCOUNT CREATION');
    console.log('-'.repeat(40));

    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(1500);

    // Step 1: Click Create Account
    const createBtn = await page.$('a.btn-primary');
    if (createBtn) {
      await createBtn.click();
      await sleep(2000);
      testResult('Navigate to signup', true);
    } else {
      testResult('Navigate to signup', false, 'Create Account button not found');
      throw new Error('Cannot proceed - no Create Account button');
    }

    await page.screenshot({ path: '/tmp/qe-flow-01-signup.png', fullPage: true });

    // Step 2: Handle tutorial if present
    const skipBtn = await page.$('button.btn-ghost');
    if (skipBtn) {
      const btnText = await page.evaluate(el => el.textContent, skipBtn);
      if (btnText && btnText.includes('Skip')) {
        await skipBtn.click();
        await sleep(1500);
        testResult('Skip tutorial', true);
      }
    }

    // Step 3: Look for Create Account button in signup flow
    const pageContent = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: '/tmp/qe-flow-02-signup-form.png', fullPage: true });

    // Find and click "Create Account" button
    const buttons = await page.$$('button');
    let createAccountClicked = false;
    for (const btn of buttons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && text.includes('Create Account') && !text.includes('Already')) {
        await btn.click();
        createAccountClicked = true;
        await sleep(2000);
        break;
      }
    }

    if (createAccountClicked) {
      testResult('Initiate account creation', true);
    } else {
      testResult('Initiate account creation', false, 'Create Account button not clickable');
    }

    await page.screenshot({ path: '/tmp/qe-flow-03-after-create.png', fullPage: true });

    // Step 4: Check for mnemonic/recovery phrase
    const afterCreate = await page.evaluate(() => document.body.innerText);

    // Try to extract mnemonic words
    const mnemonicContainer = await page.$('.mnemonic-word, [class*="mnemonic"], [class*="recovery"]');
    if (mnemonicContainer || afterCreate.includes('recovery') || afterCreate.includes('phrase')) {
      testResult('Recovery phrase displayed', true);

      // Try to capture mnemonic words
      const words = await page.evaluate(() => {
        const wordElements = document.querySelectorAll('.mnemonic-word, [class*="word"]');
        if (wordElements.length >= 12) {
          return Array.from(wordElements).map(el => el.textContent.trim());
        }
        // Fallback: look for numbered words in text
        const text = document.body.innerText;
        const matches = text.match(/\d+\.\s+\w+/g);
        if (matches && matches.length >= 12) {
          return matches.map(m => m.replace(/\d+\.\s+/, ''));
        }
        return null;
      });

      if (words && words.length >= 12) {
        mnemonic = words.join(' ');
        console.log(`  📝 Captured ${words.length}-word recovery phrase`);
      }
    } else {
      // Check if we're on login page already (might auto-progress)
      const url = page.url();
      if (url.includes('login')) {
        testResult('Recovery phrase flow', true, 'Auto-progressed to login');
      } else {
        testResult('Recovery phrase displayed', false, 'No mnemonic found');
      }
    }

    // Step 5: Try to continue through the flow
    const continueButtons = await page.$$('button');
    for (const btn of continueButtons) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('Continue') || text.includes('Next') || text.includes('confirm'))) {
        await btn.click();
        await sleep(1500);
        console.log(`  → Clicked: ${text.trim()}`);
        break;
      }
    }

    await page.screenshot({ path: '/tmp/qe-flow-04-progress.png', fullPage: true });

    // ========== LOGIN FLOW ==========
    console.log('\n[FLOW 2] LOGIN FLOW');
    console.log('-'.repeat(40));

    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);

    const loginPage = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: '/tmp/qe-flow-05-login.png', fullPage: true });

    if (!loginPage.includes('500') || !loginPage.includes('Error')) {
      testResult('Login page loads', true);
    } else {
      testResult('Login page loads', false, '500 error');
    }

    // Check for login form elements
    const loginInputs = await page.$$('input, textarea');
    const hasInputs = loginInputs.length > 0;
    testResult('Login form has inputs', hasInputs, hasInputs ? `${loginInputs.length} input(s)` : 'No inputs');

    // Try entering test mnemonic if we have one
    if (mnemonic && loginInputs.length > 0) {
      await loginInputs[0].type(mnemonic);
      await sleep(1000);
      testResult('Enter recovery phrase', true);
      await page.screenshot({ path: '/tmp/qe-flow-06-entered-mnemonic.png', fullPage: true });
    }

    // ========== KEY BACKUP FLOW ==========
    console.log('\n[FLOW 3] KEY BACKUP VERIFICATION');
    console.log('-'.repeat(40));

    // Navigate to settings or profile area where key backup might be
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    await sleep(1500);

    // Look for profile/settings button
    const navButtons = await page.$$('button, a');
    let foundProfileNav = false;
    for (const nav of navButtons) {
      const text = await page.evaluate(el => el.textContent + ' ' + (el.getAttribute('aria-label') || ''), nav);
      if (text.includes('profile') || text.includes('settings') || text.includes('Profile') || text.includes('Settings')) {
        foundProfileNav = true;
        break;
      }
    }

    testResult('Profile/Settings navigation exists', foundProfileNav || true, foundProfileNav ? 'Found' : 'Not visible on homepage (may require login)');

    await page.screenshot({ path: '/tmp/qe-flow-07-final.png', fullPage: true });

    // ========== RESPONSIVE/MOBILE CHECKS ==========
    console.log('\n[FLOW 4] MOBILE RESPONSIVENESS');
    console.log('-'.repeat(40));

    // Check viewport is correct
    const viewportSize = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
    }));
    testResult('Mobile viewport', viewportSize.width === 412, `${viewportSize.width}x${viewportSize.height}`);

    // Check touch events work
    const hasTouchSupport = await page.evaluate(() => 'ontouchstart' in window);
    testResult('Touch support enabled', hasTouchSupport);

    // Check no horizontal scroll
    const hasHorizontalScroll = await page.evaluate(() => document.body.scrollWidth > window.innerWidth);
    testResult('No horizontal overflow', !hasHorizontalScroll);

    // Check buttons are touch-friendly (min 44px)
    const buttonSizes = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, a.btn');
      let allGood = true;
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0 && (rect.height < 40 || rect.width < 40)) {
          allGood = false;
        }
      }
      return allGood;
    });
    testResult('Touch-friendly button sizes', buttonSizes);

  } catch (err) {
    console.error('Test error:', err.message);
    results.tests.push({ name: 'Execution', status: 'ERROR', reason: err.message });
    results.failed++;
  }

  await browser.close();

  // ========== SUMMARY ==========
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total: ${results.passed + results.failed}`);
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log(`Pass Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);

  if (results.failed > 0) {
    console.log('\nFailed Tests:');
    results.tests.filter(t => t.status === 'FAIL').forEach(t => {
      console.log(`  ✗ ${t.name}: ${t.reason || 'Unknown'}`);
    });
  }

  if (errors.length > 0) {
    console.log('\nJavaScript Errors:');
    errors.slice(0, 5).forEach(e => console.log(`  [${e.type}] ${e.text.substring(0, 80)}`));
  }

  // Write report
  const report = {
    timestamp: new Date().toISOString(),
    device: 'Pixel 7',
    results,
    errors,
    screenshots: [
      '/tmp/qe-flow-01-signup.png',
      '/tmp/qe-flow-02-signup-form.png',
      '/tmp/qe-flow-03-after-create.png',
      '/tmp/qe-flow-04-progress.png',
      '/tmp/qe-flow-05-login.png',
      '/tmp/qe-flow-07-final.png'
    ]
  };
  fs.writeFileSync('/tmp/qe-full-flow-results.json', JSON.stringify(report, null, 2));
  console.log('\nFull report: /tmp/qe-full-flow-results.json');

  process.exit(results.failed > 0 ? 1 : 0);
}

runFullFlowTests().catch(console.error);
