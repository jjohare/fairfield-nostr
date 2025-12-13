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

  console.log('============================================');
  console.log('EVENTS PAGES & CALENDAR TEST');
  console.log('============================================');
  console.log('');

  // Test 1: Homepage
  console.log('TEST 1: Homepage');
  await page.goto('http://localhost:4700/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const homeContent = await page.content();
  const homeOk = !homeContent.includes('500') && !homeContent.includes('Internal Error');
  console.log('  Result:', homeOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-1-home.png', fullPage: true });

  // Test 2: Signup page
  console.log('');
  console.log('TEST 2: Signup and Login');
  await page.goto('http://localhost:4700/signup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const signupContent = await page.content();
  const signupOk = !signupContent.includes('500');
  console.log('  Signup page:', signupOk ? 'OK' : 'ERROR');

  // Create account
  const createBtn = await page.$('button:has-text("Create Account")');
  if (createBtn) {
    await createBtn.click();
    console.log('  Creating account...');
    await page.waitForTimeout(3000);

    const continueBtn = await page.$('button:has-text("Continue")');
    if (continueBtn) {
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }
  }
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-2-signup.png', fullPage: true });

  // Test 3: Events Page
  console.log('');
  console.log('TEST 3: Events Page');
  await page.goto('http://localhost:4700/events', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const eventsContent = await page.content();
  const eventsOk = !eventsContent.includes('500') && !eventsContent.includes('Internal Error');
  console.log('  Events page:', eventsOk ? 'OK' : 'ERROR');

  // Check for calendar component
  if (eventsContent.includes('Events') || eventsContent.includes('calendar')) {
    console.log('  - Events header found');
  }
  if (eventsContent.includes('Filter by Channel')) {
    console.log('  - Channel filter sidebar found');
  }
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-3-events-page.png', fullPage: true });

  // Test 4: Admin Calendar Page
  console.log('');
  console.log('TEST 4: Admin Calendar Page');
  await page.goto('http://localhost:4700/admin/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const adminCalContent = await page.content();
  const adminCalOk = !adminCalContent.includes('500') && !adminCalContent.includes('Internal Error');
  console.log('  Admin calendar:', adminCalOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-4-admin-calendar.png', fullPage: true });

  // Test 5: Chat page (for comparison)
  console.log('');
  console.log('TEST 5: Chat Page');
  await page.goto('http://localhost:4700/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);
  const chatContent = await page.content();
  const chatOk = !chatContent.includes('500') && !chatContent.includes('Internal Error');
  console.log('  Chat page:', chatOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-5-chat.png', fullPage: true });

  // Test 6: Admin page
  console.log('');
  console.log('TEST 6: Admin Dashboard');
  await page.goto('http://localhost:4700/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const adminContent = await page.content();
  const adminOk = !adminContent.includes('500') && !adminContent.includes('Internal Error');
  console.log('  Admin page:', adminOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-6-admin.png', fullPage: true });

  console.log('');
  console.log('============================================');
  console.log('TEST SUMMARY');
  console.log('============================================');
  console.log('JS Errors:', jsErrors.length === 0 ? 'None' : jsErrors.length + ' errors');
  if (jsErrors.length > 0) {
    jsErrors.slice(0, 10).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 150)));
  }

  console.log('');
  console.log('All pages tested. Check /tmp/playwright-screenshots/events-*.png');

  await browser.close();
})();
