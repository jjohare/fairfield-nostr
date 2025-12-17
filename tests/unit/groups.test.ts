/**
 * Unit Tests: Group/Channel Management (NIP-29)
 *
 * Tests for join requests, admin approval/rejection, kick operations,
 * and group membership management according to SPARC specification.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { secp256k1 } from '@noble/curves/secp256k1';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';

const NIP06_PATH = "m/44'/1237'/0'/0/0";

/**
 * NIP-29 and custom event kinds
 */
const KIND_JOIN_REQUEST = 9021;  // Custom kind for join requests
const KIND_ADD_USER = 9000;      // NIP-29 add user to group
const KIND_REMOVE_USER = 9001;   // NIP-29 remove user from group
const KIND_DELETE_EVENT = 5;     // NIP-09 deletion event

/**
 * Nostr event structure
 */
interface NostrEvent {
  kind: number;
  pubkey: string;
  created_at: number;
  tags: string[][];
  content: string;
  id?: string;
  sig?: string;
}

/**
 * Join request interface
 */
interface JoinRequest {
  id: string;
  pubkey: string;
  channelId: string;
  createdAt: number;
  status: 'pending' | 'approved' | 'rejected';
}

/**
 * Get public key from private key
 */
function getPublicKey(privkeyHex: string): string {
  const privkey = hexToBytes(privkeyHex);
  const pubkey = secp256k1.getPublicKey(privkey, true);
  return bytesToHex(pubkey.slice(1)); // Remove prefix
}

/**
 * Generate key pair for testing
 */
function generateKeyPair(): { privateKey: string; publicKey: string } {
  const mnemonic = bip39.generateMnemonic(wordlist, 128);
  const seed = bip39.mnemonicToSeedSync(mnemonic, '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  return {
    privateKey: bytesToHex(derived.privateKey!),
    publicKey: bytesToHex(derived.publicKey!.slice(1))
  };
}

/**
 * Generate event ID (simplified - just use timestamp + random)
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(16);
  const random = Math.random().toString(16).slice(2);
  return (timestamp + random).padEnd(64, '0').slice(0, 64);
}

/**
 * User: Request to join a channel
 */
function requestJoin(channelId: string, userPrivkey: string): NostrEvent {
  const userPubkey = getPublicKey(userPrivkey);

  const event: NostrEvent = {
    kind: KIND_JOIN_REQUEST,
    pubkey: userPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['h', channelId]],
    content: '', // Optional: user message to admin
    id: generateEventId()
  };

  return event;
}

/**
 * Admin: Approve join request
 */
function approveJoin(
  request: JoinRequest,
  adminPrivkey: string
): NostrEvent {
  const adminPubkey = getPublicKey(adminPrivkey);

  const event: NostrEvent = {
    kind: KIND_ADD_USER,
    pubkey: adminPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['h', request.channelId],
      ['p', request.pubkey]
    ],
    content: '',
    id: generateEventId()
  };

  return event;
}

/**
 * Admin: Reject join request (create deletion event)
 */
function rejectJoin(
  request: JoinRequest,
  adminPrivkey: string
): NostrEvent {
  const adminPubkey = getPublicKey(adminPrivkey);

  const event: NostrEvent = {
    kind: KIND_DELETE_EVENT,
    pubkey: adminPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['e', request.id]],
    content: 'Rejected',
    id: generateEventId()
  };

  return event;
}

/**
 * Admin: Kick user from channel
 */
function kickUser(
  userPubkey: string,
  channelId: string,
  adminPrivkey: string
): NostrEvent {
  const adminPubkey = getPublicKey(adminPrivkey);

  const event: NostrEvent = {
    kind: KIND_REMOVE_USER,
    pubkey: adminPubkey,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['h', channelId],
      ['p', userPubkey]
    ],
    content: 'Removed by admin',
    id: generateEventId()
  };

  return event;
}

/**
 * Test Suite: Group/Channel Management
 */
