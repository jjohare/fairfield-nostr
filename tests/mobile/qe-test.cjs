const puppeteer = require('puppeteer');

const PIXEL_7 = {
  viewport: { width: 412, height: 915, deviceScaleFactor: 3.5, isMobile: true, hasTouch: true },
  userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runMobileTests() {
  console.log('Starting Mobile QE Tests - Post SvelteKit Sync');
  console.log('=' .repeat(60));

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport(PIXEL_7.viewport);
  await page.setUserAgent(PIXEL_7.userAgent);

  const errors = [];
  const results = { passed: 0, failed: 0, tests: [] };

  // Collect errors
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('service worker')) {
      errors.push({ type: 'console', text: msg.text() });
    }
  });
  page.on('pageerror', err => {
    errors.push({ type: 'page', text: err.message });
  });

  // Track network errors (500s, etc)
  page.on('response', response => {
    if (response.status() >= 500) {
      errors.push({ type: 'http', text: `${response.status()} ${response.url()}` });
    }
  });

  try {
    // Test 1: Homepage loads
    console.log('\n[TEST 1] Homepage loads correctly...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);

    const title = await page.title();
    const hasCreateAccount = await page.$('a.btn-primary') !== null;

    if (hasCreateAccount) {
      results.tests.push({ name: 'Homepage Load', status: 'PASS' });
      results.passed++;
      console.log('  ✓ Homepage loaded, Create Account button found');
    } else {
      results.tests.push({ name: 'Homepage Load', status: 'FAIL', reason: 'No Create Account button' });
      results.failed++;
      console.log('  ✗ Create Account button not found');
    }

    await page.screenshot({ path: '/tmp/qe-01-homepage.png', fullPage: true });

    // Test 2: Click Create Account
    console.log('\n[TEST 2] Create Account navigation...');
    await page.click('a.btn-primary');
    await sleep(2000);

    const currentUrl = page.url();
    await page.screenshot({ path: '/tmp/qe-02-after-create-click.png', fullPage: true });

    // Check for 500 error text
    const pageContent = await page.evaluate(() => document.body.innerText);
    if (pageContent.includes('500') && pageContent.includes('Error')) {
      results.tests.push({ name: 'Create Account Click', status: 'FAIL', reason: '500 Internal Error' });
      results.failed++;
      console.log('  ✗ 500 Internal Error detected');
    } else {
      results.tests.push({ name: 'Create Account Click', status: 'PASS' });
      results.passed++;
      console.log('  ✓ No 500 error, page navigated to:', currentUrl);
    }

    // Test 3: Skip Tutorial (if visible)
    console.log('\n[TEST 3] Tutorial handling...');
    const skipBtn = await page.$('button.btn-ghost');
    if (skipBtn) {
      const skipText = await page.evaluate(el => el.textContent, skipBtn);
      if (skipText && skipText.includes('Skip')) {
        await skipBtn.click();
        await sleep(1500);
        console.log('  ✓ Clicked Skip Tutorial');

        // Check again for 500 after skip
        const postSkipContent = await page.evaluate(() => document.body.innerText);
        await page.screenshot({ path: '/tmp/qe-03-after-tutorial.png', fullPage: true });

        if (postSkipContent.includes('500') && postSkipContent.includes('Error')) {
          results.tests.push({ name: 'Post-Tutorial Navigation', status: 'FAIL', reason: '500 Internal Error after tutorial' });
          results.failed++;
          console.log('  ✗ 500 Error after tutorial skip');
        } else {
          results.tests.push({ name: 'Post-Tutorial Navigation', status: 'PASS' });
          results.passed++;
          console.log('  ✓ Post-tutorial page loaded correctly');
        }
      }
    } else {
      console.log('  - No tutorial skip button found (may be direct navigation)');
      results.tests.push({ name: 'Tutorial Handling', status: 'SKIP' });
    }

    // Test 4: Check for account creation form
    console.log('\n[TEST 4] Account creation form...');
    const finalUrl = page.url();
    await page.screenshot({ path: '/tmp/qe-04-final-state.png', fullPage: true });

    // Look for key generation or mnemonic elements
    const formElements = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.textContent);
      const inputs = document.querySelectorAll('input').length;
      return { buttons, inputs };
    });

    console.log('  Page URL:', finalUrl);
    console.log('  Buttons found:', formElements.buttons.filter(b => b).join(', ') || 'none');
    console.log('  Input fields:', formElements.inputs);

    // Check final state
    const finalContent = await page.evaluate(() => document.body.innerText);
    if (finalContent.includes('500') && finalContent.includes('Error')) {
      results.tests.push({ name: 'Account Form Render', status: 'FAIL', reason: '500 error on page' });
      results.failed++;
    } else if (finalContent.includes('Generate') || finalContent.includes('mnemonic') || finalContent.includes('Create') || formElements.inputs > 0) {
      results.tests.push({ name: 'Account Form Render', status: 'PASS' });
      results.passed++;
      console.log('  ✓ Account creation form appears functional');
    } else {
      results.tests.push({ name: 'Account Form Render', status: 'WARN', reason: 'No obvious form elements' });
      console.log('  ⚠ Form elements not clearly visible');
    }

    // Test 5: Test /login route directly
    console.log('\n[TEST 5] Direct /login route test...');
    await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle0', timeout: 30000 });
    await sleep(2000);

    const loginContent = await page.evaluate(() => document.body.innerText);
    await page.screenshot({ path: '/tmp/qe-05-login-direct.png', fullPage: true });

    if (loginContent.includes('500') && loginContent.includes('Error')) {
      results.tests.push({ name: 'Direct /login Route', status: 'FAIL', reason: '500 Internal Error' });
      results.failed++;
      console.log('  ✗ /login route returns 500 error');
    } else {
      results.tests.push({ name: 'Direct /login Route', status: 'PASS' });
      results.passed++;
      console.log('  ✓ /login route loads correctly');
    }

  } catch (err) {
    console.error('Test execution error:', err.message);
    results.tests.push({ name: 'Execution', status: 'ERROR', reason: err.message });
    results.failed++;
  }

  await browser.close();

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Passed: ${results.passed}`);
  console.log(`Failed: ${results.failed}`);
  console.log('\nIndividual Results:');
  results.tests.forEach(t => {
    const icon = t.status === 'PASS' ? '✓' : t.status === 'FAIL' ? '✗' : '⚠';
    console.log(`  ${icon} ${t.name}: ${t.status}${t.reason ? ' - ' + t.reason : ''}`);
  });

  if (errors.length > 0) {
    console.log('\nErrors Collected:');
    errors.forEach(e => console.log(`  [${e.type}] ${e.text.substring(0, 100)}`));
  }

  // Write JSON report
  const report = { timestamp: new Date().toISOString(), results, errors };
  require('fs').writeFileSync('/tmp/qe-mobile-results.json', JSON.stringify(report, null, 2));
  console.log('\nDetailed report saved to /tmp/qe-mobile-results.json');
  console.log('Screenshots saved to /tmp/qe-*.png');

  process.exit(results.failed > 0 ? 1 : 0);
}

runMobileTests().catch(console.error);
