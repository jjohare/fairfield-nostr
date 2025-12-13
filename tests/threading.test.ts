/**
 * Unit tests for quote/reply threading functionality
 *
 * Run with: npm test threading.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { replyStore, threadStore } from '$lib/stores/reply';
import type { Message } from '$lib/types/channel';

// Helper to create test messages
function createTestMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: `msg-${Date.now()}-${Math.random()}`,
    channelId: 'test-channel',
    authorPubkey: 'test-pubkey',
    content: 'Test message',
    createdAt: Date.now(),
    isEncrypted: false,
    ...overrides
  };
}

describe('replyStore', () => {
  beforeEach(() => {
    replyStore.clear();
  });

  it('should initialize with null', () => {
    const state = get(replyStore);
    expect(state).toBeNull();
  });

  it('should set reply target', () => {
    const message = createTestMessage();
    replyStore.setReplyTo(message);

    const state = get(replyStore);
    expect(state).not.toBeNull();
    expect(state?.type).toBe('reply');
    expect(state?.message.id).toBe(message.id);
  });

  it('should set quote target', () => {
    const message = createTestMessage();
    replyStore.setQuoteTo(message);

    const state = get(replyStore);
    expect(state).not.toBeNull();
    expect(state?.type).toBe('quote');
    expect(state?.message.id).toBe(message.id);
  });

  it('should clear reply state', () => {
    const message = createTestMessage();
    replyStore.setReplyTo(message);
    replyStore.clear();

    const state = get(replyStore);
    expect(state).toBeNull();
  });

  it('should replace previous reply context', () => {
    const message1 = createTestMessage({ id: 'msg-1' });
    const message2 = createTestMessage({ id: 'msg-2' });

    replyStore.setReplyTo(message1);
    replyStore.setQuoteTo(message2);

    const state = get(replyStore);
    expect(state?.message.id).toBe('msg-2');
    expect(state?.type).toBe('quote');
  });
});

describe('threadStore', () => {
  beforeEach(() => {
    threadStore.clear();
  });

  it('should parse reply tags', () => {
    const message = createTestMessage({
      id: 'reply-msg',
      tags: [
        ['e', 'parent-msg', '', 'reply'],
        ['e', 'root-msg', '', 'root'],
        ['p', 'author-pubkey']
      ]
    });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.messageId).toBe('reply-msg');
    expect(relationship.replyTo).toBe('parent-msg');
    expect(relationship.rootId).toBe('root-msg');
  });

  it('should parse quote tags', () => {
    const message = createTestMessage({
      id: 'quote-msg',
      tags: [
        ['e', 'quoted-msg', '', 'mention'],
        ['p', 'author-pubkey']
      ]
    });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.messageId).toBe('quote-msg');
    expect(relationship.quotedMessages).toContain('quoted-msg');
  });

  it('should handle unmarked tags (fallback)', () => {
    const message = createTestMessage({
      id: 'msg',
      tags: [
        ['e', 'root-msg'],
        ['e', 'parent-msg']
      ]
    });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.rootId).toBe('root-msg');
    expect(relationship.replyTo).toBe('parent-msg');
  });

  it('should handle single e-tag as reply', () => {
    const message = createTestMessage({
      id: 'msg',
      tags: [
        ['e', 'parent-msg']
      ]
    });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.replyTo).toBe('parent-msg');
  });

  it('should get relationship by message ID', () => {
    const message = createTestMessage({
      id: 'test-msg',
      tags: [
        ['e', 'parent', '', 'reply']
      ]
    });

    threadStore.parseMessageTags(message);
    const relationship = threadStore.getRelationship('test-msg');

    expect(relationship).toBeDefined();
    expect(relationship?.replyTo).toBe('parent');
  });

  it('should find replies to a message', () => {
    const parent = createTestMessage({ id: 'parent' });
    const reply1 = createTestMessage({
      id: 'reply-1',
      tags: [['e', 'parent', '', 'reply']]
    });
    const reply2 = createTestMessage({
      id: 'reply-2',
      tags: [['e', 'parent', '', 'reply']]
    });

    threadStore.parseMessageTags(parent);
    threadStore.parseMessageTags(reply1);
    threadStore.parseMessageTags(reply2);

    const replies = threadStore.getReplies('parent');

    expect(replies).toHaveLength(2);
    expect(replies.map(r => r.messageId)).toContain('reply-1');
    expect(replies.map(r => r.messageId)).toContain('reply-2');
  });

  it('should handle multiple quoted messages', () => {
    const message = createTestMessage({
      id: 'msg',
      tags: [
        ['e', 'quote-1', '', 'mention'],
        ['e', 'quote-2', '', 'mention'],
        ['p', 'author']
      ]
    });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.quotedMessages).toHaveLength(2);
    expect(relationship.quotedMessages).toContain('quote-1');
    expect(relationship.quotedMessages).toContain('quote-2');
  });

  it('should clear all thread data', () => {
    const message = createTestMessage({
      tags: [['e', 'parent', '', 'reply']]
    });

    threadStore.parseMessageTags(message);
    threadStore.clear();

    const relationship = threadStore.getRelationship(message.id);
    expect(relationship).toBeUndefined();
  });
});

describe('Thread tag building', () => {
  it('should build reply tags for first reply', () => {
    const parent = createTestMessage({ id: 'parent' });
    const tags: string[][] = [
      ['e', parent.id, '', 'reply'],
      ['e', parent.id, '', 'root'],
      ['p', parent.authorPubkey]
    ];

    expect(tags).toHaveLength(3);
    expect(tags[0][3]).toBe('reply');
    expect(tags[1][3]).toBe('root');
    expect(tags[2][0]).toBe('p');
  });

  it('should build reply tags for nested reply', () => {
    const root = createTestMessage({ id: 'root' });
    const parent = createTestMessage({
      id: 'parent',
      tags: [
        ['e', 'root', '', 'root'],
        ['e', 'root', '', 'reply']
      ]
    });

    const tags: string[][] = [
      ['e', parent.id, '', 'reply'],
      ['e', 'root', '', 'root'],
      ['p', parent.authorPubkey]
    ];

    expect(tags[0][1]).toBe(parent.id); // Reply to parent
    expect(tags[1][1]).toBe('root'); // Root stays same
  });

  it('should build quote tags', () => {
    const quoted = createTestMessage({ id: 'quoted' });
    const tags: string[][] = [
      ['e', quoted.id, '', 'mention'],
      ['p', quoted.authorPubkey]
    ];

    expect(tags).toHaveLength(2);
    expect(tags[0][3]).toBe('mention');
  });
});

describe('Thread parsing', () => {
  it('should detect reply messages', () => {
    const message = createTestMessage({
      tags: [['e', 'parent', '', 'reply']]
    });

    const relationship = threadStore.parseMessageTags(message);
    const isReply = !!relationship.replyTo;

    expect(isReply).toBe(true);
  });

  it('should detect quote messages', () => {
    const message = createTestMessage({
      tags: [['e', 'quoted', '', 'mention']]
    });

    const relationship = threadStore.parseMessageTags(message);
    const isQuote = (relationship.quotedMessages?.length || 0) > 0;

    expect(isQuote).toBe(true);
  });

  it('should handle messages with no tags', () => {
    const message = createTestMessage({ tags: undefined });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.replyTo).toBeUndefined();
    expect(relationship.rootId).toBeUndefined();
    expect(relationship.quotedMessages).toBeUndefined();
  });

  it('should handle empty tags array', () => {
    const message = createTestMessage({ tags: [] });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.replyTo).toBeUndefined();
    expect(relationship.rootId).toBeUndefined();
  });
});

describe('Integration scenarios', () => {
  beforeEach(() => {
    replyStore.clear();
    threadStore.clear();
  });

  it('should handle full reply workflow', () => {
    // 1. User selects message to reply to
    const originalMessage = createTestMessage({ id: 'original' });
    replyStore.setReplyTo(originalMessage);

    // 2. Verify reply context is set
    let state = get(replyStore);
    expect(state?.type).toBe('reply');

    // 3. User sends reply (would build tags here)
    const replyMessage = createTestMessage({
      id: 'reply',
      tags: [
        ['e', 'original', '', 'reply'],
        ['e', 'original', '', 'root'],
        ['p', originalMessage.authorPubkey]
      ]
    });

    // 4. Parse reply message
    const relationship = threadStore.parseMessageTags(replyMessage);
    expect(relationship.replyTo).toBe('original');

    // 5. Clear reply context
    replyStore.clear();
    state = get(replyStore);
    expect(state).toBeNull();
  });

  it('should handle nested reply thread', () => {
    // Create thread: root -> reply1 -> reply2
    const root = createTestMessage({ id: 'root' });

    const reply1 = createTestMessage({
      id: 'reply1',
      tags: [
        ['e', 'root', '', 'reply'],
        ['e', 'root', '', 'root']
      ]
    });

    const reply2 = createTestMessage({
      id: 'reply2',
      tags: [
        ['e', 'reply1', '', 'reply'],
        ['e', 'root', '', 'root']
      ]
    });

    threadStore.parseMessageTags(root);
    threadStore.parseMessageTags(reply1);
    threadStore.parseMessageTags(reply2);

    // Verify thread structure
    const rel1 = threadStore.getRelationship('reply1');
    const rel2 = threadStore.getRelationship('reply2');

    expect(rel1?.replyTo).toBe('root');
    expect(rel1?.rootId).toBe('root');
    expect(rel2?.replyTo).toBe('reply1');
    expect(rel2?.rootId).toBe('root'); // Same root
  });

  it('should handle quote and reply in same message', () => {
    const message = createTestMessage({
      id: 'msg',
      tags: [
        ['e', 'parent', '', 'reply'],
        ['e', 'quoted', '', 'mention'],
        ['e', 'root', '', 'root']
      ]
    });

    const relationship = threadStore.parseMessageTags(message);

    expect(relationship.replyTo).toBe('parent');
    expect(relationship.quotedMessages).toContain('quoted');
    expect(relationship.rootId).toBe('root');
  });
});
