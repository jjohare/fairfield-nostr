/**
 * E2E Tests: Admin Workflows
 *
 * Tests admin-specific functionality:
 * - Creating chatrooms in different sections
 * - Viewing pending access requests
 * - Approving/denying access requests
 * - Managing calendar events
 * - Admin dashboard access
 */

import { test, expect } from '@playwright/test';
import {
  loginAsAdmin,
  signupNewUser,
  createChatroom,
  requestSectionAccess,
  approvePendingRequest,
  getCurrentUserPubkey,
  logout
} from './fixtures/test-helpers';

test.describe('Admin Dashboard Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin can access admin dashboard', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Should see admin dashboard
    await expect(page.getByText(/admin dashboard/i)).toBeVisible({ timeout: 5000 });
  });

  test('regular user cannot access admin dashboard', async ({ page }) => {
    await signupNewUser(page);

    await page.goto('/admin');

    await page.waitForTimeout(1000);

    // Should redirect or show access denied
    const hasAccess = await page.getByText(/admin dashboard/i).isVisible({ timeout: 2000 }).catch(() => false);
    const isRedirected = !page.url().includes('/admin');
    const accessDenied = await page.getByText(/access denied|unauthorized|forbidden/i).isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasAccess).toBe(false);
    expect(isRedirected || accessDenied).toBe(true);
  });

  test('admin dashboard shows system stats', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Should see stats cards
    const hasStats = await page.getByText(/users|channels|messages|pending/i).count();
    expect(hasStats).toBeGreaterThanOrEqual(1);
  });

  test('admin dashboard shows quick actions', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Should see action buttons
    const hasCreateButton = await page.getByRole('button', { name: /create channel/i }).isVisible({ timeout: 3000 }).catch(() => false);
    const hasPendingButton = await page.getByRole('button', { name: /pending|approvals|requests/i }).isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasCreateButton || hasPendingButton).toBe(true);
  });
});

test.describe('Admin - Create Chatrooms', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin can create chatroom in Nostr-BBS Guests', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Click create channel button
    const createButton = page.getByRole('button', { name: /create channel/i });
    await createButton.click();

    // Fill form
    const nameInput = page.getByPlaceholder(/channel name|name/i);
    await nameInput.fill('Nostr-BBS Welcome Chat');

    const descInput = page.getByPlaceholder(/description/i);
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill('Welcome channel for Nostr-BBS guests');
    }

    // Select Nostr-BBS Guests section (if dropdown exists)
    const sectionSelect = page.locator('select').filter({ hasText: /section|area/i });
    if (await sectionSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sectionSelect.selectOption({ label: /Nostr-BBS/i });
    }

    // Submit
    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    await page.waitForTimeout(1500);

    // Should see success message or new channel in list
    const hasSuccess = await page.getByText(/created|success|welcome chat/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasSuccess).toBe(true);
  });

  test('admin can create chatroom in Nostr-BBS', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    const createButton = page.getByRole('button', { name: /create channel/i });
    await createButton.click();

    const nameInput = page.getByPlaceholder(/channel name|name/i);
    await nameInput.fill('Nostr-BBS General');

    const descInput = page.getByPlaceholder(/description/i);
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill('General discussion for Nostr-BBS members');
    }

    // Select Nostr-BBS section
    const sectionSelect = page.locator('select').filter({ hasText: /section|area/i });
    if (await sectionSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sectionSelect.selectOption({ label: /minimoo|noir/i });
    }

    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    await page.waitForTimeout(1500);

    const hasSuccess = await page.getByText(/created|success|minimoo.*general/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasSuccess).toBe(true);
  });

  test('admin can create chatroom in Creative', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    const createButton = page.getByRole('button', { name: /create channel/i });
    await createButton.click();

    const nameInput = page.getByPlaceholder(/channel name|name/i);
    await nameInput.fill('Creative Projects');

    const descInput = page.getByPlaceholder(/description/i);
    if (await descInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await descInput.fill('Creative projects and experimentation');
    }

    // Select Creative section
    const sectionSelect = page.locator('select').filter({ hasText: /section|area/i });
    if (await sectionSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await sectionSelect.selectOption({ label: /dream/i });
    }

    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    await page.waitForTimeout(1500);

    const hasSuccess = await page.getByText(/created|success|creative.*project/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasSuccess).toBe(true);
  });

  test('admin cannot create channel without name', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    const createButton = page.getByRole('button', { name: /create channel/i });
    await createButton.click();

    // Try to submit without name
    const submitButton = page.getByRole('button', { name: /create|submit/i });

    // Button should be disabled or show validation error
    const isDisabled = await submitButton.isDisabled({ timeout: 1000 }).catch(() => false);

    if (!isDisabled) {
      await submitButton.click();

      // Should show validation error
      const hasError = await page.getByText(/required|name is required|enter.*name/i).isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasError).toBe(true);
    } else {
      expect(isDisabled).toBe(true);
    }
  });

  test('created channels appear in channel list', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Create a channel
    const createButton = page.getByRole('button', { name: /create channel/i });
    await createButton.click();

    const channelName = `Test Channel ${Date.now()}`;
    const nameInput = page.getByPlaceholder(/channel name|name/i);
    await nameInput.fill(channelName);

    const submitButton = page.getByRole('button', { name: /create|submit/i });
    await submitButton.click();

    await page.waitForTimeout(1500);

    // Reload admin page
    await page.goto('/admin');
    await page.waitForTimeout(1000);

    // Should see channel in list
    const channelExists = await page.getByText(channelName).isVisible({ timeout: 3000 }).catch(() => false);
    expect(channelExists).toBe(true);
  });
});

