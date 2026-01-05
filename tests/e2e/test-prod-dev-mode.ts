import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    errors.push('Page error: ' + err.message);
  });

  console.log('Testing production preview with ?dev...');

  // Test with ?dev parameter (local preview uses / not /Nostr-BBS/)
  await page.goto('http://localhost:4173/?dev', { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000);

  // Debug: Check page content and URL
  const url = page.url();
  console.log('Current URL: ' + url);
  console.log('Errors: ' + errors.length);
  errors.slice(0, 3).forEach(e => console.log('  - ' + e.substring(0, 100)));

  const content = await page.content();
  console.log('Page has Nostr BBS text: ' + content.includes('Nostr BBS'));
  console.log('Page has Development Mode text: ' + content.includes('Development Mode'));
  console.log('Page has Login as Admin text: ' + content.includes('Login as Admin'));

  // Check if dev mode card is visible
  const devCard = page.locator('text=Development Mode');
  const isVisible = await devCard.isVisible();
  console.log('Dev Mode card visible: ' + isVisible);

  const adminBtn = page.locator('button:has-text("Login as Admin")');
  const adminVisible = await adminBtn.isVisible();
  console.log('Admin button visible: ' + adminVisible);

  if (adminVisible) {
    console.log('SUCCESS: Dev mode works in production with ?dev parameter!');

    // Test the admin login
    await adminBtn.click();
    await page.waitForTimeout(3000);
    const url = page.url();
    console.log('After login, URL: ' + url);
    const loginSuccess = url.includes('/chat');
    console.log('Login successful: ' + loginSuccess);
  } else {
    console.log('FAIL: Dev mode not showing');
  }

  await browser.close();
})();
