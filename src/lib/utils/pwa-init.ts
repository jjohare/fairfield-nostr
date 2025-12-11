/**
 * PWA initialization utilities
 * Call from app initialization
 */

import {
  initPWA,
  registerServiceWorker,
  getQueuedMessages,
  isOnline,
  triggerBackgroundSync
} from '../stores/pwa';
import { get } from 'svelte/store';

/**
 * Initialize PWA features
 * Should be called from main app component on mount
 */
export async function initializePWA(): Promise<void> {
  if (typeof window === 'undefined') {
    return;
  }

  // Initialize PWA event listeners
  initPWA();

  // Register service worker
  const registration = await registerServiceWorker();

  if (registration) {
    console.log('[PWA] Service worker registered successfully');

    // Check for queued messages
    try {
      const messages = await getQueuedMessages();

      if (messages.length > 0) {
        console.log(`[PWA] Found ${messages.length} queued messages`);

        // Trigger sync if online
        if (get(isOnline)) {
          await triggerBackgroundSync();
        }
      }
    } catch (error) {
      console.error('[PWA] Failed to check message queue:', error);
    }
  }
}

/**
 * Handle send message with offline support
 * Queue message if offline, send immediately if online
 */
export async function sendMessageWithOfflineSupport(
  event: NostrEvent,
  relayUrls: string[],
  sendFn: (event: NostrEvent, relayUrls: string[]) => Promise<void>
): Promise<void> {
  const online = get(isOnline);

  if (online) {
    // Try to send immediately
    try {
      await sendFn(event, relayUrls);
    } catch (error) {
      console.error('[PWA] Send failed, queueing message:', error);
      const { queueMessage } = await import('../stores/pwa');
      await queueMessage(event, relayUrls);
    }
  } else {
    // Queue for later
    console.log('[PWA] Offline, queueing message');
    const { queueMessage } = await import('../stores/pwa');
    await queueMessage(event, relayUrls);
  }
}

interface NostrEvent {
  kind: number;
  created_at: number;
  tags: string[][];
  content: string;
  pubkey: string;
  id?: string;
  sig?: string;
}
