/**
 * E2E Tests: Messaging
 *
 * Tests messaging functionality with mock relay:
 * - Send messages
 * - Receive messages
 * - Delete own messages
 * - Message formatting
 */

import { test, expect } from '@playwright/test';
import { MockNostrRelay } from './fixtures/mock-relay';

// Test mnemonic
const TEST_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

let mockRelay: MockNostrRelay;

test.describe('Messaging with Mock Relay', () => {
  test.beforeAll(async () => {
    // Start mock relay before all tests
    mockRelay = new MockNostrRelay({
      port: 8081,
      requireAuth: false
    });

    await mockRelay.start();

    // Add test channel metadata
    mockRelay.addEvent({
      id: 'test-channel-1',
      pubkey: 'admin-pubkey-test',
      created_at: Math.floor(Date.now() / 1000),
      kind: 39000, // Group metadata
      tags: [
        ['d', 'test-channel-id'],
        ['cohort', 'business']
      ],
      content: JSON.stringify({
        name: 'Test Channel',
        about: 'A test channel for E2E testing',
        picture: ''
      }),
      sig: 'mock-sig'
    });
  });

  test.afterAll(async () => {
    // Stop mock relay after all tests
    if (mockRelay) {
      await mockRelay.stop();
    }
  });

  test.beforeEach(async ({ page }) => {
    // Clear events in mock relay
    mockRelay.clearEvents();

    // Re-add channel metadata
    mockRelay.addEvent({
      id: 'test-channel-1',
      pubkey: 'admin-pubkey-test',
      created_at: Math.floor(Date.now() / 1000),
      kind: 39000,
      tags: [
        ['d', 'test-channel-id'],
        ['cohort', 'business']
      ],
      content: JSON.stringify({
        name: 'Test Channel',
        about: 'A test channel for E2E testing'
      }),
      sig: 'mock-sig'
    });

    // Setup: Clear storage and configure mock relay
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());

    // Set relay URL to mock relay
    await page.evaluate(() => {
      localStorage.setItem('relay_url', 'ws://localhost:8081');
    });

    // Perform login
    await page.getByRole('button', { name: /login|restore|import/i }).click();
    const mnemonicInput = page.getByPlaceholder(/mnemonic|12 words|recovery phrase/i);
    await mnemonicInput.fill(TEST_MNEMONIC);
    await page.getByRole('button', { name: /restore|import|login/i }).click();

    // Wait for channels page
    await page.waitForURL(/dashboard|channels|home/i, { timeout: 5000 });
  });

  test('send message in channel', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Find message input
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);
      await expect(messageInput).toBeVisible();

      // Type message
      const testMessage = 'Hello from E2E test!';
      await messageInput.fill(testMessage);

      // Send message
      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // Wait for message to appear
      await page.waitForTimeout(1000);

      // Verify message appears in chat
      const sentMessage = page.getByText(testMessage);
      await expect(sentMessage).toBeVisible();

      // Verify message was sent to relay
      expect(mockRelay.getEventCount()).toBeGreaterThan(1);
    }
  });

  test('receive message from another user', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Simulate receiving a message from another user
      const incomingMessage = {
        id: 'incoming-msg-1',
        pubkey: 'other-user-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 9, // Group chat message
        tags: [
          ['h', 'test-channel-id']
        ],
        content: 'Hello from another user!',
        sig: 'mock-sig'
      };

      mockRelay.addEvent(incomingMessage);

      // Wait for message to appear
      await page.waitForTimeout(2000);

      // Check if message is displayed
      const receivedMessage = page.getByText('Hello from another user!');
      await expect(receivedMessage).toBeVisible();
    }
  });

  test('delete own message', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Send a message
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);
      const testMessage = 'Message to be deleted';
      await messageInput.fill(testMessage);

      const sendButton = page.getByRole('button', { name: /send/i });
      await sendButton.click();

      // Wait for message to appear
      await page.waitForTimeout(1000);

      // Find the message
      const sentMessage = page.getByText(testMessage);
      await expect(sentMessage).toBeVisible();

      // Hover to show actions
      await sentMessage.hover();

      // Click delete button
      const deleteButton = page.locator('[data-testid="delete-message"]').first();

      if (await deleteButton.count() > 0) {
        await deleteButton.click();

        // Confirm deletion if modal appears
        const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
        }

        // Wait for message to be removed
        await page.waitForTimeout(1000);

        // Verify message is gone
        await expect(sentMessage).not.toBeVisible();
      }
    }
  });

  test('cannot delete other users messages', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Add message from another user
      mockRelay.addEvent({
        id: 'other-msg-1',
        pubkey: 'different-user-pubkey',
        created_at: Math.floor(Date.now() / 1000),
        kind: 9,
        tags: [['h', 'test-channel-id']],
        content: 'Another users message',
        sig: 'mock-sig'
      });

      await page.waitForTimeout(1000);

      // Find the message
      const otherMessage = page.getByText('Another users message');

      if (await otherMessage.count() > 0) {
        await otherMessage.hover();

        // Delete button should not be present
        const deleteButton = otherMessage.locator('..').locator('[data-testid="delete-message"]');
        await expect(deleteButton).toHaveCount(0);
      }
    }
  });

  test('message timestamps display correctly', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Send a message
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);
      await messageInput.fill('Test timestamp');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForTimeout(1000);

      // Check for timestamp element
      const timestamp = page.locator('[data-testid="message-timestamp"]').first();

      if (await timestamp.count() > 0) {
        await expect(timestamp).toBeVisible();

        // Timestamp should contain time information
        const timestampText = await timestamp.textContent();
        expect(timestampText).toMatch(/\d{1,2}:\d{2}|ago|AM|PM/i);
      }
    }
  });

  test('messages scroll to bottom on new message', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Send multiple messages to create scroll
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);

      for (let i = 0; i < 5; i++) {
        await messageInput.fill(`Test message ${i}`);
        await page.getByRole('button', { name: /send/i }).click();
        await page.waitForTimeout(300);
      }

      // Check scroll position
      const messageContainer = page.locator('[data-testid="messages-container"]');

      if (await messageContainer.count() > 0) {
        const scrollTop = await messageContainer.evaluate(el => el.scrollTop);
        const scrollHeight = await messageContainer.evaluate(el => el.scrollHeight);
        const clientHeight = await messageContainer.evaluate(el => el.clientHeight);

        // Should be scrolled near bottom (within 100px tolerance)
        expect(scrollTop + clientHeight).toBeGreaterThanOrEqual(scrollHeight - 100);
      }
    }
  });

  test('message input clears after sending', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Send a message
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);
      await messageInput.fill('Test message');
      await page.getByRole('button', { name: /send/i }).click();

      await page.waitForTimeout(500);

      // Input should be empty
      const inputValue = await messageInput.inputValue();
      expect(inputValue).toBe('');
    }
  });

  test('send button disabled for empty messages', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Send button should be disabled when input is empty
      const sendButton = page.getByRole('button', { name: /send/i });
      await expect(sendButton).toBeDisabled();

      // Type something
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);
      await messageInput.fill('Test');

      // Button should now be enabled
      await expect(sendButton).toBeEnabled();

      // Clear input
      await messageInput.clear();

      // Button should be disabled again
      await expect(sendButton).toBeDisabled();
    }
  });

  test('enter key sends message', async ({ page }) => {
    // Navigate to a channel
    await page.waitForSelector('[data-testid="channel-list"]', { timeout: 5000 });

    const memberChannel = page.locator('[data-testid="channel-item"][data-is-member="true"]').first();

    if (await memberChannel.count() > 0) {
      await memberChannel.getByRole('button', { name: /open|view|enter/i }).click();

      // Wait for channel view
      await page.waitForSelector('[data-testid="channel-view"]', { timeout: 5000 });

      // Type message and press Enter
      const messageInput = page.getByPlaceholder(/type.*message|enter message/i);
      const testMessage = 'Sent with Enter key';
      await messageInput.fill(testMessage);
      await messageInput.press('Enter');

      await page.waitForTimeout(1000);

      // Message should appear
      const sentMessage = page.getByText(testMessage);
      await expect(sentMessage).toBeVisible();
    }
  });
});
