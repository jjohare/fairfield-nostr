/**
 * NDK Relay Usage Examples
 * Demonstrates how to use the relay connection system
 */

import {
  connectRelay,
  publishEvent,
  subscribe,
  disconnectRelay,
  connectionState,
  getCurrentUser,
  ConnectionState
} from './relay';
import { NDKEvent, NDKFilter } from '@nostr-dev-kit/ndk';
import { RELAY_URL } from '../config';

/**
 * Example 1: Connect to relay with authentication
 */
export async function exampleConnect(privateKey: string): Promise<void> {
  try {
    // Subscribe to connection state changes
    connectionState.subscribe(status => {
      console.log('Connection state:', status.state);
      if (status.error) {
        console.error('Connection error:', status.error);
      }
    });

    // Connect to relay
    const status = await connectRelay(RELAY_URL, privateKey);
    console.log('Connected:', status);

    // Get current user
    const user = await getCurrentUser();
    console.log('Current user:', user?.pubkey);
  } catch (error) {
    console.error('Failed to connect:', error);
  }
}

/**
 * Example 2: Publish a text note (kind 1)
 */
export async function examplePublishNote(content: string): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Not connected');
    }

    const event = new NDKEvent();
    event.kind = 1;
    event.content = content;
    event.pubkey = user.pubkey;
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [];

    const published = await publishEvent(event);
    console.log('Event published:', published);
  } catch (error) {
    console.error('Failed to publish:', error);
  }
}

/**
 * Example 3: Subscribe to events
 */
export async function exampleSubscribe(authorPubkey: string): Promise<void> {
  try {
    const filters: NDKFilter = {
      kinds: [1],
      authors: [authorPubkey],
      limit: 10
    };

    const subscription = subscribe(filters, {
      closeOnEose: false,
      subId: 'my-subscription'
    });

    subscription.on('event', (event: NDKEvent) => {
      console.log('Received event:', {
        id: event.id,
        kind: event.kind,
        content: event.content,
        created_at: event.created_at
      });
    });

    subscription.on('eose', () => {
      console.log('End of stored events');
    });

    subscription.start();
  } catch (error) {
    console.error('Failed to subscribe:', error);
  }
}

/**
 * Example 4: Publish metadata (kind 0)
 */
export async function examplePublishMetadata(
  name: string,
  about: string,
  picture?: string
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Not connected');
    }

    const metadata = {
      name,
      about,
      picture
    };

    const event = new NDKEvent();
    event.kind = 0;
    event.content = JSON.stringify(metadata);
    event.pubkey = user.pubkey;
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [];

    const published = await publishEvent(event);
    console.log('Metadata published:', published);
  } catch (error) {
    console.error('Failed to publish metadata:', error);
  }
}

/**
 * Example 5: React to an event (kind 7)
 */
export async function exampleReactToEvent(
  eventId: string,
  eventAuthor: string,
  reaction: string = '+'
): Promise<void> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Not connected');
    }

    const event = new NDKEvent();
    event.kind = 7;
    event.content = reaction;
    event.pubkey = user.pubkey;
    event.created_at = Math.floor(Date.now() / 1000);
    event.tags = [
      ['e', eventId],
      ['p', eventAuthor]
    ];

    const published = await publishEvent(event);
    console.log('Reaction published:', published);
  } catch (error) {
    console.error('Failed to react:', error);
  }
}

/**
 * Example 6: Multiple subscriptions
 */
export async function exampleMultipleSubscriptions(): Promise<void> {
  try {
    // Subscribe to text notes
    const notesFilter: NDKFilter = { kinds: [1], limit: 20 };
    const notesSub = subscribe(notesFilter, { subId: 'notes' });

    notesSub.on('event', (event: NDKEvent) => {
      console.log('Note:', event.content);
    });

    // Subscribe to reactions
    const reactionsFilter: NDKFilter = { kinds: [7], limit: 20 };
    const reactionsSub = subscribe(reactionsFilter, { subId: 'reactions' });

    reactionsSub.on('event', (event: NDKEvent) => {
      console.log('Reaction:', event.content);
    });

    // Start both subscriptions
    notesSub.start();
    reactionsSub.start();
  } catch (error) {
    console.error('Failed to create subscriptions:', error);
  }
}

/**
 * Example 7: Handle connection state changes
 */
export function exampleMonitorConnection(): void {
  connectionState.subscribe(status => {
    switch (status.state) {
      case ConnectionState.Connecting:
        console.log('Connecting to relay...');
        break;

      case ConnectionState.Connected:
        console.log('Connected to relay:', status.relay);
        break;

      case ConnectionState.AuthRequired:
        console.log('Authentication required');
        break;

      case ConnectionState.Authenticating:
        console.log('Authenticating...');
        break;

      case ConnectionState.Authenticated:
        console.log('Successfully authenticated');
        break;

      case ConnectionState.AuthFailed:
        console.error('Authentication failed:', status.error);
        break;

      case ConnectionState.Disconnected:
        console.log('Disconnected from relay');
        break;

      case ConnectionState.Error:
        console.error('Connection error:', status.error);
        break;
    }
  });
}

/**
 * Example 8: Complete workflow
 */
export async function exampleCompleteWorkflow(privateKey: string): Promise<void> {
  try {
    // Monitor connection
    exampleMonitorConnection();

    // Connect
    await connectRelay(RELAY_URL, privateKey);

    // Publish a note
    await examplePublishNote('Hello from Fairfield Nostr!');

    // Subscribe to own events
    const user = await getCurrentUser();
    if (user) {
      await exampleSubscribe(user.pubkey);
    }

    // Wait for events...
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Disconnect
    await disconnectRelay();
    console.log('Workflow complete');
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}
