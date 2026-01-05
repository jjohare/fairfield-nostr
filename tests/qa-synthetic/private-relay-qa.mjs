#!/usr/bin/env node
/**
 * Enhanced QA Test Suite for Private Relay
 * Tests: Nicknames, Avatars, Reactions, Image Messages
 * Target: wss://nostr-relay-617806532906.us-central1.run.app
 */

import { generateSecretKey, getPublicKey, finalizeEvent } from 'nostr-tools/pure';
import * as nip19 from 'nostr-tools/nip19';
import { mnemonicToSeedSync } from '@scure/bip39';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import 'websocket-polyfill';

const WebSocket = globalThis.WebSocket;

// Private relay URL from .env
const RELAY_URL = 'wss://nostr-relay-617806532906.us-central1.run.app';

// Test users with proper profiles
const TEST_USERS = {
  superAdmin: {
    name: 'Queen Seraphina',
    displayName: 'Queen Seraphina',
    avatar: 'https://robohash.org/queen-seraphina?set=set4&size=200x200',
    about: 'Super Administrator of Nostr BBS BBS',
    mnemonic: 'glimpse marble confirm army sleep imitate lake balance home panic view brand',
    role: 'super_admin'
  },
  areaAdmin1: {
    name: 'Meditation Guide',
    displayName: 'Zen Master Luna',
    avatar: 'https://robohash.org/zen-master-luna?set=set4&size=200x200',
    about: 'Area admin for wellness and meditation channels',
    mnemonic: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    role: 'area_admin'
  },
  areaAdmin2: {
    name: 'Community Manager',
    displayName: 'Event Coordinator Max',
    avatar: 'https://robohash.org/event-max?set=set4&size=200x200',
    about: 'Area admin for community events and meetups',
    mnemonic: 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
    role: 'area_admin'
  },
  user1: {
    name: 'Alice',
    displayName: 'Alice Wonderland',
    avatar: 'https://i.nostr.build/placeholder-alice.png',
    about: 'Regular community member, loves meditation',
    mnemonic: 'letter advice cage absurd amount doctor acoustic avoid letter advice cage above',
    role: 'user'
  },
  user2: {
    name: 'Bob',
    displayName: 'Bob Builder',
    avatar: 'https://robohash.org/bob-builder?set=set4&size=200x200',
    about: 'Tech enthusiast and event organizer',
    mnemonic: 'void come effort suffer camp survey warrior heavy shoot primary clutch crush',
    role: 'user'
  }
};

// Channels with pictures
const CHANNELS = [
  {
    id: 'meditation-circle',
    name: 'Meditation Circle',
    about: 'Daily meditation sessions and mindfulness discussions',
    picture: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400',
    section: 'wellness'
  },
  {
    id: 'community-events',
    name: 'Community Events',
    about: 'Upcoming events, meetups, and gatherings',
    picture: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400',
    section: 'events'
  },
  {
    id: 'tech-talk',
    name: 'Tech Talk',
    about: 'Technology discussions and Nostr development',
    picture: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400',
    section: 'tech'
  },
  {
    id: 'art-gallery',
    name: 'Art Gallery',
    about: 'Share your artwork and creative projects',
    picture: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=400',
    section: 'creative'
  }
];

// Messages with images
const MESSAGES_WITH_IMAGES = [
  {
    channel: 'meditation-circle',
    content: 'Morning meditation session starting soon! Here is today\'s focus image:\nhttps://images.unsplash.com/photo-1528715471579-d1bcf0ba5e83?w=800',
    author: 'areaAdmin1'
  },
  {
    channel: 'art-gallery',
    content: 'Check out this amazing sunset I captured yesterday!\nhttps://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=800',
    author: 'user1'
  },
  {
    channel: 'tech-talk',
    content: 'New Nostr client architecture diagram:\nhttps://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800\n\nWhat do you think about this approach?',
    author: 'user2'
  },
  {
    channel: 'community-events',
    content: 'Event poster for next week\'s meetup:\nhttps://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800\n\nRSVP in the calendar!',
    author: 'areaAdmin2'
  }
];

// Regular text messages for reactions
const TEXT_MESSAGES = [
  { channel: 'meditation-circle', content: 'Great session today! Feeling so peaceful 🧘', author: 'user1' },
  { channel: 'meditation-circle', content: 'Welcome everyone to the circle!', author: 'areaAdmin1' },
  { channel: 'tech-talk', content: 'Has anyone tried the new NIP-29 implementation?', author: 'user2' },
  { channel: 'tech-talk', content: 'Yes! It works great for group management', author: 'superAdmin' },
  { channel: 'community-events', content: 'Who\'s coming to the holiday party? 🎉', author: 'areaAdmin2' },
  { channel: 'art-gallery', content: 'I love this community!', author: 'user1' }
];

