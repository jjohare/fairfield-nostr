/**
 * NIP-29 Group Operations for Nostr-BBS
 *
 * Implements group chat functionality including:
 * - Join requests and approvals
 * - User management (kick, ban)
 * - Message deletion
 *
 * Event Kinds:
 * - 9: Group chat message
 * - 39000: Group metadata
 * - 39002: Group members
 * - 9000: Add user to group
 * - 9001: Remove user from group
 * - 9005: Delete event from group
 * - 9021: Join request (custom)
 */

import type { Event, EventTemplate } from 'nostr-tools';
import { getPublicKey, finalizeEvent } from 'nostr-tools';
import { hexToBytes } from '@noble/hashes/utils';

// NIP-29 Event Kinds
export const KIND_GROUP_CHAT_MESSAGE = 9;
export const KIND_GROUP_METADATA = 39000;
export const KIND_GROUP_MEMBERS = 39002;
export const KIND_ADD_USER = 9000;
export const KIND_REMOVE_USER = 9001;
export const KIND_DELETE_EVENT = 9005;
export const KIND_JOIN_REQUEST = 9021; // Custom kind for join requests
export const KIND_USER_REGISTRATION = 9024; // User registration request (new user wants system access)

// Standard deletion kind (NIP-09)
export const KIND_DELETION = 5;

/**
 * Relay interface for publishing events
 */
export interface Relay {
  publish(event: Event): Promise<void>;
  list(filters: Filter[]): Promise<Event[]>;
}

/**
 * Nostr filter for querying events
 */
export interface Filter {
  kinds?: number[];
  authors?: string[];
  ids?: string[];
  '#h'?: string[];
  '#e'?: string[];
  '#p'?: string[];
  since?: number;
  until?: number;
  limit?: number;
}

/**
 * Join request structure
 */
export interface JoinRequest {
  id: string;
  pubkey: string;
  channelId: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
  message?: string;
}

/**
 * User registration request structure
 */
export interface UserRegistrationRequest {
  id: string;
  pubkey: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
  displayName?: string;
  message?: string;
}

/**
 * Result of a publish operation
 */
export interface PublishResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

/**
 * Request to join a channel
 *
 * Creates a kind 9021 event with the channel ID in the 'h' tag.
 * Optional content field can contain a message to the admin.
 *
 * @param channelId - The group/channel ID to join
 * @param privateKey - User's private key (hex string)
 * @param relay - Connected relay instance
 * @param message - Optional message to include with request
 * @returns Promise resolving to publish result
 */
