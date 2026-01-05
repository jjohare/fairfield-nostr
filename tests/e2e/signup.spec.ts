/**
 * E2E Tests: User Signup Flow
 *
 * Tests the complete user signup process including:
 * - Account creation
 * - Mnemonic generation and display
 * - Mnemonic confirmation
 * - Key storage
 * - Redirect to pending approval
 */

import { test, expect } from '@playwright/test';

test.describe('User Signup Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('homepage loads successfully', async ({ page }) => {
    await page.goto('/');

    // Check page title (app uses "Minimembers Noir" display name)
    await expect(page).toHaveTitle(/Minimembers Noir/i);

    // Check main heading exists
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();

    // Check for create account button
    const createButton = page.getByRole('button', { name: /create account/i });
    await expect(createButton).toBeVisible();
  });

  test('create account generates mnemonic', async ({ page }) => {
    await page.goto('/');

    // Click create account button
    const createButton = page.getByRole('button', { name: /create account/i });
    await createButton.click();

    // Wait for mnemonic to be displayed
    await page.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 5000 });

    // Check that mnemonic is displayed
    const mnemonicDisplay = page.locator('[data-testid="mnemonic-display"]');
    await expect(mnemonicDisplay).toBeVisible();

    // Get mnemonic text
    const mnemonicText = await mnemonicDisplay.textContent();

    // Validate mnemonic format (12 words separated by spaces)
    const words = mnemonicText?.trim().split(/\s+/) || [];
    expect(words.length).toBe(12);

    // Check each word is non-empty
    words.forEach(word => {
      expect(word.length).toBeGreaterThan(0);
    });

    // Check for warning message
    const warningMessage = page.getByText(/write down these 12 words/i);
    await expect(warningMessage).toBeVisible();
  });

  test('copy mnemonic button works', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Get original mnemonic
    const mnemonicDisplay = page.locator('[data-testid="mnemonic-display"]');
    const originalMnemonic = await mnemonicDisplay.textContent();

    // Click copy button
    const copyButton = page.getByRole('button', { name: /copy/i });
    await copyButton.click();

    // Grant clipboard permissions
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

    // Verify clipboard content (using page.evaluate for clipboard access)
    const clipboardText = await page.evaluate(async () => {
      return await navigator.clipboard.readText();
    });

    expect(clipboardText).toBe(originalMnemonic?.trim());

    // Check for success feedback
    const successMessage = page.getByText(/copied/i);
    await expect(successMessage).toBeVisible({ timeout: 2000 });
  });

  test('checkbox enables continue button', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Find continue button
    const continueButton = page.getByRole('button', { name: /continue/i });

    // Button should be disabled initially
    await expect(continueButton).toBeDisabled();

    // Find and check the confirmation checkbox
    const checkbox = page.getByRole('checkbox', { name: /saved/i });
    await checkbox.check();

    // Button should now be enabled
    await expect(continueButton).toBeEnabled();
  });

  test('keys stored in localStorage after confirmation', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Confirm mnemonic saved
    await page.getByRole('checkbox', { name: /saved/i }).check();

    // Click continue
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for navigation
    await page.waitForTimeout(1000);

    // Check localStorage
    const storedKeys = await page.evaluate(() => {
      return {
        pubkey: localStorage.getItem('Nostr-BBS_nostr_pubkey'),
        encryptedPrivkey: localStorage.getItem('Nostr-BBS_nostr_encrypted_privkey'),
        mnemonicShown: localStorage.getItem('Nostr-BBS_nostr_mnemonic_shown')
      };
    });

    // Verify keys are stored
    expect(storedKeys.pubkey).toBeTruthy();
    expect(storedKeys.pubkey).toMatch(/^[0-9a-f]{64}$/i);

    expect(storedKeys.encryptedPrivkey).toBeTruthy();

    expect(storedKeys.mnemonicShown).toBe('true');
  });

  test('redirect to pending approval after signup', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Confirm and continue
    await page.getByRole('checkbox', { name: /saved/i }).check();
    await page.getByRole('button', { name: /continue/i }).click();

    // Wait for redirect
    await page.waitForURL(/pending|approval/i, { timeout: 5000 });

    // Check for pending approval message
    const pendingMessage = page.getByText(/pending approval|waiting for approval/i);
    await expect(pendingMessage).toBeVisible();

    // Check for admin contact information
    const contactInfo = page.getByText(/contact.*admin|administrator/i);
    await expect(contactInfo).toBeVisible();
  });

  test('cannot proceed without checking confirmation checkbox', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Try to click continue without checking box
    const continueButton = page.getByRole('button', { name: /continue/i });

    // Button should remain disabled
    await expect(continueButton).toBeDisabled();

    // Attempt to click (should not work)
    await continueButton.click({ force: true, timeout: 1000 }).catch(() => {});

    // Should still be on mnemonic page
    const mnemonicDisplay = page.locator('[data-testid="mnemonic-display"]');
    await expect(mnemonicDisplay).toBeVisible();
  });

  test('mnemonic words are all lowercase', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Get mnemonic text
    const mnemonicDisplay = page.locator('[data-testid="mnemonic-display"]');
    const mnemonicText = await mnemonicDisplay.textContent();

    // Check all words are lowercase
    expect(mnemonicText).toBe(mnemonicText?.toLowerCase());
  });

  test('generated keys are unique across sessions', async ({ page }) => {
    await page.goto('/');

    // Create first account
    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    const mnemonicDisplay = page.locator('[data-testid="mnemonic-display"]');
    const firstMnemonic = await mnemonicDisplay.textContent();

    // Reload page and create second account
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    await page.getByRole('button', { name: /create account/i }).click();
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    const secondMnemonic = await mnemonicDisplay.textContent();

    // Mnemonics should be different
    expect(firstMnemonic).not.toBe(secondMnemonic);
  });

  test('security warning is displayed prominently', async ({ page }) => {
    await page.goto('/');

    // Create account
    await page.getByRole('button', { name: /create account/i }).click();

    // Wait for mnemonic display
    await page.waitForSelector('[data-testid="mnemonic-display"]');

    // Check for security warnings
    const warnings = [
      /never share|do not share/i,
      /write down|save these words/i,
      /cannot be recovered|lost forever/i
    ];

    for (const warning of warnings) {
      const warningElement = page.getByText(warning);
      await expect(warningElement).toBeVisible();
    }
  });
});