// Reactions to apply
const REACTIONS = [
  { emoji: '❤️', fromUser: 'user2', toMessageIndex: 0 },
  { emoji: '👍', fromUser: 'superAdmin', toMessageIndex: 0 },
  { emoji: '🔥', fromUser: 'areaAdmin1', toMessageIndex: 2 },
  { emoji: '🎉', fromUser: 'user1', toMessageIndex: 4 },
  { emoji: '😂', fromUser: 'user2', toMessageIndex: 5 },
  { emoji: '❤️', fromUser: 'areaAdmin2', toMessageIndex: 5 },
  { emoji: '👍', fromUser: 'user1', toMessageIndex: 3 },
  { emoji: '🙏', fromUser: 'user2', toMessageIndex: 1 }
];

/**
 * Derive keypair from mnemonic using BIP39/BIP32
 */
function deriveKeypair(mnemonic) {
  const seed = mnemonicToSeedSync(mnemonic);
  const hdkey = HDKey.fromMasterSeed(seed);
  const derived = hdkey.derive("m/44'/1237'/0'/0/0");
  const secretKey = derived.privateKey;
  const publicKey = getPublicKey(secretKey);
  return {
    secretKey: bytesToHex(secretKey),
    publicKey,
    npub: nip19.npubEncode(publicKey),
    nsec: nip19.nsecEncode(secretKey)
  };
}

/**
 * Create and sign a Nostr event
 */
function createEvent(secretKeyHex, kind, content, tags = []) {
  const secretKey = hexToBytes(secretKeyHex);
  const event = {
    kind,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content
  };
  return finalizeEvent(event, secretKey);
}

/**
 * WebSocket-based relay publisher
 */
class RelayPublisher {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.connected = false;
    this.pendingEvents = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      console.log(`Connecting to relay: ${this.url}`);
      this.ws = new WebSocket(this.url);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 15000);

      this.ws.onopen = () => {
        clearTimeout(timeout);
        this.connected = true;
        console.log('✓ Connected to relay');
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg[0] === 'OK') {
            const eventId = msg[1];
            const success = msg[2];
            const pendingResolve = this.pendingEvents.get(eventId);
            if (pendingResolve) {
              pendingResolve.resolve({ success, message: msg[3] || '' });
              this.pendingEvents.delete(eventId);
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      };

      this.ws.onerror = (err) => {
        clearTimeout(timeout);
        console.error('WebSocket error:', err);
        reject(err);
      };

      this.ws.onclose = () => {
        this.connected = false;
        console.log('Disconnected from relay');
      };
    });
  }

  async publish(event) {
    if (!this.connected) {
      throw new Error('Not connected to relay');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingEvents.delete(event.id);
        reject(new Error(`Publish timeout for event ${event.id}`));
      }, 10000);

      this.pendingEvents.set(event.id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        }
      });

      this.ws.send(JSON.stringify(['EVENT', event]));
    });
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

/**
 * Create user profile event (kind 0)
 */
function createProfileEvent(user, keypair) {
  const metadata = {
    name: user.name,
    display_name: user.displayName,
    picture: user.avatar,
    about: user.about
  };
  return createEvent(keypair.secretKey, 0, JSON.stringify(metadata), []);
}

/**
 * Create NIP-29 channel metadata event (kind 39000)
 */
function createChannelMetadataEvent(channel, keypair) {
  const tags = [
    ['d', channel.id],
    ['name', channel.name],
    ['about', channel.about],
    ['picture', channel.picture]
  ];
  return createEvent(keypair.secretKey, 39000, '', tags);
}

/**
 * Create NIP-29 channel message event (kind 9)
 */
function createChannelMessageEvent(channelId, content, keypair) {
  const tags = [
    ['h', channelId]
  ];
  return createEvent(keypair.secretKey, 9, content, tags);
}

/**
 * Create NIP-25 reaction event (kind 7)
 */
