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

  console.log('=== PROFILE UPDATE TEST ===');
  console.log('Testing: https://jjohare.github.io/fairfield-nostr/');
  console.log('');

  // Step 1: Login with test mnemonic
  console.log('STEP 1: Login with test mnemonic');
  await page.goto('https://jjohare.github.io/fairfield-nostr/setup', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const textarea = await page.$('textarea');
  if (textarea) {
    await textarea.fill(testMnemonic);
    console.log('  - Filled mnemonic');
  } else {
    console.log('  - ERROR: No textarea found');
  }

  const restoreBtn = await page.$('button:has-text("Restore Account")');
  if (restoreBtn) {
    await restoreBtn.click();
    console.log('  - Clicked Restore');
    await page.waitForTimeout(4000);
  }
  await page.screenshot({ path: '/tmp/playwright-screenshots/profile-test-1-after-login.png', fullPage: true });

  // Step 2: Navigate to chat page (where profile button is)
  console.log('');
  console.log('STEP 2: Navigate to chat page');
  await page.goto('https://jjohare.github.io/fairfield-nostr/chat', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/playwright-screenshots/profile-test-2-chat.png', fullPage: true });

  // Step 3: Click Profile button
  console.log('');
  console.log('STEP 3: Open profile modal');
  const profileBtn = await page.$('button[title="Profile"]');
  if (profileBtn) {
    await profileBtn.click();
    console.log('  - Clicked Profile button');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/profile-test-3-modal-open.png', fullPage: true });
  } else {
    console.log('  - ERROR: Profile button not found');
    // List buttons to debug
    const buttons = await page.$$('button');
    console.log('  - Found', buttons.length, 'buttons');
    for (let i = 0; i < Math.min(buttons.length, 10); i++) {
      const text = await buttons[i].textContent();
      const title = await buttons[i].getAttribute('title');
      console.log('    ' + (i+1) + '. text:', text?.trim().substring(0, 30) || '(empty)', '| title:', title || '(none)');
    }
    await browser.close();
    return;
  }

  // Step 4: Test nickname input
  console.log('');
  console.log('STEP 4: Test nickname input');
  const nicknameInput = await page.$('input[placeholder="Enter a display name"]');
  if (nicknameInput) {
    await nicknameInput.fill('');
    await nicknameInput.fill('TestUserProfile');
    const nickVal = await nicknameInput.inputValue();
    console.log('  - Nickname value after fill:', nickVal);
    if (nickVal === 'TestUserProfile') {
      console.log('  - SUCCESS: Nickname input works!');
    } else {
      console.log('  - FAIL: Nickname value mismatch');
    }
  } else {
    console.log('  - ERROR: Nickname input not found');
  }

  // Step 5: Test avatar URL input
  console.log('');
  console.log('STEP 5: Test avatar URL input');
  const avatarInput = await page.$('input[type="url"]');
  if (avatarInput) {
    await avatarInput.fill('');
    await avatarInput.fill('https://i.pravatar.cc/150?u=test123');
    const avatarVal = await avatarInput.inputValue();
    console.log('  - Avatar value after fill:', avatarVal.substring(0, 40) + '...');
    if (avatarVal === 'https://i.pravatar.cc/150?u=test123') {
      console.log('  - SUCCESS: Avatar input works!');
    } else {
      console.log('  - FAIL: Avatar value mismatch');
    }
  } else {
    console.log('  - ERROR: Avatar input not found');
  }

  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/playwright-screenshots/profile-test-4-filled.png', fullPage: true });

  // Step 6: Click Save Profile
  console.log('');
  console.log('STEP 6: Save profile');
  const saveBtn = await page.$('button:has-text("Save Profile")');
  if (saveBtn) {
    await saveBtn.click();
    console.log('  - Clicked Save Profile');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/profile-test-5-after-save.png', fullPage: true });

    // Check if "Saved!" text appears
    const savedText = await page.$('button:has-text("Saved!")');
    if (savedText) {
      console.log('  - SUCCESS: Profile saved message appeared!');
    } else {
      console.log('  - Note: Save button may have already changed back');
    }
  } else {
    console.log('  - ERROR: Save Profile button not found');
  }

  // Step 7: Close and reopen modal to verify persistence
  console.log('');
  console.log('STEP 7: Verify persistence - close and reopen modal');

  // Close modal
  const closeBtn = await page.$('.modal-box button.btn-ghost:has-text("X")');
  if (closeBtn) {
    await closeBtn.click();
    await page.waitForTimeout(500);
  } else {
    // Click backdrop
    const backdrop = await page.$('.modal-backdrop');
    if (backdrop) {
      await backdrop.click();
      await page.waitForTimeout(500);
    }
  }

  // Reopen modal
  const profileBtn2 = await page.$('button[title="Profile"]');
  if (profileBtn2) {
    await profileBtn2.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/tmp/playwright-screenshots/profile-test-6-reopened.png', fullPage: true });

    // Check if values persisted
    const nicknameInput2 = await page.$('input[placeholder="Enter a display name"]');
    const avatarInput2 = await page.$('input[type="url"]');

    if (nicknameInput2) {
      const savedNick = await nicknameInput2.inputValue();
      console.log('  - Saved nickname:', savedNick);
      if (savedNick === 'TestUserProfile') {
        console.log('  - SUCCESS: Nickname persisted correctly!');
      } else {
        console.log('  - FAIL: Nickname did not persist');
      }
    }

    if (avatarInput2) {
      const savedAvatar = await avatarInput2.inputValue();
      console.log('  - Saved avatar:', savedAvatar.substring(0, 40) + '...');
      if (savedAvatar === 'https://i.pravatar.cc/150?u=test123') {
        console.log('  - SUCCESS: Avatar URL persisted correctly!');
      } else {
        console.log('  - FAIL: Avatar URL did not persist');
      }
    }
  }

  console.log('');
  console.log('=== JS ERRORS ===');
  if (jsErrors.length === 0) {
    console.log('No JS errors!');
  } else {
    jsErrors.slice(0, 5).forEach((e, i) => console.log('  ' + (i+1) + '. ' + e.substring(0, 200)));
  }

  await browser.close();
  console.log('');
  console.log('Test complete! Screenshots in /tmp/playwright-screenshots/profile-test-*.png');
})();
