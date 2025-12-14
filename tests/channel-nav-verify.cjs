const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/usr/sbin/chromium',
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const jsErrors = [];
  page.on('pageerror', error => jsErrors.push(error.message));
  page.on('console', msg => {
    if (msg.type() === 'error') jsErrors.push(msg.text());
  });

  console.log('=== CHANNEL NAVIGATION FIX VERIFICATION ===');
  console.log('Testing noble packages selective alias fix');
  console.log('');

  // Step 1: Login with test mnemonic
  console.log('STEP 1: Login with test mnemonic');
  await page.goto('http://localhost:4350/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.fill(testMnemonic);
    console.log('  - Filled mnemonic');
  }

  const restoreBtn = await page.$('button:has-text("Restore Account")');
  if (restoreBtn) {
    await restoreBtn.click();
    console.log('  - Clicked Restore');
    await page.waitForTimeout(3000);
  }
  await page.screenshot({ path: '/tmp/playwright-screenshots/fresh-1-after-login.png', fullPage: true });

  // Step 2: Navigate to channels page
  console.log('');
  console.log('STEP 2: Navigate to Channels page');
  await page.goto('http://localhost:4350/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/tmp/playwright-screenshots/fresh-2-channels.png', fullPage: true });

  const chatContent = await page.content();
  const hasError = chatContent.includes('500') || chatContent.includes('Internal Error');
  console.log('  - Channels page status:', hasError ? 'ERROR' : 'OK');

  // Step 3: Click first channel
  const channelCards = await page.$$('button.card');
  console.log('  - Found', channelCards.length, 'channel cards');

  if (channelCards.length > 0) {
    console.log('');
    console.log('STEP 3: Click first channel');
    await channelCards[0].click();
    console.log('  - Clicked channel');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/fresh-3-channel-detail.png', fullPage: true });

    const detailUrl = page.url();
    console.log('  - URL:', detailUrl);

    const detailContent = await page.content();

    // Check page state
    const stillLoading = detailContent.includes('loading') && !detailContent.includes('Type a message');
    if (stillLoading) {
      console.log('  - ISSUE: Page shows infinite loading');
    } else if (detailContent.includes('Back to Channels') || detailContent.includes('Type a message')) {
      console.log('  - SUCCESS: Channel detail page loaded!');
    }
    if (detailContent.includes('Channel not found')) {
      console.log('  - ERROR: Channel not found');
    }
    if (detailContent.includes('No messages yet')) {
      console.log('  - Channel is empty');
    }
    if (detailContent.includes('Type a message')) {
      console.log('  - Message input present - page functional!');
    }
  }

  console.log('');
  console.log('=== JS ERRORS ===');
  const criticalErrors = jsErrors.filter(e =>
    e.includes('bytesToUtf8') ||
    e.includes('webcrypto') ||
    e.includes('noble/hashes') ||
    e.includes('noble/curves') ||
    e.includes('secp256k1') ||
    e.includes('export')
  );

  if (criticalErrors.length > 0) {
    console.log('CRITICAL MODULE ERRORS FOUND:');
    criticalErrors.forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 200)));
  } else if (jsErrors.length > 0) {
    console.log('Other JS errors (not related to noble packages):');
    jsErrors.slice(0, 5).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 150)));
  } else {
    console.log('No JS errors! Fix verified!');
  }

  await browser.close();
  console.log('');
  console.log('Test complete! Screenshots in /tmp/playwright-screenshots/fresh-*.png');
})();