function createReactionEvent(targetEventId, targetAuthorPubkey, emoji, keypair) {
  const tags = [
    ['e', targetEventId],
    ['p', targetAuthorPubkey]
  ];
  return createEvent(keypair.secretKey, 7, emoji, tags);
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║  ENHANCED QA SUITE - PRIVATE RELAY                             ║');
  console.log('║  Testing: Nicknames, Avatars, Reactions, Images                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  // Initialize users with keypairs
  console.log('━━━ Phase 1: Deriving User Keypairs ━━━');
  const users = {};
  for (const [key, userData] of Object.entries(TEST_USERS)) {
    const keypair = deriveKeypair(userData.mnemonic);
    users[key] = { ...userData, keypair };
    console.log(`✓ ${userData.displayName} (${userData.role})`);
    console.log(`  npub: ${keypair.npub.slice(0, 20)}...`);
  }

  // Connect to relay
  console.log('\n━━━ Phase 2: Connecting to Private Relay ━━━');
  const relay = new RelayPublisher(RELAY_URL);

  try {
    await relay.connect();
  } catch (error) {
    console.error('✗ Failed to connect:', error.message);
    process.exit(1);
  }

  // Publish user profiles
  console.log('\n━━━ Phase 3: Publishing User Profiles (kind 0) ━━━');
  for (const [key, user] of Object.entries(users)) {
    try {
      const event = createProfileEvent(user, user.keypair);
      const result = await relay.publish(event);
      console.log(`✓ ${user.displayName}: ${result.success ? 'Published' : result.message}`);
    } catch (error) {
      console.error(`✗ ${user.displayName}: ${error.message}`);
    }
  }

  // Publish channels
  console.log('\n━━━ Phase 4: Publishing Channels (kind 39000) ━━━');
  const channelMap = {};
  for (const channel of CHANNELS) {
    try {
      const event = createChannelMetadataEvent(channel, users.superAdmin.keypair);
      const result = await relay.publish(event);
      channelMap[channel.id] = event.id;
      console.log(`✓ ${channel.name}: ${result.success ? 'Published' : result.message}`);
    } catch (error) {
      console.error(`✗ ${channel.name}: ${error.message}`);
    }
  }

  // Publish messages with images
  console.log('\n━━━ Phase 5: Publishing Messages with Images (kind 9) ━━━');
  for (const msg of MESSAGES_WITH_IMAGES) {
    try {
      const author = users[msg.author];
      const event = createChannelMessageEvent(msg.channel, msg.content, author.keypair);
      const result = await relay.publish(event);
      console.log(`✓ [${msg.channel}] ${author.displayName}: Image message published`);
    } catch (error) {
      console.error(`✗ ${msg.channel}: ${error.message}`);
    }
  }

  // Publish text messages (for reactions)
  console.log('\n━━━ Phase 6: Publishing Text Messages (kind 9) ━━━');
  const publishedMessages = [];
  for (const msg of TEXT_MESSAGES) {
    try {
      const author = users[msg.author];
      const event = createChannelMessageEvent(msg.channel, msg.content, author.keypair);
      const result = await relay.publish(event);
      publishedMessages.push({
        id: event.id,
        pubkey: author.keypair.publicKey,
        content: msg.content,
        author: msg.author
      });
      console.log(`✓ [${msg.channel}] ${author.displayName}: "${msg.content.slice(0, 30)}..."`);
    } catch (error) {
      console.error(`✗ ${msg.channel}: ${error.message}`);
    }
  }

  // Publish reactions
  console.log('\n━━━ Phase 7: Publishing Reactions (kind 7) ━━━');
  for (const reaction of REACTIONS) {
    try {
      const fromUser = users[reaction.fromUser];
      const targetMsg = publishedMessages[reaction.toMessageIndex];
      if (!targetMsg) {
        console.log(`⚠ Skipping reaction - target message not found`);
        continue;
      }

      const event = createReactionEvent(
        targetMsg.id,
        targetMsg.pubkey,
        reaction.emoji,
        fromUser.keypair
      );
      const result = await relay.publish(event);
      console.log(`✓ ${fromUser.displayName} reacted ${reaction.emoji} to "${targetMsg.content.slice(0, 25)}..."`);
    } catch (error) {
      console.error(`✗ Reaction: ${error.message}`);
    }
  }

  // Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('DATA PUBLISHED TO PRIVATE RELAY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Relay: ${RELAY_URL}`);
  console.log(`User Profiles: ${Object.keys(users).length}`);
  console.log(`Channels: ${CHANNELS.length}`);
  console.log(`Messages with Images: ${MESSAGES_WITH_IMAGES.length}`);
  console.log(`Text Messages: ${TEXT_MESSAGES.length}`);
  console.log(`Reactions: ${REACTIONS.length}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  relay.close();

  return {
    users: Object.fromEntries(
      Object.entries(users).map(([k, v]) => [k, {
        name: v.name,
        displayName: v.displayName,
        avatar: v.avatar,
        role: v.role,
        npub: v.keypair.npub,
        pubkey: v.keypair.publicKey
      }])
    ),
    channels: channelMap,
    messages: publishedMessages.length,
    reactions: REACTIONS.length
  };
}

// Export for orchestrator
export { main as generatePrivateRelayData };

// Run if called directly
main()
  .then(result => {
    console.log('✓ Data generation complete');
    console.log(JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
