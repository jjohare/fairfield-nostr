import { chromium, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const SCREENSHOT_DIR = '/tmp';
const TEST_TIMEOUT = 60000;

// Test mnemonic for login testing (will be generated during account creation)
let testMnemonic = null;

async function takeScreenshot(page, name) {
  const screenshotPath = path.join(SCREENSHOT_DIR, `qe-mobile-${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`📸 Screenshot saved: ${screenshotPath}`);
  return screenshotPath;
}

async function waitForElement(page, selector, timeout = 10000) {
  try {
    await page.waitForSelector(selector, { timeout, state: 'visible' });
    return true;
  } catch (error) {
    console.error(`❌ Element not found: ${selector}`);
    return false;
  }
}

async function testCreateAccountFlow(browser) {
  console.log('\n🧪 TEST 1: Create Account Flow');
  console.log('='.repeat(60));

  const context = await browser.newContext(devices['Pixel 7']);
  const page = await context.newPage();
  const errors = [];

  try {
    // Navigate to app
    console.log('📱 Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await takeScreenshot(page, '01-initial-load');

    // Look for Create Account button
    console.log('🔍 Looking for Create Account button...');
    const createAccountSelectors = [
      'button:has-text("Create Account")',
      'a:has-text("Create Account")',
      '[data-testid="create-account"]',
      '.create-account',
      '#create-account'
    ];

    let createAccountFound = false;
    for (const selector of createAccountSelectors) {
      if (await waitForElement(page, selector, 3000)) {
        console.log(`✅ Found Create Account: ${selector}`);
        await page.click(selector);
        createAccountFound = true;
        break;
      }
    }

    if (!createAccountFound) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Create Account',
        issue: 'Create Account button not found',
        selectors: createAccountSelectors,
        screenshot: await takeScreenshot(page, '01-create-account-not-found')
      });
    } else {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '02-after-create-account-click');

      // Check for tutorial/onboarding
      console.log('🔍 Checking for tutorial/onboarding...');
      const tutorialSelectors = [
        'button:has-text("Skip")',
        'button:has-text("Next")',
        '[data-testid="skip-tutorial"]',
        '.tutorial-skip'
      ];

      for (const selector of tutorialSelectors) {
        if (await waitForElement(page, selector, 2000)) {
          console.log(`✅ Found tutorial element: ${selector}`);
          // Click skip or next multiple times to complete tutorial
          for (let i = 0; i < 5; i++) {
            try {
              const skipBtn = await page.$(selector);
              if (skipBtn) {
                await skipBtn.click();
                await page.waitForTimeout(500);
              }
            } catch (e) {
              break;
            }
          }
          break;
        }
      }

      await takeScreenshot(page, '03-after-tutorial');

      // Look for Generate Keys button
      console.log('🔍 Looking for Generate Keys button...');
      const generateKeySelectors = [
        'button:has-text("Generate")',
        'button:has-text("Generate Keys")',
        'button:has-text("Create Keys")',
        '[data-testid="generate-keys"]',
        '.generate-keys'
      ];

      let keysGenerated = false;
      for (const selector of generateKeySelectors) {
        if (await waitForElement(page, selector, 3000)) {
          console.log(`✅ Found Generate Keys: ${selector}`);
          await page.click(selector);
          keysGenerated = true;
          break;
        }
      }

      if (!keysGenerated) {
        errors.push({
          severity: 'CRITICAL',
          flow: 'Create Account',
          issue: 'Generate Keys button not found',
          selectors: generateKeySelectors,
          screenshot: await takeScreenshot(page, '03-generate-keys-not-found')
        });
      } else {
        await page.waitForTimeout(2000);
        await takeScreenshot(page, '04-after-generate-keys');

        // Look for mnemonic display
        console.log('🔍 Looking for mnemonic phrase...');
        const mnemonicSelectors = [
          '.mnemonic',
          '[data-testid="mnemonic"]',
          '.seed-phrase',
          '.recovery-phrase',
          'textarea',
          'input[type="text"]'
        ];

        let mnemonicFound = false;
        for (const selector of mnemonicSelectors) {
          const element = await page.$(selector);
          if (element) {
            const text = await element.textContent() || await element.inputValue();
            if (text && text.split(' ').length >= 12) {
              console.log(`✅ Found mnemonic: ${text.substring(0, 50)}...`);
              testMnemonic = text.trim();
              mnemonicFound = true;
              break;
            }
          }
        }

        if (!mnemonicFound) {
          errors.push({
            severity: 'CRITICAL',
            flow: 'Create Account',
            issue: 'Mnemonic phrase not displayed after key generation',
            selectors: mnemonicSelectors,
            screenshot: await takeScreenshot(page, '04-mnemonic-not-found')
          });
        }

        // Look for confirmation/continue button
        console.log('🔍 Looking for Continue/Confirm button...');
        const continueSelectors = [
          'button:has-text("Continue")',
          'button:has-text("Confirm")',
          'button:has-text("Next")',
          'button:has-text("I have saved")',
          '[data-testid="confirm-mnemonic"]'
        ];

        let confirmed = false;
        for (const selector of continueSelectors) {
          if (await waitForElement(page, selector, 3000)) {
            console.log(`✅ Found Continue button: ${selector}`);
            await page.click(selector);
            confirmed = true;
            break;
          }
        }

        if (!confirmed) {
          errors.push({
            severity: 'HIGH',
            flow: 'Create Account',
            issue: 'Continue/Confirm button not found after mnemonic display',
            selectors: continueSelectors,
            screenshot: await takeScreenshot(page, '05-continue-not-found')
          });
        } else {
          await page.waitForTimeout(2000);
          await takeScreenshot(page, '06-account-creation-complete');

          // Verify account creation success
          const successIndicators = [
            'text=Welcome',
            'text=Success',
            '[data-testid="profile"]',
            '.profile',
            'button:has-text("Post")',
            'button:has-text("Logout")'
          ];

          let successFound = false;
          for (const selector of successIndicators) {
            if (await waitForElement(page, selector, 3000)) {
              console.log(`✅ Account creation successful: ${selector}`);
              successFound = true;
              break;
            }
          }

          if (!successFound) {
            errors.push({
              severity: 'HIGH',
              flow: 'Create Account',
              issue: 'No success indicator found after account creation',
              selectors: successIndicators,
              screenshot: await takeScreenshot(page, '06-no-success-indicator')
            });
          }
        }
      }
    }

  } catch (error) {
    errors.push({
      severity: 'CRITICAL',
      flow: 'Create Account',
      issue: `Unexpected error: ${error.message}`,
      stack: error.stack,
      screenshot: await takeScreenshot(page, 'create-account-error')
    });
  } finally {
    await context.close();
  }

  return errors;
}

async function testLoginFlow(browser) {
  console.log('\n🧪 TEST 2: Login Flow');
  console.log('='.repeat(60));

  const context = await browser.newContext(devices['Pixel 7']);
  const page = await context.newPage();
  const errors = [];

  try {
    if (!testMnemonic) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Login',
        issue: 'No test mnemonic available from account creation',
        note: 'Login flow cannot be tested without valid mnemonic'
      });
      return errors;
    }

    console.log('📱 Navigating to app...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await takeScreenshot(page, '10-login-initial');

    // Look for Login button
    console.log('🔍 Looking for Login button...');
    const loginSelectors = [
      'button:has-text("Login")',
      'a:has-text("Login")',
      'button:has-text("Sign In")',
      '[data-testid="login"]',
      '.login'
    ];

    let loginFound = false;
    for (const selector of loginSelectors) {
      if (await waitForElement(page, selector, 3000)) {
        console.log(`✅ Found Login: ${selector}`);
        await page.click(selector);
        loginFound = true;
        break;
      }
    }

    if (!loginFound) {
      errors.push({
        severity: 'CRITICAL',
        flow: 'Login',
        issue: 'Login button not found',
        selectors: loginSelectors,
        screenshot: await takeScreenshot(page, '10-login-not-found')
      });
    } else {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '11-login-form');

      // Look for mnemonic input fields
      console.log('🔍 Looking for mnemonic input fields...');
      const mnemonicInputSelectors = [
        'textarea',
        'input[type="text"]',
        '[data-testid="mnemonic-input"]',
        '.mnemonic-input',
        '[placeholder*="mnemonic"]',
        '[placeholder*="seed"]'
      ];

      let inputFound = false;
      for (const selector of mnemonicInputSelectors) {
        const element = await page.$(selector);
        if (element) {
          console.log(`✅ Found mnemonic input: ${selector}`);
          await element.fill(testMnemonic);
          inputFound = true;
          await takeScreenshot(page, '12-mnemonic-entered');
          break;
        }
      }

      if (!inputFound) {
        errors.push({
          severity: 'CRITICAL',
          flow: 'Login',
          issue: 'Mnemonic input field not found',
          selectors: mnemonicInputSelectors,
          screenshot: await takeScreenshot(page, '11-input-not-found')
        });
      } else {
        // Look for submit button
        console.log('🔍 Looking for Submit/Login button...');
        const submitSelectors = [
          'button:has-text("Login")',
          'button:has-text("Submit")',
          'button:has-text("Sign In")',
          'button[type="submit"]',
          '[data-testid="submit-login"]'
        ];

        let submitted = false;
        for (const selector of submitSelectors) {
          if (await waitForElement(page, selector, 3000)) {
            console.log(`✅ Found Submit button: ${selector}`);
            await page.click(selector);
            submitted = true;
            break;
          }
        }

        if (!submitted) {
          errors.push({
            severity: 'CRITICAL',
            flow: 'Login',
            issue: 'Submit button not found on login form',
            selectors: submitSelectors,
            screenshot: await takeScreenshot(page, '12-submit-not-found')
          });
        } else {
          await page.waitForTimeout(3000);
          await takeScreenshot(page, '13-after-login');

          // Verify login success
          const successIndicators = [
            '[data-testid="profile"]',
            'button:has-text("Logout")',
            'button:has-text("Post")',
            '.profile',
            'text=Welcome'
          ];

          let loginSuccessful = false;
          for (const selector of successIndicators) {
            if (await waitForElement(page, selector, 5000)) {
              console.log(`✅ Login successful: ${selector}`);
              loginSuccessful = true;
              break;
            }
          }

          if (!loginSuccessful) {
            errors.push({
              severity: 'CRITICAL',
              flow: 'Login',
              issue: 'No success indicator found after login',
              selectors: successIndicators,
              screenshot: await takeScreenshot(page, '13-login-failed')
            });
          }
        }
      }
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
    await context.close();
  }

  return errors;
}

async function testKeyBackupFlow(browser) {
  console.log('\n🧪 TEST 3: Key Backup Flow');
  console.log('='.repeat(60));

  const context = await browser.newContext(devices['Pixel 7']);
  const page = await context.newPage();
  const errors = [];

  try {
    // First login
    console.log('📱 Logging in to test backup flow...');
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });

    // Quick login (assuming login works from previous test)
    const loginBtn = await page.$('button:has-text("Login")');
    if (loginBtn) {
      await loginBtn.click();
      await page.waitForTimeout(1000);

      const mnemonicInput = await page.$('textarea, input[type="text"]');
      if (mnemonicInput && testMnemonic) {
        await mnemonicInput.fill(testMnemonic);
        const submitBtn = await page.$('button:has-text("Login"), button[type="submit"]');
        if (submitBtn) {
          await submitBtn.click();
          await page.waitForTimeout(2000);
        }
      }
    }

    await takeScreenshot(page, '20-logged-in-for-backup');

    // Look for Profile/Settings
    console.log('🔍 Looking for Profile/Settings...');
    const profileSelectors = [
      '[data-testid="profile"]',
      'button:has-text("Profile")',
      'a:has-text("Profile")',
      '.profile',
      'button:has-text("Settings")',
      '[data-testid="settings"]'
    ];

    let profileFound = false;
    for (const selector of profileSelectors) {
      if (await waitForElement(page, selector, 3000)) {
        console.log(`✅ Found Profile: ${selector}`);
        await page.click(selector);
        profileFound = true;
        break;
      }
    }

    if (!profileFound) {
      errors.push({
        severity: 'HIGH',
        flow: 'Key Backup',
        issue: 'Profile/Settings button not found',
        selectors: profileSelectors,
        screenshot: await takeScreenshot(page, '20-profile-not-found')
      });
    } else {
      await page.waitForTimeout(1000);
      await takeScreenshot(page, '21-profile-page');

      // Look for Backup/Export Keys option
      console.log('🔍 Looking for Backup/Export Keys...');
      const backupSelectors = [
        'button:has-text("Backup")',
        'button:has-text("Export")',
        'button:has-text("Show Keys")',
        'button:has-text("Recovery")',
        '[data-testid="backup-keys"]',
        '[data-testid="export-keys"]'
      ];

      let backupFound = false;
      for (const selector of backupSelectors) {
        if (await waitForElement(page, selector, 3000)) {
          console.log(`✅ Found Backup option: ${selector}`);
          await page.click(selector);
          backupFound = true;
          break;
        }
      }

      if (!backupFound) {
        errors.push({
          severity: 'HIGH',
          flow: 'Key Backup',
          issue: 'Backup/Export Keys option not found in profile',
          selectors: backupSelectors,
          screenshot: await takeScreenshot(page, '21-backup-not-found')
        });
      } else {
        await page.waitForTimeout(1000);
        await takeScreenshot(page, '22-backup-page');

        // Verify mnemonic or keys are displayed
        console.log('🔍 Verifying keys are displayed...');
        const keyDisplaySelectors = [
          '.mnemonic',
          '[data-testid="mnemonic"]',
          'textarea',
          '.private-key',
          '.public-key'
        ];

        let keysDisplayed = false;
        for (const selector of keyDisplaySelectors) {
          const element = await page.$(selector);
          if (element) {
            const text = await element.textContent() || await element.inputValue();
            if (text && text.length > 20) {
              console.log(`✅ Keys displayed: ${text.substring(0, 30)}...`);
              keysDisplayed = true;
              break;
            }
          }
        }

        if (!keysDisplayed) {
          errors.push({
            severity: 'CRITICAL',
            flow: 'Key Backup',
            issue: 'Keys/mnemonic not displayed in backup view',
            selectors: keyDisplaySelectors,
            screenshot: await takeScreenshot(page, '22-keys-not-displayed')
          });
        }

        // Look for copy/download functionality
        const copySelectors = [
          'button:has-text("Copy")',
          'button:has-text("Download")',
          '[data-testid="copy-keys"]'
        ];

        let copyFound = false;
        for (const selector of copySelectors) {
          if (await waitForElement(page, selector, 2000)) {
            console.log(`✅ Found Copy/Download: ${selector}`);
            copyFound = true;
            break;
          }
        }

        if (!copyFound) {
          errors.push({
            severity: 'MEDIUM',
            flow: 'Key Backup',
            issue: 'Copy/Download button not found in backup view',
            selectors: copySelectors,
            screenshot: await takeScreenshot(page, '23-copy-not-found')
          });
        }
      }
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
    await context.close();
  }

  return errors;
}

async function runAllTests() {
  console.log('🚀 Starting Mobile QE Testing - Nostr-BBS');
  console.log('Device: Pixel 7');
  console.log('Base URL:', BASE_URL);
  console.log('='.repeat(60));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const allErrors = [];

  try {
    // Test 1: Create Account
    const createAccountErrors = await testCreateAccountFlow(browser);
    allErrors.push(...createAccountErrors);

    // Test 2: Login
    const loginErrors = await testLoginFlow(browser);
    allErrors.push(...loginErrors);

    // Test 3: Key Backup
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
    console.log('✅ ALL TESTS PASSED - No errors found!');
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
      if (error.selectors) {
        console.log(`   Tried selectors: ${error.selectors.join(', ')}`);
      }
      if (error.screenshot) {
        console.log(`   Screenshot: ${error.screenshot}`);
      }
      if (error.note) {
        console.log(`   Note: ${error.note}`);
      }
    });
  }

  // Save JSON report
  const reportPath = '/tmp/qe-mobile-report.json';
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    device: 'Pixel 7',
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

  console.log(`\n📄 Full report saved to: ${reportPath}`);
  console.log('='.repeat(60));

  process.exit(allErrors.length > 0 ? 1 : 0);
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