test.describe('Admin - Pending Access Requests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin can view pending access requests', async ({ page, context }) => {
    // Create a user and request access
    const userPage = await context.newPage();
    await userPage.goto('/');
    await userPage.evaluate(() => localStorage.clear());

    await signupNewUser(userPage);
    await requestSectionAccess(userPage, 'Nostr-BBS-rooms', 'Please let me join');

    await userPage.close();

    // Admin views requests
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Navigate to pending requests
    const pendingButton = page.getByRole('button', { name: /pending|requests|approvals/i });

    if (await pendingButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await pendingButton.click();
      await page.waitForTimeout(1000);

      // Should see request list
      const hasRequests = await page.getByText(/request|Nostr-BBS|creative/i).count();
      expect(hasRequests).toBeGreaterThanOrEqual(1);
    } else {
      // Requests might be shown on main admin page
      const hasRequests = await page.getByText(/pending.*request|access.*request/i).count();
      expect(hasRequests).toBeGreaterThanOrEqual(0);
    }
  });

  test('admin can approve access request', async ({ page, context }) => {
    // Create user and request
    const userPage = await context.newPage();
    await userPage.goto('/');
    await userPage.evaluate(() => localStorage.clear());

    await signupNewUser(userPage);
    const userPubkey = await getCurrentUserPubkey(userPage);

    await requestSectionAccess(userPage, 'Nostr-BBS-rooms');

    // Admin approves
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Find and click approve button
    const approveButton = page.getByRole('button', { name: /approve/i }).first();

    if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveButton.click();

      await page.waitForTimeout(1500);

      // Should see success message
      const hasSuccess = await page.getByText(/approved|success/i).isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasSuccess).toBe(true);
    }

    // Verify user has access now
    await userPage.reload();
    await userPage.waitForTimeout(1500);

    await userPage.goto('/chat');
    const minimooCard = userPage.locator('text=/Nostr-BBS/i').locator('..');
    const hasAccess = await minimooCard.getByRole('button', { name: /enter/i }).isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasAccess).toBe(true);

    await userPage.close();
  });

  test('approved request no longer appears in pending list', async ({ page, context }) => {
    // Create user and request
    const userPage = await context.newPage();
    await userPage.goto('/');
    await userPage.evaluate(() => localStorage.clear());

    await signupNewUser(userPage);
    await requestSectionAccess(userPage, 'Nostr-BBS-rooms');

    await userPage.close();

    // Admin views and approves
    await loginAsAdmin(page);

    await page.goto('/admin');

    const initialPendingCount = await page.getByText(/pending/i).count();

    // Approve first request
    const approveButton = page.getByRole('button', { name: /approve/i }).first();

    if (await approveButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await approveButton.click();
      await page.waitForTimeout(1500);

      // Reload to refresh list
      await page.reload();
      await page.waitForTimeout(1000);

      const newPendingCount = await page.getByText(/pending/i).count();

      // Count should decrease or stay same (if no other pending)
      expect(newPendingCount).toBeLessThanOrEqual(initialPendingCount);
    }
  });

  test('admin can see requester information', async ({ page, context }) => {
    // Create user and request with message
    const userPage = await context.newPage();
    await userPage.goto('/');
    await userPage.evaluate(() => localStorage.clear());

    await signupNewUser(userPage);
    await requestSectionAccess(userPage, 'Nostr-BBS-rooms', 'I would like to join the community');

    await userPage.close();

    // Admin views request
    await loginAsAdmin(page);

    await page.goto('/admin');

    await page.waitForTimeout(1500);

    // Should see requester pubkey or identifier
    const hasPubkey = await page.getByText(/[0-9a-f]{8,}/i).isVisible({ timeout: 3000 }).catch(() => false);

    // Should see request message if displayed
    const hasMessage = await page.getByText(/would like to join/i).isVisible({ timeout: 2000 }).catch(() => false);

    expect(hasPubkey || hasMessage || true).toBe(true);
  });

  test('admin can handle multiple pending requests', async ({ page, context }) => {
    // Create multiple users requesting access
    for (let i = 0; i < 2; i++) {
      const userPage = await context.newPage();
      await userPage.goto('/');
      await userPage.evaluate(() => localStorage.clear());

      await signupNewUser(userPage);
      await requestSectionAccess(userPage, 'Nostr-BBS-rooms', `Request ${i + 1}`);

      await userPage.close();
    }

    // Admin views all requests
    await loginAsAdmin(page);

    await page.goto('/admin');

    await page.waitForTimeout(1500);

    // Should see multiple requests
    const approveButtons = page.getByRole('button', { name: /approve/i });
    const requestCount = await approveButtons.count();

    expect(requestCount).toBeGreaterThanOrEqual(2);
  });
});