describe('Group/Channel Management (NIP-29)', () => {
  let userKeys: { privateKey: string; publicKey: string };
  let adminKeys: { privateKey: string; publicKey: string };
  let channelId: string;

  beforeEach(() => {
    userKeys = generateKeyPair();
    adminKeys = generateKeyPair();
    channelId = 'test-channel-' + Math.random().toString(36).slice(2);
  });

  describe('Join Request Creation', () => {
    it('should create kind 9021 join request event', () => {
      const event = requestJoin(channelId, userKeys.privateKey);

      expect(event.kind).toBe(KIND_JOIN_REQUEST);
    });

    it('should include channel ID in h tag', () => {
      const event = requestJoin(channelId, userKeys.privateKey);

      const hTag = event.tags.find(t => t[0] === 'h');
      expect(hTag).toBeDefined();
      expect(hTag![1]).toBe(channelId);
    });

    it('should use user pubkey as event author', () => {
      const event = requestJoin(channelId, userKeys.privateKey);

      expect(event.pubkey).toBe(userKeys.publicKey);
    });

    it('should have valid timestamp', () => {
      const beforeRequest = Math.floor(Date.now() / 1000);
      const event = requestJoin(channelId, userKeys.privateKey);
      const afterRequest = Math.floor(Date.now() / 1000);

      expect(event.created_at).toBeGreaterThanOrEqual(beforeRequest);
      expect(event.created_at).toBeLessThanOrEqual(afterRequest + 1);
    });

    it('should have event ID', () => {
      const event = requestJoin(channelId, userKeys.privateKey);

      expect(event.id).toBeDefined();
      expect(event.id).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should allow optional message in content', () => {
      const event = requestJoin(channelId, userKeys.privateKey);

      // Default is empty content
      expect(event.content).toBe('');

      // Could be extended to include message
      const customMessage = 'Please let me join!';
      event.content = customMessage;
      expect(event.content).toBe(customMessage);
    });
  });

  describe('Admin Approval', () => {
    let request: JoinRequest;

    beforeEach(() => {
      const event = requestJoin(channelId, userKeys.privateKey);
      request = {
        id: event.id!,
        pubkey: event.pubkey,
        channelId,
        createdAt: event.created_at,
        status: 'pending'
      };
    });

    it('should create kind 9000 add-user event', () => {
      const event = approveJoin(request, adminKeys.privateKey);

      expect(event.kind).toBe(KIND_ADD_USER);
    });

    it('should include channel ID in h tag', () => {
      const event = approveJoin(request, adminKeys.privateKey);

      const hTag = event.tags.find(t => t[0] === 'h');
      expect(hTag).toBeDefined();
      expect(hTag![1]).toBe(channelId);
    });

    it('should include user pubkey in p tag', () => {
      const event = approveJoin(request, adminKeys.privateKey);

      const pTag = event.tags.find(t => t[0] === 'p');
      expect(pTag).toBeDefined();
      expect(pTag![1]).toBe(userKeys.publicKey);
    });

    it('should use admin pubkey as event author', () => {
      const event = approveJoin(request, adminKeys.privateKey);

      expect(event.pubkey).toBe(adminKeys.publicKey);
    });

    it('should have valid timestamp', () => {
      const beforeApproval = Math.floor(Date.now() / 1000);
      const event = approveJoin(request, adminKeys.privateKey);
      const afterApproval = Math.floor(Date.now() / 1000);

      expect(event.created_at).toBeGreaterThanOrEqual(beforeApproval);
      expect(event.created_at).toBeLessThanOrEqual(afterApproval + 1);
    });

    it('should create event after request', () => {
      const event = approveJoin(request, adminKeys.privateKey);

      expect(event.created_at).toBeGreaterThanOrEqual(request.createdAt);
    });
  });

  describe('Admin Rejection', () => {
    let request: JoinRequest;

    beforeEach(() => {
      const event = requestJoin(channelId, userKeys.privateKey);
      request = {
        id: event.id!,
        pubkey: event.pubkey,
        channelId,
        createdAt: event.created_at,
        status: 'pending'
      };
    });

    it('should create kind 5 deletion event', () => {
      const event = rejectJoin(request, adminKeys.privateKey);

      expect(event.kind).toBe(KIND_DELETE_EVENT);
    });

    it('should reference request event ID in e tag', () => {
      const event = rejectJoin(request, adminKeys.privateKey);

      const eTag = event.tags.find(t => t[0] === 'e');
      expect(eTag).toBeDefined();
      expect(eTag![1]).toBe(request.id);
    });

    it('should use admin pubkey as event author', () => {
      const event = rejectJoin(request, adminKeys.privateKey);

      expect(event.pubkey).toBe(adminKeys.publicKey);
    });

    it('should have rejection message in content', () => {
      const event = rejectJoin(request, adminKeys.privateKey);

      expect(event.content).toBe('Rejected');
    });

    it('should have valid timestamp', () => {
      const beforeRejection = Math.floor(Date.now() / 1000);
      const event = rejectJoin(request, adminKeys.privateKey);
      const afterRejection = Math.floor(Date.now() / 1000);

      expect(event.created_at).toBeGreaterThanOrEqual(beforeRejection);
      expect(event.created_at).toBeLessThanOrEqual(afterRejection + 1);
    });
  });

  describe('User Kick', () => {
    it('should create kind 9001 remove-user event', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);

      expect(event.kind).toBe(KIND_REMOVE_USER);
    });

    it('should include channel ID in h tag', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);

      const hTag = event.tags.find(t => t[0] === 'h');
      expect(hTag).toBeDefined();
      expect(hTag![1]).toBe(channelId);
    });

    it('should include user pubkey in p tag', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);

      const pTag = event.tags.find(t => t[0] === 'p');
      expect(pTag).toBeDefined();
      expect(pTag![1]).toBe(userKeys.publicKey);
    });

    it('should use admin pubkey as event author', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);

      expect(event.pubkey).toBe(adminKeys.publicKey);
    });

    it('should have removal reason in content', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);

      expect(event.content).toBe('Removed by admin');
    });

    it('should allow custom removal reason', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);
      event.content = 'Violation of community guidelines';

      expect(event.content).toBe('Violation of community guidelines');
    });
  });

  describe('Event Validation', () => {
    it('should validate join request has required tags', () => {
      const event = requestJoin(channelId, userKeys.privateKey);

      expect(event.tags.length).toBeGreaterThan(0);
      expect(event.tags.some(t => t[0] === 'h')).toBe(true);
    });

    it('should validate approval has required tags', () => {
      const request: JoinRequest = {
        id: generateEventId(),
        pubkey: userKeys.publicKey,
        channelId,
        createdAt: Math.floor(Date.now() / 1000),
        status: 'pending'
      };

      const event = approveJoin(request, adminKeys.privateKey);

      expect(event.tags.some(t => t[0] === 'h')).toBe(true);
      expect(event.tags.some(t => t[0] === 'p')).toBe(true);
    });

    it('should validate kick has required tags', () => {
      const event = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);

      expect(event.tags.some(t => t[0] === 'h')).toBe(true);
      expect(event.tags.some(t => t[0] === 'p')).toBe(true);
    });

    it('should validate deletion references correct event', () => {
      const request: JoinRequest = {
        id: generateEventId(),
        pubkey: userKeys.publicKey,
        channelId,
        createdAt: Math.floor(Date.now() / 1000),
        status: 'pending'
      };

      const event = rejectJoin(request, adminKeys.privateKey);

      const eTag = event.tags.find(t => t[0] === 'e');
      expect(eTag![1]).toBe(request.id);
    });
  });

  describe('Multi-Channel Operations', () => {
    it('should handle join requests for different channels', () => {
      const channel1 = 'channel-1';
      const channel2 = 'channel-2';

      const request1 = requestJoin(channel1, userKeys.privateKey);
      const request2 = requestJoin(channel2, userKeys.privateKey);

      expect(request1.tags.find(t => t[0] === 'h')![1]).toBe(channel1);
      expect(request2.tags.find(t => t[0] === 'h')![1]).toBe(channel2);
    });

    it('should handle kicks from different channels', () => {
      const channel1 = 'channel-1';
      const channel2 = 'channel-2';

      const kick1 = kickUser(userKeys.publicKey, channel1, adminKeys.privateKey);
      const kick2 = kickUser(userKeys.publicKey, channel2, adminKeys.privateKey);

      expect(kick1.tags.find(t => t[0] === 'h')![1]).toBe(channel1);
      expect(kick2.tags.find(t => t[0] === 'h')![1]).toBe(channel2);
    });
  });

  describe('Multi-User Operations', () => {
    it('should handle multiple join requests for same channel', () => {
      const user2Keys = generateKeyPair();
      const user3Keys = generateKeyPair();

      const request1 = requestJoin(channelId, userKeys.privateKey);
      const request2 = requestJoin(channelId, user2Keys.privateKey);
      const request3 = requestJoin(channelId, user3Keys.privateKey);

      expect(request1.pubkey).toBe(userKeys.publicKey);
      expect(request2.pubkey).toBe(user2Keys.publicKey);
      expect(request3.pubkey).toBe(user3Keys.publicKey);
    });

    it('should handle batch user approvals', () => {
      const users = Array.from({ length: 5 }, () => generateKeyPair());

      const approvals = users.map(user => {
        const request: JoinRequest = {
          id: generateEventId(),
          pubkey: user.publicKey,
          channelId,
          createdAt: Math.floor(Date.now() / 1000),
          status: 'pending'
        };
        return approveJoin(request, adminKeys.privateKey);
      });

      expect(approvals).toHaveLength(5);
      approvals.forEach((approval, i) => {
        expect(approval.kind).toBe(KIND_ADD_USER);
        expect(approval.tags.find(t => t[0] === 'p')![1]).toBe(users[i].publicKey);
      });
    });

    it('should handle batch user kicks', () => {
      const users = Array.from({ length: 5 }, () => generateKeyPair());

      const kicks = users.map(user =>
        kickUser(user.publicKey, channelId, adminKeys.privateKey)
      );

      expect(kicks).toHaveLength(5);
      kicks.forEach((kick, i) => {
        expect(kick.kind).toBe(KIND_REMOVE_USER);
        expect(kick.tags.find(t => t[0] === 'p')![1]).toBe(users[i].publicKey);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle channel IDs with special characters', () => {
      const specialChannelId = 'test-channel_123-äöü-🎉';
      const event = requestJoin(specialChannelId, userKeys.privateKey);

      expect(event.tags.find(t => t[0] === 'h')![1]).toBe(specialChannelId);
    });

    it('should handle very long channel IDs', () => {
      const longChannelId = 'a'.repeat(256);
      const event = requestJoin(longChannelId, userKeys.privateKey);

      expect(event.tags.find(t => t[0] === 'h')![1]).toBe(longChannelId);
    });

    it('should handle empty content field', () => {
      const request = requestJoin(channelId, userKeys.privateKey);
      expect(request.content).toBe('');

      const approval = approveJoin({
        id: generateEventId(),
        pubkey: userKeys.publicKey,
        channelId,
        createdAt: Math.floor(Date.now() / 1000),
        status: 'pending'
      }, adminKeys.privateKey);
      expect(approval.content).toBe('');
    });
  });

  describe('Workflow Integration', () => {
    it('should complete full join workflow', () => {
      // 1. User requests to join
      const joinRequest = requestJoin(channelId, userKeys.privateKey);
      expect(joinRequest.kind).toBe(KIND_JOIN_REQUEST);

      // 2. Admin approves
      const request: JoinRequest = {
        id: joinRequest.id!,
        pubkey: joinRequest.pubkey,
        channelId,
        createdAt: joinRequest.created_at,
        status: 'pending'
      };

      const approval = approveJoin(request, adminKeys.privateKey);
      expect(approval.kind).toBe(KIND_ADD_USER);
      expect(approval.created_at).toBeGreaterThanOrEqual(joinRequest.created_at);

      // Verify user is added
      expect(approval.tags.find(t => t[0] === 'p')![1]).toBe(userKeys.publicKey);
    });

    it('should complete full rejection workflow', () => {
      // 1. User requests to join
      const joinRequest = requestJoin(channelId, userKeys.privateKey);

      // 2. Admin rejects
      const request: JoinRequest = {
        id: joinRequest.id!,
        pubkey: joinRequest.pubkey,
        channelId,
        createdAt: joinRequest.created_at,
        status: 'pending'
      };

      const rejection = rejectJoin(request, adminKeys.privateKey);
      expect(rejection.kind).toBe(KIND_DELETE_EVENT);
      expect(rejection.tags.find(t => t[0] === 'e')![1]).toBe(joinRequest.id);
    });

    it('should complete approve then kick workflow', () => {
      // 1. User joins
      const joinRequest = requestJoin(channelId, userKeys.privateKey);

      const request: JoinRequest = {
        id: joinRequest.id!,
        pubkey: joinRequest.pubkey,
        channelId,
        createdAt: joinRequest.created_at,
        status: 'pending'
      };

      const approval = approveJoin(request, adminKeys.privateKey);

      // 2. Later, admin kicks user
      const kick = kickUser(userKeys.publicKey, channelId, adminKeys.privateKey);
      expect(kick.kind).toBe(KIND_REMOVE_USER);
      expect(kick.created_at).toBeGreaterThanOrEqual(approval.created_at);
    });
  });

  describe('Performance', () => {
    it('should create join requests efficiently', () => {
      const start = performance.now();

      for (let i = 0; i < 100; i++) {
        requestJoin(channelId, userKeys.privateKey);
      }

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // < 1ms per request
    });

    it('should handle batch operations efficiently', () => {
      const users = Array.from({ length: 100 }, () => generateKeyPair());

      const start = performance.now();

      users.forEach(user => {
        const request: JoinRequest = {
          id: generateEventId(),
          pubkey: user.publicKey,
          channelId,
          createdAt: Math.floor(Date.now() / 1000),
          status: 'pending'
        };
        approveJoin(request, adminKeys.privateKey);
      });

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(100); // < 1ms per operation
    });
  });
});