export async function requestJoin(
  channelId: string,
  privateKey: string,
  relay: Relay,
  message?: string
): Promise<PublishResult> {
  try {
    const privkeyBytes = hexToBytes(privateKey);
    const pubkey = getPublicKey(privkeyBytes);

    const event: EventTemplate = {
      kind: KIND_JOIN_REQUEST,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', channelId],
      ],
      content: message || '',
    };

    const signed = finalizeEvent(event, privkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Request user registration (new user wants system access)
 *
 * Creates a kind 9024 event to request system access.
 * Admin will see this in the pending registrations list.
 *
 * @param privateKey - User's private key (hex string)
 * @param relay - Connected relay instance
 * @param displayName - Optional display name for the request
 * @param message - Optional message to include with request
 * @returns Promise resolving to publish result
 */
export async function requestRegistration(
  privateKey: string,
  relay: Relay,
  displayName?: string,
  message?: string
): Promise<PublishResult> {
  try {
    const privkeyBytes = hexToBytes(privateKey);
    const pubkey = getPublicKey(privkeyBytes);

    const tags: string[][] = [
      ['t', 'registration'], // Tag for filtering
    ];

    if (displayName) {
      tags.push(['name', displayName]);
    }

    const event: EventTemplate = {
      kind: KIND_USER_REGISTRATION,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: message || 'New user registration request',
    };

    const signed = finalizeEvent(event, privkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Approve a join request
 *
 * Admin function that:
 * 1. Creates a kind 9000 (add-user) event to add the user to the group
 * 2. Creates a kind 5 (deletion) event to remove the join request
 *
 * @param request - The join request to approve
 * @param adminPrivateKey - Admin's private key (hex string)
 * @param relay - Connected relay instance
 * @returns Promise resolving to publish result
 */
export async function approveJoin(
  request: JoinRequest,
  adminPrivateKey: string,
  relay: Relay
): Promise<PublishResult> {
  try {
    const adminPrivkeyBytes = hexToBytes(adminPrivateKey);
    const adminPubkey = getPublicKey(adminPrivkeyBytes);

    // 1. Create add-user event (NIP-29)
    const addEvent: EventTemplate = {
      kind: KIND_ADD_USER,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', request.channelId],
        ['p', request.pubkey],
      ],
      content: '',
    };

    const signedAdd = finalizeEvent(addEvent, adminPrivkeyBytes);
    await relay.publish(signedAdd);

    // 2. Delete the join request (NIP-09)
    const deleteEvent: EventTemplate = {
      kind: KIND_DELETION,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', request.id],
      ],
      content: 'Approved',
    };

    const signedDelete = finalizeEvent(deleteEvent, adminPrivkeyBytes);
    await relay.publish(signedDelete);

    return {
      success: true,
      eventId: signedAdd.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Reject a join request
 *
 * Admin function that deletes the join request event with a rejection note.
 * Uses NIP-09 deletion event (kind 5).
 *
 * @param request - The join request to reject
 * @param adminPrivateKey - Admin's private key (hex string)
 * @param relay - Connected relay instance
 * @returns Promise resolving to publish result
 */
export async function rejectJoin(
  request: JoinRequest,
  adminPrivateKey: string,
  relay: Relay
): Promise<PublishResult> {
  try {
    const adminPrivkeyBytes = hexToBytes(adminPrivateKey);
    const adminPubkey = getPublicKey(adminPrivkeyBytes);

    const deleteEvent: EventTemplate = {
      kind: KIND_DELETION,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', request.id],
      ],
      content: 'Rejected',
    };

    const signed = finalizeEvent(deleteEvent, adminPrivkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Kick a user from a specific channel
 *
 * Admin function that creates a kind 9001 (remove-user) event.
 * The user immediately loses access to the channel.
 *
 * @param userPubkey - Public key of user to kick
 * @param channelId - The group/channel ID to kick from
 * @param adminPrivkey - Admin's private key (hex string)
 * @param relay - Connected relay instance
 * @param reason - Optional reason for kicking
 * @returns Promise resolving to publish result
 */
export async function kickFromChannel(
  userPubkey: string,
  channelId: string,
  adminPrivkey: string,
  relay: Relay,
  reason?: string
): Promise<PublishResult> {
  try {
    const adminPrivkeyBytes = hexToBytes(adminPrivkey);
    const adminPubkey = getPublicKey(adminPrivkeyBytes);

    const event: EventTemplate = {
      kind: KIND_REMOVE_USER,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', channelId],
        ['p', userPubkey],
      ],
      content: reason || 'Removed by admin',
    };

    const signed = finalizeEvent(event, adminPrivkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Ban a user from the entire system
 *
 * Admin function that:
 * 1. Removes user from all channels they're a member of
 * 2. Should be followed by relay whitelist update (external to Nostr)
 *
 * @param userPubkey - Public key of user to ban
 * @param adminPrivkey - Admin's private key (hex string)
 * @param relay - Connected relay instance
 * @param reason - Optional reason for banning
 * @returns Promise resolving with results for each channel
 */
export async function banUser(
  userPubkey: string,
  adminPrivkey: string,
  relay: Relay,
  reason?: string
): Promise<{
  success: boolean;
  channelsProcessed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let channelsProcessed = 0;

  try {
    // 1. Get all group member lists (kind 39002)
    const memberLists = await relay.list([
      { kinds: [KIND_GROUP_MEMBERS] }
    ]);

    // 2. Find all channels where user is a member
    const channelsWithUser: string[] = [];

    for (const memberList of memberLists) {
      const groupIdTag = memberList.tags.find(t => t[0] === 'd');
      if (!groupIdTag || !groupIdTag[1]) continue;

      const groupId = groupIdTag[1];
      const isMember = memberList.tags.some(
        t => t[0] === 'p' && t[1] === userPubkey
      );

      if (isMember) {
        channelsWithUser.push(groupId);
      }
    }

    // 3. Remove user from each channel
    for (const channelId of channelsWithUser) {
      const result = await kickFromChannel(
        userPubkey,
        channelId,
        adminPrivkey,
        relay,
        reason || 'Banned from system'
      );

      if (result.success) {
        channelsProcessed++;
      } else {
        errors.push(`Failed to remove from ${channelId}: ${result.error}`);
      }
    }

    return {
      success: errors.length === 0,
      channelsProcessed,
      errors,
    };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Unknown error');
    return {
      success: false,
      channelsProcessed,
      errors,
    };
  }
}

/**
 * Delete a message from a channel
 *
 * Admin function that creates a kind 9005 (group-delete) event.
 * The relay should remove the message from storage upon receiving this event.
 *
 * @param eventId - ID of the event/message to delete
 * @param channelId - The group/channel ID containing the message
 * @param adminPrivkey - Admin's private key (hex string)
 * @param relay - Connected relay instance
 * @param reason - Optional reason for deletion
 * @returns Promise resolving to publish result
 */
export async function deleteMessage(
  eventId: string,
  channelId: string,
  adminPrivkey: string,
  relay: Relay,
  reason?: string
): Promise<PublishResult> {
  try {
    const adminPrivkeyBytes = hexToBytes(adminPrivkey);
    const adminPubkey = getPublicKey(adminPrivkeyBytes);

    const event: EventTemplate = {
      kind: KIND_DELETE_EVENT,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['h', channelId],
        ['e', eventId],
      ],
      content: reason || 'Deleted by admin',
    };

    const signed = finalizeEvent(event, adminPrivkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch pending join requests for a channel
 *
 * Admin utility to retrieve all pending join requests.
 *
 * @param channelId - Optional channel ID to filter by
 * @param relay - Connected relay instance
 * @returns Promise resolving to array of join requests
 */
export async function fetchJoinRequests(
  relay: Relay,
  channelId?: string
): Promise<JoinRequest[]> {
  try {
    const filter: Filter = {
      kinds: [KIND_JOIN_REQUEST],
    };

    if (channelId) {
      filter['#h'] = [channelId];
    }

    const events = await relay.list([filter]);

    return events.map(event => ({
      id: event.id,
      pubkey: event.pubkey,
      channelId: event.tags.find(t => t[0] === 'h')?.[1] || '',
      createdAt: event.created_at,
      status: 'pending' as const,
      message: event.content || undefined,
    }));
  } catch (error) {
    console.error('Failed to fetch join requests:', error);
    return [];
  }
}

/**
 * Check if a user is a member of a channel
 *
 * @param userPubkey - Public key of user to check
 * @param channelId - The group/channel ID to check
 * @param relay - Connected relay instance
 * @returns Promise resolving to boolean indicating membership
 */
export async function isMember(
  userPubkey: string,
  channelId: string,
  relay: Relay
): Promise<boolean> {
  try {
    const memberLists = await relay.list([
      {
        kinds: [KIND_GROUP_MEMBERS],
      }
    ]);

    for (const memberList of memberLists) {
      const groupIdTag = memberList.tags.find(t => t[0] === 'd');
      if (!groupIdTag || groupIdTag[1] !== channelId) continue;

      return memberList.tags.some(t => t[0] === 'p' && t[1] === userPubkey);
    }

    return false;
  } catch (error) {
    console.error('Failed to check membership:', error);
    return false;
  }
}

/**
 * Send a group chat message
 *
 * Creates a kind 9 event for the specified channel.
 * Content is plaintext unless the channel uses E2E encryption.
 *
 * @param content - Message content (plaintext or encrypted)
 * @param channelId - The group/channel ID to post to
 * @param privateKey - Sender's private key (hex string)
 * @param relay - Connected relay instance
 * @param replyTo - Optional event ID to reply to
 * @returns Promise resolving to publish result
 */
export async function sendGroupMessage(
  content: string,
  channelId: string,
  privateKey: string,
  relay: Relay,
  replyTo?: string
): Promise<PublishResult> {
  try {
    const privkeyBytes = hexToBytes(privateKey);
    const pubkey = getPublicKey(privkeyBytes);

    const tags: string[][] = [
      ['h', channelId],
    ];

    if (replyTo) {
      tags.push(['e', replyTo, '', 'reply']);
    }

    const event: EventTemplate = {
      kind: KIND_GROUP_CHAT_MESSAGE,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content,
    };

    const signed = finalizeEvent(event, privkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fetch messages from a channel
 *
 * @param channelId - The group/channel ID to fetch messages from
 * @param relay - Connected relay instance
 * @param since - Optional timestamp to fetch messages since
 * @param limit - Maximum number of messages to fetch
 * @returns Promise resolving to array of message events
 */
export async function fetchChannelMessages(
  channelId: string,
  relay: Relay,
  since?: number,
  limit: number = 100
): Promise<Event[]> {
  try {
    const filter: Filter = {
      kinds: [KIND_GROUP_CHAT_MESSAGE],
      '#h': [channelId],
      limit,
    };

    if (since) {
      filter.since = since;
    }

    return await relay.list([filter]);
  } catch (error) {
    console.error('Failed to fetch channel messages:', error);
    return [];
  }
}

/**
 * Create or update group metadata
 *
 * Admin function to set channel name, description, and settings.
 * Creates a kind 39000 event.
 *
 * @param channelId - The group/channel ID
 * @param metadata - Channel metadata (name, description, etc.)
 * @param adminPrivkey - Admin's private key (hex string)
 * @param relay - Connected relay instance
 * @returns Promise resolving to publish result
 */
export async function updateGroupMetadata(
  channelId: string,
  metadata: {
    name: string;
    about?: string;
    picture?: string;
    cohorts?: ('business' | 'moomaa-tribe')[];
    visibility?: 'listed' | 'unlisted' | 'preview';
    encrypted?: boolean;
  },
  adminPrivkey: string,
  relay: Relay
): Promise<PublishResult> {
  try {
    const adminPrivkeyBytes = hexToBytes(adminPrivkey);
    const adminPubkey = getPublicKey(adminPrivkeyBytes);

    const tags: string[][] = [
      ['d', channelId],
    ];

    if (metadata.cohorts) {
      for (const cohort of metadata.cohorts) {
        tags.push(['cohort', cohort]);
      }
    }

    if (metadata.visibility) {
      tags.push(['visibility', metadata.visibility]);
    }

    if (metadata.encrypted) {
      tags.push(['encrypted', 'nip44']);
    }

    const event: EventTemplate = {
      kind: KIND_GROUP_METADATA,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: JSON.stringify({
        name: metadata.name,
        about: metadata.about || '',
        picture: metadata.picture || '',
      }),
    };

    const signed = finalizeEvent(event, adminPrivkeyBytes);
    await relay.publish(signed);

    return {
      success: true,
      eventId: signed.id,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
