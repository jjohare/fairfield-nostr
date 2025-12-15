/**
 * Test event fixtures
 */
import { createTestEvent, TEST_ADMIN, TEST_USER_1, TEST_USER_2 } from './test-keys.js';

/**
 * Sample text note events (kind 1)
 */
export function createTextNoteEvent(identity = TEST_USER_1, content = 'Hello Nostr!') {
  return createTestEvent(identity, 1, content, []);
}

/**
 * Sample reply event (kind 1 with 'e' tag)
 */
export function createReplyEvent(
  identity = TEST_USER_1,
  replyToEventId: string,
  content = 'This is a reply'
) {
  return createTestEvent(identity, 1, content, [
    ['e', replyToEventId, '', 'reply'],
  ]);
}

/**
 * Sample metadata event (kind 0)
 */
export function createMetadataEvent(identity = TEST_USER_1) {
  const metadata = {
    name: 'Test User',
    about: 'A test user for the relay',
    picture: 'https://example.com/avatar.jpg',
  };

  return createTestEvent(identity, 0, JSON.stringify(metadata), []);
}

/**
 * Sample channel creation event (NIP-28 kind 40)
 */
export function createChannelEvent(
  identity = TEST_ADMIN,
  channelName = 'Test Channel'
) {
  const metadata = {
    name: channelName,
    about: 'A test channel',
    picture: 'https://example.com/channel.jpg',
  };

  return createTestEvent(identity, 40, JSON.stringify(metadata), []);
}

/**
 * Sample channel message event (NIP-28 kind 42)
 */
export function createChannelMessageEvent(
  identity = TEST_USER_1,
  channelId: string,
  message = 'Hello channel!'
) {
  return createTestEvent(identity, 42, message, [
    ['e', channelId, '', 'root'],
  ]);
}

/**
 * Sample calendar event (NIP-52 kind 31922)
 */
export function createCalendarEvent(
  identity = TEST_ADMIN,
  title = 'Test Meeting',
  startTime?: number
) {
  const start = startTime || Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
  const end = start + 3600; // 1 hour duration

  const content = {
    title,
    description: 'A test calendar event',
    start: start.toString(),
    end: end.toString(),
    location: 'Virtual',
  };

  return createTestEvent(identity, 31922, JSON.stringify(content), [
    ['d', `event-${Date.now()}`],
    ['title', title],
    ['start', start.toString()],
    ['end', end.toString()],
  ]);
}

/**
 * Sample direct message event (NIP-04 kind 4)
 */
export function createDirectMessageEvent(
  identity = TEST_USER_1,
  recipientPubkey: string,
  content = 'Secret message'
) {
  // Note: In real implementation, content should be encrypted
  return createTestEvent(identity, 4, content, [
    ['p', recipientPubkey],
  ]);
}

/**
 * Sample reaction event (kind 7)
 */
export function createReactionEvent(
  identity = TEST_USER_1,
  eventId: string,
  reaction = '+'
) {
  return createTestEvent(identity, 7, reaction, [
    ['e', eventId],
    ['p', TEST_USER_2.publicKey],
  ]);
}

/**
 * Sample deletion event (kind 5)
 */
export function createDeletionEvent(
  identity = TEST_USER_1,
  eventIdsToDelete: string[]
) {
  return createTestEvent(identity, 5, 'Deleting events',
    eventIdsToDelete.map(id => ['e', id])
  );
}

/**
 * Create bulk events for performance testing
 */
export function createBulkEvents(count: number, identity = TEST_USER_1) {
  const events = [];
  for (let i = 0; i < count; i++) {
    events.push(createTextNoteEvent(identity, `Test event ${i + 1}`));
  }
  return events;
}
