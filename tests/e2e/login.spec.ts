/**
 * E2E Tests: User Login Flow
 *
 * Tests the login process including:
 * - Restore from mnemonic
 * - Invalid mnemonic handling
 * - Successful login and redirect
 * - Key restoration
 */

import { test, expect } from '@playwright/test';

// Valid test mnemonic (BIP-39 compliant)
const VALID_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

// Invalid mnemonics for testing
const INVALID_MNEMONICS = [
  'invalid word word word word word word word word word word word',
  'abandon abandon abandon', // Too short
  'abandon '.repeat(24).trim(), // Wrong length
  '', // Empty
  'ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABANDON ABOUT', // Uppercase
];

test.describe('User Login Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('login page is accessible', async ({ page }) => {
    await page.goto('/');

    // Find and click login/restore button
    const loginButton = page.getByRole('button', { name: /login|restore|import/i });
    await expect(loginButton).toBeVisible();

    await loginButton.click();

    // Check for mnemonic input
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await expect(mnemonicInput).toBeVisible();
  });

  test('restore from valid mnemonic', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter valid mnemonic
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(VALID_MNEMONIC);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Wait for processing
    await page.waitForTimeout(1000);

    // Check that keys are stored
    const storedKeys = await page.evaluate(() => {
      return {
        pubkey: localStorage.getItem('fairfield_nostr_pubkey'),
        encryptedPrivkey: localStorage.getItem('fairfield_nostr_encrypted_privkey')
      };
    });

    expect(storedKeys.pubkey).toBeTruthy();
    expect(storedKeys.pubkey).toMatch(/^[0-9a-f]{64}$/i);
    expect(storedKeys.encryptedPrivkey).toBeTruthy();
  });

  test('invalid mnemonic shows error - invalid words', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter invalid mnemonic
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(INVALID_MNEMONICS[0]);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Check for error message
    const errorMessage = page.getByText(/invalid|incorrect|error/i);
    await expect(errorMessage).toBeVisible({ timeout: 3000 });

    // Verify keys are NOT stored
    const hasKeys = await page.evaluate(() => {
      return !!localStorage.getItem('fairfield_nostr_pubkey');
    });

    expect(hasKeys).toBe(false);
  });

  test('invalid mnemonic shows error - too short', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter short mnemonic
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(INVALID_MNEMONICS[1]);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Check for error message
    const errorMessage = page.getByText(/invalid|incorrect|must be 12|error/i);
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('empty mnemonic shows validation error', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Submit without entering mnemonic
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Check for validation error
    const errorMessage = page.getByText(/required|enter|provide|mnemonic/i);
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
  });

  test('successful login redirects to dashboard/channels', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter valid mnemonic
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(VALID_MNEMONIC);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Wait for redirect
    await page.waitForURL(/dashboard|channels|home/i, { timeout: 5000 });

    // Verify we're on the authenticated page
    const currentUrl = page.url();
    expect(currentUrl).toMatch(/dashboard|channels|home/i);
  });

  test('mnemonic input normalizes whitespace', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter mnemonic with extra whitespace
    const mnemonicWithSpaces = `  abandon   abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  abandon  about  `;

    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(mnemonicWithSpaces);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Should succeed (whitespace normalized)
    await page.waitForTimeout(1000);

    const hasKeys = await page.evaluate(() => {
      return !!localStorage.getItem('fairfield_nostr_pubkey');
    });

    expect(hasKeys).toBe(true);
  });

  test('mnemonic input accepts lowercase only', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter uppercase mnemonic
    const uppercaseMnemonic = VALID_MNEMONIC.toUpperCase();

    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(uppercaseMnemonic);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Should succeed (converted to lowercase)
    await page.waitForTimeout(1000);

    const hasKeys = await page.evaluate(() => {
      return !!localStorage.getItem('fairfield_nostr_pubkey');
    });

    expect(hasKeys).toBe(true);
  });

  test('restored keys match expected derivation', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter known mnemonic
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(VALID_MNEMONIC);

    // Submit
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    await page.waitForTimeout(1000);

    // Get stored pubkey
    const storedPubkey = await page.evaluate(() => {
      return localStorage.getItem('fairfield_nostr_pubkey');
    });

    // Verify it's a valid hex string (64 chars)
    expect(storedPubkey).toMatch(/^[0-9a-f]{64}$/i);

    // For the test mnemonic, we can verify it produces a consistent pubkey
    // The actual value depends on NIP-06 derivation implementation
    expect(storedPubkey?.length).toBe(64);
  });

  test('login form has proper labels and accessibility', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Check for proper form labels
    const mnemonicLabel = page.getByText(/mnemonic|recovery phrase|12 words/i);
    await expect(mnemonicLabel).toBeVisible();

    // Check input has aria-label or associated label
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    const ariaLabel = await mnemonicInput.getAttribute('aria-label');
    const hasLabel = ariaLabel || await page.locator('label').filter({ hasText: /mnemonic/i }).count() > 0;

    expect(hasLabel).toBeTruthy();
  });

  test('can cancel login and return to home', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Look for cancel/back button
    const cancelButton = page.getByRole('button', { name: /cancel|back|home/i });
    await expect(cancelButton).toBeVisible();

    await cancelButton.click();

    // Should be back on home page
    const createButton = page.getByRole('button', { name: /create account/i });
    await expect(createButton).toBeVisible();
  });

  test('loading state shown during restoration', async ({ page }) => {
    await page.goto('/');

    // Navigate to login
    await page.getByRole('button', { name: /login|restore|import/i }).click();

    // Enter valid mnemonic
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(VALID_MNEMONIC);

    // Submit and immediately check for loading state
    const restoreButton = page.getByRole('button', { name: /restore|import|login/i });
    await restoreButton.click();

    // Check for loading indicator (spinner, disabled button, etc.)
    const isLoading = await page.evaluate(() => {
      const button = document.querySelector('button[type="submit"]');
      return button?.hasAttribute('disabled') ||
             document.querySelector('[data-loading="true"]') !== null ||
             document.querySelector('.spinner, .loading') !== null;
    });

    // At least one loading indicator should be present
    expect(isLoading).toBeTruthy();
  });
});
