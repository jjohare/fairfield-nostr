/**
 * E2E Test Helpers
 * Common utilities for Playwright tests
 */

import { Page, expect } from '@playwright/test';

/**
 * Test user credentials from .env
 */
export const ADMIN_CREDENTIALS = {
  pubkey: process.env.VITE_ADMIN_PUBKEY || 'REDACTED_PUBKEY',
  mnemonic: process.env.ADMIN_KEY || 'REDACTED_MNEMONIC'
};

/**
 * Generate a valid test mnemonic for regular users
 */
export function generateTestMnemonic(): string {
  // Use BIP-39 compliant test mnemonics
  const testMnemonics = [
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    'legal winner thank year wave sausage worth useful legal winner thank yellow',
    'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    'device into kiss venue type drift valve vendor hello kiss device abandon'
  ];

  return testMnemonics[Math.floor(Math.random() * testMnemonics.length)];
}

/**
 * Login as admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/');

  // Navigate to login/login page
  const loginButton = page.getByRole('link', { name: /login|setup/i });
  await loginButton.click();

  // Enter admin mnemonic
  const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
  await mnemonicInput.fill(ADMIN_CREDENTIALS.mnemonic);

  // Submit
  const restoreButton = page.getByRole('button', { name: /restore|import|login|continue/i });
  await restoreButton.click();

  // Wait for authentication to complete
  await page.waitForTimeout(2000);

  // Verify admin is logged in
  const pubkey = await page.evaluate(() => localStorage.getItem('minimoonoir_nostr_pubkey'));
  expect(pubkey).toBeTruthy();
}

/**
 * Login as regular user with generated or provided mnemonic
 */
export async function loginAsUser(page: Page, mnemonic?: string): Promise<string> {
  const userMnemonic = mnemonic || generateTestMnemonic();

  await page.goto('/');

  // Navigate to login/login page
  const loginButton = page.getByRole('link', { name: /login|setup/i });
  await loginButton.click();

  // Enter mnemonic
  const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
  await mnemonicInput.fill(userMnemonic);

  // Submit
  const restoreButton = page.getByRole('button', { name: /restore|import|login|continue/i });
  await restoreButton.click();

  // Wait for authentication
  await page.waitForTimeout(2000);

  return userMnemonic;
}

/**
 * Create a new account via signup flow
 */
export async function signupNewUser(page: Page): Promise<string> {
  await page.goto('/');

  // Click create account
  const createButton = page.getByRole('link', { name: /create account|signup/i });
  await createButton.click();

  // Wait for mnemonic generation
  await page.waitForSelector('[data-testid="mnemonic-display"]', { timeout: 5000 });

  // Get the generated mnemonic
  const mnemonicDisplay = page.locator('[data-testid="mnemonic-display"]');
  const mnemonic = await mnemonicDisplay.textContent();

  // Confirm mnemonic saved
  const checkbox = page.getByRole('checkbox', { name: /saved|written down/i });
  await checkbox.check();

  // Continue
  const continueButton = page.getByRole('button', { name: /continue/i });
  await continueButton.click();

  // Wait for redirect
  await page.waitForTimeout(1000);

  return mnemonic?.trim() || '';
}

/**
 * Navigate to a specific section
 */
export async function navigateToSection(page: Page, section: 'fairfield-guests' | 'minimoonoir-rooms' | 'dreamlab'): Promise<void> {
  // Ensure we're on chat page
  await page.goto('/chat');

  // Find and click section card
  const sectionNames: Record<string, RegExp> = {
    'fairfield-guests': /fairfield guests/i,
    'minimoonoir-rooms': /minimoonoir|minimoo noir/i,
    'dreamlab': /dreamlab|dream lab/i
  };

  const sectionCard = page.getByText(sectionNames[section]).first();
  await sectionCard.click();
}

/**
 * Request access to a section
 */
export async function requestSectionAccess(page: Page, section: 'minimoonoir-rooms' | 'dreamlab', message?: string): Promise<void> {
  // Click on section card
  await navigateToSection(page, section);

  // Click request access button
  const requestButton = page.getByRole('button', { name: /request access/i });
  await requestButton.click();

  // Fill optional message if provided
  if (message) {
    const messageInput = page.getByPlaceholder(/message|reason/i);
    if (await messageInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await messageInput.fill(message);
    }
  }

  // Confirm request
  const confirmButton = page.getByRole('button', { name: /send|submit|confirm/i });
  await confirmButton.click();

  // Wait for request to be submitted
  await page.waitForTimeout(1000);
}

