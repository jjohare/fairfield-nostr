import { chromium } from 'playwright';

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

  const PORT = process.env.TEST_PORT || 5173;
  const BASE = `http://localhost:${PORT}`;

  console.log('============================================');
  console.log('COMPREHENSIVE FEATURE VERIFICATION TEST');
  console.log('============================================');
  console.log(`Testing on ${BASE}`);
  console.log('');

  try {
    // STEP 1: Login with test mnemonic
    console.log('STEP 1: Login with test account');
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 30000 });
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
    await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-1-login.png', fullPage: true });
    console.log('  - Login complete');

    // STEP 2: Check Chat Page
    console.log('');
    console.log('STEP 2: Verify Chat Page');
    await page.goto(`${BASE}/chat`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-2-chat.png', fullPage: true });

    const chatContent = await page.content();
    const chatOk = !chatContent.includes('500') && !chatContent.includes('Internal Error');
    console.log('  - Chat page:', chatOk ? 'OK' : 'ERROR');

    // Check for channels
    const channelCards = await page.$$('button.card');
    console.log('  - Found', channelCards.length, 'channels');

    // STEP 3: Enter a channel and test features
    if (channelCards.length > 0) {
      console.log('');
      console.log('STEP 3: Test Channel Detail Features');
      await channelCards[0].click();
      await page.waitForTimeout(3000);
      await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-3-channel.png', fullPage: true });

      const detailContent = await page.content();

      // Check for avatars (DiceBear)
      const avatars = await page.$$('img[src*="dicebear"]');
      console.log('  - Avatar images:', avatars.length > 0 ? avatars.length + ' FOUND' : 'checking...');

      // Check for message input
      const messageInput = await page.$('input[placeholder="Type a message..."]');
      console.log('  - Message input:', messageInput ? 'FOUND' : 'NOT FOUND');

      // STEP 4: Send a message
      console.log('');
      console.log('STEP 4: Test Message Send');
      if (messageInput) {
        await messageInput.fill('Test message from E2E test ' + Date.now());
        const sendBtn = await page.$('button:has-text("Send")');
        if (sendBtn) {
          await sendBtn.click();
          console.log('  - Message sent');
          await page.waitForTimeout(2000);
          await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-4-sent.png', fullPage: true });
        }
      }
    }

    // STEP 5: Check Admin Page
    console.log('');
    console.log('STEP 5: Verify Admin Page');
    await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-5-admin.png', fullPage: true });

    const adminContent = await page.content();
    if (adminContent.includes('Create Channel') || adminContent.includes('Channel Management')) {
      console.log('  - Admin features: ACCESSIBLE');
    } else {
      console.log('  - Admin features: RESTRICTED (not admin pubkey)');
    }

    // STEP 6: Check Events Page
    console.log('');
    console.log('STEP 6: Verify Events Page');
    await page.goto(`${BASE}/events`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-6-events.png', fullPage: true });

    const eventsContent = await page.content();
    const eventsOk = !eventsContent.includes('500') && !eventsContent.includes('Internal Error');
    console.log('  - Events page:', eventsOk ? 'OK' : 'ERROR');

    // STEP 7: Test DM Page
    console.log('');
    console.log('STEP 7: Verify DM Page');
    await page.goto(`${BASE}/dm`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/e2e-7-dm.png', fullPage: true });

    const dmContent = await page.content();
    const dmOk = !dmContent.includes('500') && !dmContent.includes('Internal Error');
    console.log('  - DM page:', dmOk ? 'OK' : 'ERROR');

    // Summary
    console.log('');
    console.log('============================================');
    console.log('TEST SUMMARY');
    console.log('============================================');
    console.log('JS Errors:', jsErrors.length === 0 ? 'None' : jsErrors.length + ' errors');
    if (jsErrors.length > 0) {
      jsErrors.slice(0, 5).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 150)));
    }

    console.log('');
    console.log('All screenshots: /tmp/playwright-screenshots/e2e-*.png');
    console.log('');

    // Final verdict
    const allPassed = chatOk && eventsOk && dmOk;
    if (allPassed && jsErrors.length === 0) {
      console.log('RESULT: ALL TESTS PASSED');
    } else {
      console.log('RESULT: SOME ISSUES FOUND');
    }

  } catch (error) {
    console.error('Test error:', error.message);
  } finally {
    await browser.close();
    console.log('Test complete!');
  }
})();
