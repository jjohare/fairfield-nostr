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

  console.log('=== EVENTS PAGES TEST ===');
  console.log('');

  // Test 1: Homepage
  console.log('TEST 1: Homepage');
  await page.goto('http://localhost:4173/fairfield-nostr/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const homeContent = await page.content();
  const homeOk = homeContent.indexOf('500') === -1 && homeContent.indexOf('Internal Error') === -1;
  console.log('  Homepage:', homeOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-pages-1-home.png', fullPage: true });

  // Test 2: Events page (public)
  console.log('');
  console.log('TEST 2: Events Page (public)');
  await page.goto('http://localhost:4173/fairfield-nostr/events', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const eventsContent = await page.content();
  const eventsOk = eventsContent.indexOf('500') === -1 && eventsContent.indexOf('Internal Error') === -1;
  console.log('  Events page:', eventsOk ? 'OK' : 'ERROR');

  // Check for Events header
  if (eventsContent.indexOf('Events') !== -1) {
    console.log('  - Events header: FOUND');
  }
  // Check for channel filter
  if (eventsContent.indexOf('Filter by Channel') !== -1) {
    console.log('  - Channel filter: FOUND');
  }
  // Check for view toggle
  if (eventsContent.indexOf('calendar') !== -1 || eventsContent.indexOf('Calendar') !== -1) {
    console.log('  - Calendar elements: FOUND');
  }
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-pages-2-events.png', fullPage: true });

  // Test 3: Admin Calendar page
  console.log('');
  console.log('TEST 3: Admin Calendar Page');
  await page.goto('http://localhost:4173/fairfield-nostr/admin/calendar', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const adminCalContent = await page.content();
  const adminCalOk = adminCalContent.indexOf('500') === -1 && adminCalContent.indexOf('Internal Error') === -1;
  console.log('  Admin calendar:', adminCalOk ? 'OK' : 'ERROR');

  // Check for Admin Calendar header
  if (adminCalContent.indexOf('Admin Calendar') !== -1) {
    console.log('  - Admin Calendar header: FOUND');
  }
  // Check for stats
  if (adminCalContent.indexOf('Total Events') !== -1 || adminCalContent.indexOf('Channels') !== -1) {
    console.log('  - Stats section: FOUND');
  }
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-pages-3-admin-calendar.png', fullPage: true });

  // Test 4: Admin page
  console.log('');
  console.log('TEST 4: Admin Dashboard');
  await page.goto('http://localhost:4173/fairfield-nostr/admin', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const adminContent = await page.content();
  const adminOk = adminContent.indexOf('500') === -1 && adminContent.indexOf('Internal Error') === -1;
  console.log('  Admin page:', adminOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-pages-4-admin.png', fullPage: true });

  // Test 5: Chat page
  console.log('');
  console.log('TEST 5: Chat Page');
  await page.goto('http://localhost:4173/fairfield-nostr/chat', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  const chatContent = await page.content();
  const chatOk = chatContent.indexOf('500') === -1 && chatContent.indexOf('Internal Error') === -1;
  console.log('  Chat page:', chatOk ? 'OK' : 'ERROR');
  await page.screenshot({ path: '/tmp/playwright-screenshots/events-pages-5-chat.png', fullPage: true });

  console.log('');
  console.log('=== TEST SUMMARY ===');
  const allPassed = homeOk && eventsOk && adminCalOk && adminOk && chatOk;
  console.log('All pages loaded without errors:', allPassed ? 'YES' : 'NO');
  console.log('JS Errors:', jsErrors.length === 0 ? 'None' : jsErrors.length + ' errors');
  if (jsErrors.length > 0) {
    jsErrors.slice(0, 5).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 150)));
  }

  await browser.close();
  console.log('');
  console.log('Screenshots saved to /tmp/playwright-screenshots/events-pages-*.png');
})();