/**
 * Approve a pending access request (admin only)
 */
export async function approvePendingRequest(page: Page, userPubkey: string): Promise<void> {
  // Navigate to admin page
  await page.goto('/admin');

  // Navigate to pending requests
  const pendingButton = page.getByRole('button', { name: /pending|approvals|requests/i });
  await pendingButton.click();

  // Wait for requests to load
  await page.waitForTimeout(1000);

  // Find and approve the specific request
  // (This may need adjustment based on actual UI implementation)
  const approveButtons = page.getByRole('button', { name: /approve/i });
  const count = await approveButtons.count();

  // Click first approve button (in real tests, filter by pubkey)
  if (count > 0) {
    await approveButtons.first().click();
    await page.waitForTimeout(1000);
  }
}

/**
 * Create a chatroom in a section (admin only)
 */
export async function createChatroom(page: Page, name: string, section: string, description?: string): Promise<void> {
  // Navigate to admin page
  await page.goto('/admin');

  // Click create channel button
  const createButton = page.getByRole('button', { name: /create channel/i });
  await createButton.click();

  // Fill channel name
  const nameInput = page.getByPlaceholder(/channel name/i);
  await nameInput.fill(name);

  // Fill description if provided
  if (description) {
    const descInput = page.getByPlaceholder(/description/i);
    await descInput.fill(description);
  }

  // Select section (if section selector exists)
  // This assumes a section dropdown exists in the create form
  const sectionSelect = page.locator('select[name="section"]');
  if (await sectionSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
    await sectionSelect.selectOption(section);
  }

  // Submit
  const submitButton = page.getByRole('button', { name: /create|submit/i });
  await submitButton.click();

  // Wait for channel creation
  await page.waitForTimeout(1500);
}

/**
 * Navigate to calendar page
 */
export async function navigateToCalendar(page: Page): Promise<void> {
  await page.goto('/events');
  await page.waitForTimeout(1000);
}

/**
 * Check if calendar event details are visible
 */
export async function canSeeEventDetails(page: Page, eventTitle: string): Promise<boolean> {
  await navigateToCalendar(page);

  // Look for event title
  const eventElement = page.getByText(eventTitle);
  const isVisible = await eventElement.isVisible({ timeout: 2000 }).catch(() => false);

  if (!isVisible) return false;

  // Click on event to see details
  await eventElement.click();
  await page.waitForTimeout(500);

  // Check if details are visible (description, location, etc.)
  const hasDescription = await page.getByText(/description|details/i).isVisible({ timeout: 1000 }).catch(() => false);
  const hasLocation = await page.getByText(/location/i).isVisible({ timeout: 1000 }).catch(() => false);

  return hasDescription || hasLocation;
}

/**
 * Check if calendar shows only availability (masked details)
 */
export async function showsOnlyAvailability(page: Page): Promise<boolean> {
  await navigateToCalendar(page);

  // Check for "booked" or "busy" indicators
  const hasAvailability = await page.getByText(/booked|busy|unavailable/i).isVisible({ timeout: 2000 }).catch(() => false);

  // Should NOT see detailed titles or descriptions
  const hasDetails = await page.locator('[data-event-title], [data-event-description]').isVisible({ timeout: 1000 }).catch(() => false);

  return hasAvailability && !hasDetails;
}

/**
 * Logout current user
 */
export async function logout(page: Page): Promise<void> {
  // Look for logout button (usually in settings or profile menu)
  const logoutButton = page.getByRole('button', { name: /logout|sign out/i });

  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
  } else {
    // Try navigating to settings first
    await page.goto('/settings');
    const settingsLogout = page.getByRole('button', { name: /logout|sign out/i });
    await settingsLogout.click();
  }

  await page.waitForTimeout(1000);

  // Clear localStorage
  await page.evaluate(() => localStorage.clear());
}

/**
 * Get current user's pubkey from localStorage
 */
export async function getCurrentUserPubkey(page: Page): Promise<string | null> {
  return await page.evaluate(() => localStorage.getItem('minimoonoir_nostr_pubkey'));
}

/**
 * Wait for Nostr connection
 */
export async function waitForNostrConnection(page: Page, timeout = 5000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Check if NDK is connected (this may vary based on implementation)
      return window.localStorage.getItem('minimoonoir_nostr_pubkey') !== null;
    },
    { timeout }
  );
}
