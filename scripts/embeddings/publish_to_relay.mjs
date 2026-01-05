#!/usr/bin/env node
/**
 * Publish synthetic events to the Nostr relay.
 * Also creates sample section access requests (kind 9022) for admin testing.
 */

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { schnorr } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RELAY_URL = 'wss://nostr-relay-617806532906.us-central1.run.app';
const OUTPUT_DIR = path.join(__dirname, 'output');

// Sample admin pubkey - events will be tagged to this admin
const ADMIN_PUBKEY = 'e8b487c079b0f67c695ae6c4c2552a47f38adfa2533cc5926bd2c102942fdcb7';

function generateKeypairFromSeed(seed) {
  const privkeyBytes = sha256(new TextEncoder().encode(seed));
  const pubkeyBytes = schnorr.getPublicKey(privkeyBytes);
  return {
    privkey: bytesToHex(privkeyBytes),
    pubkey: bytesToHex(pubkeyBytes),
  };
}

function signEvent(event, privkey) {
  // Serialize for ID
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  // Generate event ID
  const idBytes = sha256(new TextEncoder().encode(serialized));
  event.id = bytesToHex(idBytes);

  // Sign with private key
  const sig = schnorr.sign(idBytes, hexToBytes(privkey));
  event.sig = bytesToHex(sig);

  return event;
}

function createSectionRequest(pubkey, privkey, section, message) {
  const event = {
    pubkey,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
    kind: 9022,
    tags: [
      ['p', ADMIN_PUBKEY],
      ['section', section],
    ],
    content: message,
  };
  return signEvent(event, privkey);
}

async function publishEvents(events) {
  console.log(`Connecting to ${RELAY_URL}...`);

  return new Promise((resolve) => {
    const ws = new WebSocket(RELAY_URL);
    let successCount = 0;
    let currentIndex = 0;
    let responseTimeout = null;

    const sendNext = () => {
      if (currentIndex >= events.length) {
        console.log(`\nPublished ${successCount}/${events.length} events successfully`);
        ws.close();
        resolve(successCount);
        return;
      }

      const event = events[currentIndex];
      const msg = JSON.stringify(['EVENT', event]);
      ws.send(msg);

      responseTimeout = setTimeout(() => {
        console.log(`  [${currentIndex + 1}/${events.length}] Timeout waiting for response`);
        currentIndex++;
        sendNext();
      }, 5000);
    };

    ws.on('open', () => {
      console.log(`Connected! Publishing ${events.length} events...`);
      sendNext();
    });

    ws.on('message', (data) => {
      if (responseTimeout) {
        clearTimeout(responseTimeout);
        responseTimeout = null;
      }

      try {
        const resp = JSON.parse(data.toString());
        const event = events[currentIndex];

        if (resp[0] === 'OK') {
          if (resp[2] === true) {
            successCount++;
            console.log(
              `  [${currentIndex + 1}/${events.length}] Published kind ${event.kind}: ${event.id?.substring(0, 16)}...`
            );
          } else {
            console.log(`  [${currentIndex + 1}/${events.length}] Rejected: ${resp[3]}`);
          }
        }
      } catch {
        // Ignore parse errors
      }

      currentIndex++;
      sendNext();
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message);
      resolve(successCount);
    });

    ws.on('close', () => {
      if (responseTimeout) {
        clearTimeout(responseTimeout);
      }
      resolve(successCount);
    });
  });
}

async function main() {
  const eventsToPublish = [];

  // Load synthetic events
  const eventsPath = path.join(OUTPUT_DIR, 'synthetic_events.json');
  if (fs.existsSync(eventsPath)) {
    const syntheticEvents = JSON.parse(fs.readFileSync(eventsPath, 'utf-8'));
    console.log(`Loaded ${syntheticEvents.length} synthetic events`);

    // Re-sign events with proper signatures
    for (const event of syntheticEvents) {
      const seed = `synthetic-user-${event.pubkey.substring(0, 8)}`;
      const { privkey, pubkey } = generateKeypairFromSeed(seed);

      const signed = signEvent(
        {
          pubkey,
          created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 604800), // Last week
          kind: event.kind,
          tags: event.tags,
          content: event.content,
        },
        privkey
      );
      eventsToPublish.push(signed);
    }
  } else {
    console.log('No synthetic events file found');
  }

  // Create sample section access requests (kind 9022)
  console.log('\nGenerating sample section access requests...');
  const sampleRequests = [
    {
      seed: 'user-alice',
      section: 'members',
      message:
        "Hi! I've been practicing TM for 5 years and would love to join the MooMaa tribe discussions.",
    },
    {
      seed: 'user-bob',
      section: 'business',
      message: "I'm interested in local business networking opportunities in Fairfield.",
    },
    {
      seed: 'user-carol',
      section: 'members',
      message: 'Long-time meditator from the golden dome. Would love to connect with the community.',
    },
    {
      seed: 'user-dave',
      section: 'business',
      message: 'Opening a new organic cafe and looking to connect with other business owners.',
    },
    {
      seed: 'user-eve',
      section: 'members',
      message: 'Just moved to Fairfield for the program. Excited to meet fellow practitioners!',
    },
  ];

  for (const { seed, section, message } of sampleRequests) {
    const { privkey, pubkey } = generateKeypairFromSeed(seed);
    const request = createSectionRequest(pubkey, privkey, section, message);
    eventsToPublish.push(request);
    console.log(`  Created request from ${pubkey.substring(0, 16)}... for section '${section}'`);
  }

  // Publish all events
  console.log(`\nTotal events to publish: ${eventsToPublish.length}`);
  await publishEvents(eventsToPublish);
}

main().catch(console.error);