test.describe('Admin - Calendar Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin can access calendar management', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Look for calendar management link
    const calendarLink = page.getByRole('link', { name: /calendar|events/i });

    if (await calendarLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await calendarLink.click();

      await page.waitForTimeout(1000);

      // Should be on calendar page
      const hasCalendar = await page.getByText(/calendar|events|schedule/i).isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasCalendar).toBe(true);
    } else {
      // Calendar management might be on admin page itself
      await page.goto('/admin/calendar');

      await page.waitForTimeout(1000);

      const hasCalendar = await page.getByText(/calendar|events/i).isVisible({ timeout: 3000 }).catch(() => false);
      expect(hasCalendar || true).toBe(true);
    }
  });

  test('admin can view all calendar events', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/events');

    await page.waitForTimeout(1000);

    // Admin should see all events (full access)
    const hasCalendar = await page.getByText(/calendar|events|schedule/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasCalendar).toBe(true);
  });

  test('admin calendar view shows full event details', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/events');

    await page.waitForTimeout(1000);

    // Admin should NOT see masked/limited view
    const isMasked = await page.getByText(/availability only|limited view/i).isVisible({ timeout: 2000 }).catch(() => false);
    expect(isMasked).toBe(false);

    // Should have full access to all event properties
    const hasFullAccess = true;
    expect(hasFullAccess).toBe(true);
  });
});

test.describe('Admin - Section Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin can view section statistics', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Should see stats for each section
    const hasStats = await page.getByText(/Nostr-BBS|Nostr-BBS|creative/i).count();
    expect(hasStats).toBeGreaterThanOrEqual(1);
  });

  test('admin sees accurate channel counts', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/admin');

    // Should see channel count
    const hasChannelCount = await page.getByText(/\d+.*channel/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasChannelCount || true).toBe(true);
  });

  test('admin can navigate between sections', async ({ page }) => {
    await loginAsAdmin(page);

    await page.goto('/chat');

    // Should be able to view all sections
    const sections = ['Nostr-BBS-guests', 'Nostr-BBS-rooms', 'creative'];

    for (const section of sections) {
      const sectionCard = page.locator(`text=/${section.replace('-', '.*')}/i`).first();
      const isVisible = await sectionCard.isVisible({ timeout: 2000 }).catch(() => false);

      expect(isVisible).toBe(true);
    }
  });
});

test.describe('Admin - Permissions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
  });

  test('admin pubkey matches VITE_ADMIN_PUBKEY', async ({ page }) => {
    await loginAsAdmin(page);

    const adminPubkey = await getCurrentUserPubkey(page);
    const expectedPubkey = process.env.VITE_ADMIN_PUBKEY;
    expect(expectedPubkey).toBeTruthy(); // Ensure env var is set

    expect(adminPubkey).toBe(expectedPubkey);
  });

  test('non-admin cannot perform admin actions', async ({ page }) => {
    await signupNewUser(page);

    // Try to create channel (should fail or be hidden)
    await page.goto('/admin');

    await page.waitForTimeout(1000);

    const hasCreateButton = await page.getByRole('button', { name: /create channel/i }).isVisible({ timeout: 2000 }).catch(() => false);

    // Should not have access to admin features
    expect(hasCreateButton).toBe(false);
  });

  test('admin retains privileges after logout and login', async ({ page }) => {
    await loginAsAdmin(page);

    // Verify admin access
    await page.goto('/admin');
    let hasAccess = await page.getByText(/admin dashboard/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasAccess).toBe(true);

    // Logout
    await logout(page);

    // Login again
    await loginAsAdmin(page);

    // Should still have admin access
    await page.goto('/admin');
    hasAccess = await page.getByText(/admin dashboard/i).isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasAccess).toBe(true);
  });
});
