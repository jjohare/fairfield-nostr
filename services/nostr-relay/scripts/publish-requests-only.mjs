#!/usr/bin/env node
/**
 * Publish only section access requests (kind 9022) with correct admin pubkey.
 */

import WebSocket from 'ws';
import * as nostrTools from 'nostr-tools';
import crypto from 'crypto';

const { getPublicKey, finalizeEvent } = nostrTools;

const RELAY_URL = process.env.RELAY_URL || 'wss://nostr-relay-617806532906.us-central1.run.app';

// Admin pubkey from frontend .env
const ADMIN_PUBKEY = '11ed64225dd5e2c5e18f61ad43d5ad9272d08739d3a20dd25886197b0738663c';

function generateKeypairFromSeed(seed) {
  const hash = crypto.createHash('sha256').update(seed).digest();
  const pubkey = getPublicKey(hash);
  return { privkey: hash, pubkey };
}

function createSectionRequest(privkey, pubkey, section, message) {
  const eventTemplate = {
    kind: 9022,
    created_at: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 3600),
    tags: [
      ['p', ADMIN_PUBKEY],
      ['section', section],
    ],
    content: message,
  };
  return finalizeEvent(eventTemplate, privkey);
}

async function publishEvents(events) {
  console.log(`Connecting to ${RELAY_URL}...`);
  console.log(`Events will be tagged to admin: ${ADMIN_PUBKEY}`);

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

  // Create sample section access requests (kind 9022)
  console.log('Generating section access requests with admin pubkey:', ADMIN_PUBKEY);

  const sampleRequests = [
    {
      seed: 'user-alice-v2',
      section: 'members',
      message: "Hi! I've been practicing TM for 5 years and would love to join the MooMaa tribe discussions.",
    },
    {
      seed: 'user-bob-v2',
      section: 'business',
      message: "I'm interested in local business networking opportunities in Fairfield.",
    },
    {
      seed: 'user-carol-v2',
      section: 'members',
      message: 'Long-time meditator from the golden dome. Would love to connect with the community.',
    },
    {
      seed: 'user-dave-v2',
      section: 'business',
      message: 'Opening a new organic cafe and looking to connect with other business owners.',
    },
    {
      seed: 'user-eve-v2',
      section: 'members',
      message: 'Just moved to Fairfield for the program. Excited to meet fellow practitioners!',
    },
  ];

  for (const { seed, section, message } of sampleRequests) {
    const { privkey, pubkey } = generateKeypairFromSeed(seed);
    const request = createSectionRequest(privkey, pubkey, section, message);
    eventsToPublish.push(request);
    console.log(`  Created request from ${pubkey.substring(0, 16)}... for section '${section}'`);
  }

  console.log(`\nTotal events to publish: ${eventsToPublish.length}`);
  await publishEvents(eventsToPublish);
}

main().catch(console.error);
