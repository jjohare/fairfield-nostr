/**
 * Notification integration with message and DM stores
 * This module hooks into message events to trigger notifications
 */

import { notificationStore, shouldNotify } from '$lib/stores/notifications';
import { messageStore } from '$lib/stores/messages';
import { get } from 'svelte/store';
import { db } from '$lib/db';
import { currentPubkey } from '$lib/stores/user';

/**
 * Track the currently active channel to avoid duplicate notifications
 */
let currentActiveChannel: string | null = null;

/**
 * Track processed message IDs to avoid duplicate notifications
 */
const processedMessageIds = new Set<string>();

/**
 * Set the currently active channel
 */
export function setActiveChannel(channelId: string | null): void {
  currentActiveChannel = channelId;
}

/**
 * Get the currently active channel
 */
export function getActiveChannel(): string | null {
  return currentActiveChannel;
}

/**
 * Initialize notification listeners for message store
 * This should be called once when the app initializes
 */
export function initializeNotificationListeners(): void {
  let lastMessageCount = 0;

  // Subscribe to message store changes
  messageStore.subscribe(async (state) => {
    // Only process when not loading and we have new messages
    if (state.loading || state.messages.length === 0) {
      return;
    }

    // Only process new messages (when count increases)
    if (state.messages.length > lastMessageCount) {
      const newMessages = state.messages.slice(lastMessageCount);

      for (const message of newMessages) {
        await processMessageForNotification(message, state.currentChannelId);
      }
    }

    lastMessageCount = state.messages.length;
  });
}

/**
 * Process a message to determine if a notification should be shown
 */
async function processMessageForNotification(
  message: any,
  currentChannelId: string | null
): Promise<void> {
  try {
    // Skip if already processed
    if (processedMessageIds.has(message.id)) {
      return;
    }

    // Mark as processed
    processedMessageIds.add(message.id);

    // Clean up old processed IDs (keep last 1000)
    if (processedMessageIds.size > 1000) {
      const idsArray = Array.from(processedMessageIds);
      const toKeep = idsArray.slice(-1000);
      processedMessageIds.clear();
      toKeep.forEach(id => processedMessageIds.add(id));
    }

    // Check if we should notify for this message
    if (!shouldNotify(message.pubkey, message.channelId, currentActiveChannel)) {
      return;
    }

    // Get channel information
    const channel = await db.getChannel(message.channelId);
    const channelName = channel?.name || 'Unknown Channel';

    // Check for @mention (prepare for Phase 2)
    const userPubkey = get(currentPubkey);
    const hasMention = checkForMention(message.content, userPubkey);
    const notificationType = hasMention ? 'mention' : 'message';

    // Create notification message
    const senderName = message.author.name || message.author.pubkey.slice(0, 8);
    const notificationMessage = hasMention
      ? `${senderName} mentioned you in ${channelName}`
      : `${senderName}: ${message.content.slice(0, 50)}${message.content.length > 50 ? '...' : ''}`;

    // Add notification
    notificationStore.addNotification(notificationType, notificationMessage, {
      channelId: message.channelId,
      channelName,
      senderPubkey: message.pubkey,
      senderName,
      url: `/chat?channel=${message.channelId}`
    });
  } catch (error) {
    console.error('Error processing message notification:', error);
  }
}

/**
 * Check if a message contains a mention (for Phase 2)
 * Currently just checks for @ symbol, will need user pubkey/name matching
 */
function checkForMention(content: string, userPubkey: string | null): boolean {
  if (!userPubkey) return false;

  // Simple check for @ symbol for now
  // In Phase 2, this should check for:
  // - @username mentions
  // - nostr:npub mentions
  // - pubkey hex mentions
  return content.includes('@');
}

/**
 * Notify about a new DM
 */
export function notifyNewDM(
  senderPubkey: string,
  senderName: string,
  preview: string
): void {
  const message = `New message from ${senderName}`;

  notificationStore.addNotification('dm', message, {
    senderPubkey,
    senderName,
    url: `/dm?user=${senderPubkey}`
  });
}

/**
 * Notify about a join request (for admins)
 */
export function notifyJoinRequest(
  channelId: string,
  channelName: string,
  requesterPubkey: string,
  requesterName: string
): void {
  const message = `${requesterName} wants to join ${channelName}`;

  notificationStore.addNotification('join-request', message, {
    channelId,
    channelName,
    senderPubkey: requesterPubkey,
    senderName: requesterName,
    url: `/admin?tab=requests&channel=${channelId}`
  });
}

/**
 * Notify about a system event
 */
export function notifySystem(message: string, url?: string): void {
  notificationStore.addNotification('system', message, { url });
}
