import { writable } from 'svelte/store';
import type { Message } from '$lib/types/channel';

/**
 * Reply context for threading
 */
export interface ReplyContext {
  message: Message;
  type: 'reply' | 'quote';
}

/**
 * Reply store for managing reply/quote state
 */
function createReplyStore() {
  const { subscribe, set, update } = writable<ReplyContext | null>(null);

  return {
    subscribe,

    /**
     * Set a message as reply target
     */
    setReplyTo(message: Message): void {
      set({ message, type: 'reply' });
    },

    /**
     * Set a message as quote target
     */
    setQuoteTo(message: Message): void {
      set({ message, type: 'quote' });
    },

    /**
     * Clear reply/quote state
     */
    clear(): void {
      set(null);
    }
  };
}

export const replyStore = createReplyStore();

/**
 * Thread relationships extracted from message tags
 */
export interface ThreadRelationship {
  messageId: string;
  replyTo?: string;
  rootId?: string;
  quotedMessages?: string[];
}

/**
 * Thread store for managing thread relationships
 */
function createThreadStore() {
  const { subscribe, set, update } = writable<Map<string, ThreadRelationship>>(new Map());

  return {
    subscribe,

    /**
     * Parse and store thread relationships from message tags
     */
    parseMessageTags(message: Message): ThreadRelationship {
      const relationship: ThreadRelationship = {
        messageId: message.id
      };

      // Parse 'e' tags for thread relationships
      // NIP-10: e tags have format ['e', <event-id>, <relay-url>, <marker>]
      // Markers: 'reply' (direct reply), 'root' (thread root), 'mention' (quoted/mentioned)
      if (message.tags) {
        const eTags = message.tags.filter((tag: string[]) => tag[0] === 'e');

        eTags.forEach((tag: string[]) => {
          const eventId = tag[1];
          const marker = tag[3];

          if (marker === 'reply') {
            relationship.replyTo = eventId;
          } else if (marker === 'root') {
            relationship.rootId = eventId;
          } else if (marker === 'mention') {
            relationship.quotedMessages = relationship.quotedMessages || [];
            relationship.quotedMessages.push(eventId);
          }
        });

        // Fallback: if no marker, first e-tag is root, last is reply
        if (!relationship.replyTo && !relationship.rootId && eTags.length > 0) {
          if (eTags.length === 1) {
            relationship.replyTo = eTags[0][1];
          } else {
            relationship.rootId = eTags[0][1];
            relationship.replyTo = eTags[eTags.length - 1][1];
          }
        }
      }

      update(threads => {
        threads.set(message.id, relationship);
        return threads;
      });

      return relationship;
    },

    /**
     * Get thread relationship for a message
     */
    getRelationship(messageId: string): ThreadRelationship | undefined {
      let result: ThreadRelationship | undefined;

      subscribe(threads => {
        result = threads.get(messageId);
      })();

      return result;
    },

    /**
     * Get all replies to a message
     */
    getReplies(messageId: string): ThreadRelationship[] {
      let replies: ThreadRelationship[] = [];

      subscribe(threads => {
        replies = Array.from(threads.values()).filter(
          rel => rel.replyTo === messageId
        );
      })();

      return replies;
    },

    /**
     * Clear all thread data
     */
    clear(): void {
      set(new Map());
    }
  };
}

export const threadStore = createThreadStore();
