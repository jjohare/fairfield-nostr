/**
 * Example: Integrating threading into MessageInput sendMessage function
 *
 * This shows how to modify your existing sendMessage function to support
 * reply and quote threading using Nostr NIP-10 tags.
 */

import { replyStore } from '$lib/stores/reply';
import type { Message } from '$lib/types/channel';

/**
 * Build thread tags for a message
 * Follows NIP-10 (thread replies) specification
 */
function buildThreadTags(replyContext: { message: Message; type: 'reply' | 'quote' } | null): string[][] {
  const tags: string[][] = [];

  if (!replyContext) {
    return tags;
  }

  if (replyContext.type === 'reply') {
    // Direct reply tag
    tags.push(['e', replyContext.message.id, '', 'reply']);

    // Find and include root tag
    if (replyContext.message.tags) {
      // Look for existing root tag
      const rootTag = replyContext.message.tags.find(
        (tag: string[]) => tag[0] === 'e' && tag[3] === 'root'
      );

      if (rootTag) {
        // Use existing root
        tags.push(['e', rootTag[1], '', 'root']);
      } else {
        // This is the first reply - the parent becomes root
        tags.push(['e', replyContext.message.id, '', 'root']);
      }
    } else {
      // No existing tags - parent is root
      tags.push(['e', replyContext.message.id, '', 'root']);
    }
  } else if (replyContext.type === 'quote') {
    // Mention/quote tag
    tags.push(['e', replyContext.message.id, '', 'mention']);
  }

  // Add author tag (p-tag)
  tags.push(['p', replyContext.message.authorPubkey]);

  return tags;
}

/**
 * Example integration with existing sendMessage function
 */
export async function sendMessageWithThreading(
  content: string,
  channelId: string,
  authorPubkey: string,
  isEncrypted: boolean
): Promise<Message> {

  // Get current reply/quote context from store
  const replyContext = replyStore.get(); // Use appropriate getter for your store

  // Build thread tags
  const tags = buildThreadTags(replyContext);

  // Create message with thread information
  const message: Message = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    channelId,
    authorPubkey,
    content,
    createdAt: Date.now(),
    isEncrypted,
    decryptedContent: isEncrypted ? content : undefined,

    // Thread-related fields
    tags: tags.length > 0 ? tags : undefined,
    replyTo: replyContext?.type === 'reply' ? replyContext.message.id : undefined,
    quotedMessages: replyContext?.type === 'quote' ? [replyContext.message.id] : undefined
  };

  // Send the message (your existing logic)
  // await channelStore.addMessage(message);
  // await publishToNostrRelay(message);

  // Clear reply context after sending
  replyStore.clear();

  return message;
}

/**
 * Example: Parsing received messages to extract thread info
 */
export function parseMessageThreadInfo(message: Message): {
  isReply: boolean;
  isQuote: boolean;
  replyToId?: string;
  rootId?: string;
  quotedIds: string[];
} {
  const result = {
    isReply: false,
    isQuote: false,
    replyToId: undefined as string | undefined,
    rootId: undefined as string | undefined,
    quotedIds: [] as string[]
  };

  if (!message.tags || message.tags.length === 0) {
    return result;
  }

  // Parse e-tags
  const eTags = message.tags.filter((tag: string[]) => tag[0] === 'e');

  eTags.forEach((tag: string[]) => {
    const [, eventId, , marker] = tag;

    if (marker === 'reply') {
      result.isReply = true;
      result.replyToId = eventId;
    } else if (marker === 'root') {
      result.rootId = eventId;
    } else if (marker === 'mention') {
      result.isQuote = true;
      result.quotedIds.push(eventId);
    }
  });

  // Fallback for unmarked tags (NIP-10 deprecated format)
  if (!result.replyToId && !result.rootId && eTags.length > 0) {
    if (eTags.length === 1) {
      result.replyToId = eTags[0][1];
      result.isReply = true;
    } else {
      result.rootId = eTags[0][1];
      result.replyToId = eTags[eTags.length - 1][1];
      result.isReply = true;
    }
  }

  return result;
}

/**
 * Example: Finding all replies to a message
 */
export function findRepliesToMessage(messageId: string, allMessages: Message[]): Message[] {
  return allMessages.filter(msg => {
    const threadInfo = parseMessageThreadInfo(msg);
    return threadInfo.replyToId === messageId;
  });
}

/**
 * Example: Building a thread tree
 */
export interface ThreadNode {
  message: Message;
  replies: ThreadNode[];
  depth: number;
}

export function buildThreadTree(messages: Message[], rootId?: string): ThreadNode[] {
  const messageMap = new Map<string, Message>(
    messages.map(m => [m.id, m])
  );

  const threads: ThreadNode[] = [];
  const nodeMap = new Map<string, ThreadNode>();

  // Create nodes
  messages.forEach(message => {
    nodeMap.set(message.id, {
      message,
      replies: [],
      depth: 0
    });
  });

  // Build tree structure
  messages.forEach(message => {
    const threadInfo = parseMessageThreadInfo(message);
    const node = nodeMap.get(message.id)!;

    if (threadInfo.isReply && threadInfo.replyToId) {
      const parent = nodeMap.get(threadInfo.replyToId);
      if (parent) {
        parent.replies.push(node);
        node.depth = parent.depth + 1;
      } else {
        threads.push(node); // Orphaned reply
      }
    } else if (!rootId || message.id === rootId || threadInfo.rootId === rootId) {
      threads.push(node);
    }
  });

  return threads;
}
