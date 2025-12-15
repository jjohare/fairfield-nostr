/**
 * NIP-01 Protocol Compliance Tests
 * Tests Nostr protocol message types: EVENT, REQ, CLOSE
 */
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import WebSocket from 'ws';
import { TEST_RELAY_CONFIG } from '../setup.js';
import { createTestEvent, TEST_USER_1, TEST_ADMIN } from '../fixtures/test-keys.js';

describe('NIP-01 Protocol Compliance', () => {
  let ws: WebSocket;
  const RELAY_URL = TEST_RELAY_CONFIG.wsUrl;

  beforeEach((done) => {
    ws = new WebSocket(RELAY_URL);
    ws.on('open', () => done());
    ws.on('error', (error) => done(error));
  });

  afterEach((done) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      ws.on('close', () => done());
    } else {
      done();
    }
  });

  describe('EVENT Messages', () => {
    it('should accept valid EVENT message', (done) => {
      const event = createTestEvent(TEST_ADMIN, 1, 'Test message');

      ws.send(JSON.stringify(['EVENT', event]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'OK') {
          expect(response[1]).toBe(event.id);
          expect(response[2]).toBe(true); // Accepted
          done();
        }
      });
    });

    it('should reject EVENT with invalid signature', (done) => {
      const event = createTestEvent(TEST_USER_1, 1, 'Test message');
      event.sig = '0'.repeat(128); // Invalid signature

      ws.send(JSON.stringify(['EVENT', event]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'OK') {
          expect(response[1]).toBe(event.id);
          expect(response[2]).toBe(false); // Rejected
          expect(response[3]).toContain('invalid'); // Error message
          done();
        }
      });
    });

    it('should reject EVENT with missing required fields', (done) => {
      const invalidEvent = {
        id: 'test',
        pubkey: TEST_USER_1.publicKey,
        // Missing created_at, kind, tags, content, sig
      };

      ws.send(JSON.stringify(['EVENT', invalidEvent]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        // Should receive NOTICE or OK:false
        if (response[0] === 'NOTICE' || response[0] === 'OK') {
          done();
        }
      });
    });
  });

  describe('REQ Messages', () => {
    it('should accept REQ and open subscription', (done) => {
      const subscriptionId = 'test-sub-1';
      const filter = { kinds: [1], limit: 10 };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        // Should receive EOSE (end of stored events)
        if (response[0] === 'EOSE') {
          expect(response[1]).toBe(subscriptionId);
          done();
        }
      });
    });

    it('should support multiple filters in REQ', (done) => {
      const subscriptionId = 'multi-filter-sub';
      const filter1 = { kinds: [1], limit: 5 };
      const filter2 = { kinds: [0], limit: 5 };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter1, filter2]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'EOSE') {
          expect(response[1]).toBe(subscriptionId);
          done();
        }
      });
    });

    it('should filter by author pubkey', (done) => {
      const subscriptionId = 'author-filter';
      const filter = { authors: [TEST_ADMIN.publicKey], limit: 10 };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      let receivedEOSE = false;

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'EVENT') {
          expect(response[2].pubkey).toBe(TEST_ADMIN.publicKey);
        } else if (response[0] === 'EOSE') {
          receivedEOSE = true;
          expect(response[1]).toBe(subscriptionId);
          done();
        }
      });

      setTimeout(() => {
        if (!receivedEOSE) {
          done(); // No events found is OK
        }
      }, 1000);
    });

    it('should filter by event IDs', (done) => {
      const event = createTestEvent(TEST_USER_1, 1, 'Find me');
      const subscriptionId = 'id-filter';

      // First publish event
      ws.send(JSON.stringify(['EVENT', event]));

      setTimeout(() => {
        // Then query for it
        const filter = { ids: [event.id] };
        ws.send(JSON.stringify(['REQ', subscriptionId, filter]));
      }, 200);

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'EVENT' && response[2].id === event.id) {
          expect(response[1]).toBe(subscriptionId);
          expect(response[2].content).toBe('Find me');
          done();
        }
      });
    });

    it('should respect limit parameter', (done) => {
      const subscriptionId = 'limit-test';
      const filter = { kinds: [1], limit: 3 };
      const events: any[] = [];

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'EVENT') {
          events.push(response[2]);
        } else if (response[0] === 'EOSE') {
          expect(events.length).toBeLessThanOrEqual(3);
          done();
        }
      });
    });

    it('should filter by timestamp (since/until)', (done) => {
      const now = Math.floor(Date.now() / 1000);
      const subscriptionId = 'time-filter';
      const filter = {
        kinds: [1],
        since: now - 3600, // Last hour
        until: now + 60,   // Next minute
        limit: 10
      };

      ws.send(JSON.stringify(['REQ', subscriptionId, filter]));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'EVENT') {
          const eventTime = response[2].created_at;
          expect(eventTime).toBeGreaterThanOrEqual(filter.since);
          expect(eventTime).toBeLessThanOrEqual(filter.until);
        } else if (response[0] === 'EOSE') {
          done();
        }
      });
    });
  });

  describe('CLOSE Messages', () => {
    it('should close subscription with CLOSE', (done) => {
      const subscriptionId = 'close-test';

      // Open subscription
      ws.send(JSON.stringify(['REQ', subscriptionId, { kinds: [1] }]));

      setTimeout(() => {
        // Close subscription
        ws.send(JSON.stringify(['CLOSE', subscriptionId]));

        // Verify no more events come through
        let receivedAfterClose = false;
        ws.on('message', (data) => {
          const response = JSON.parse(data.toString());
          if (response[0] === 'EVENT' && response[1] === subscriptionId) {
            receivedAfterClose = true;
          }
        });

        setTimeout(() => {
          expect(receivedAfterClose).toBe(false);
          done();
        }, 500);
      }, 200);
    });

    it('should handle closing non-existent subscription', (done) => {
      ws.send(JSON.stringify(['CLOSE', 'non-existent-sub']));

      // Should not crash or send error
      setTimeout(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      }, 200);
    });

    it('should allow reopening same subscription ID', (done) => {
      const subscriptionId = 'reopen-test';

      // Open subscription
      ws.send(JSON.stringify(['REQ', subscriptionId, { kinds: [1], limit: 1 }]));

      setTimeout(() => {
        // Close subscription
        ws.send(JSON.stringify(['CLOSE', subscriptionId]));

        setTimeout(() => {
          // Reopen with same ID
          ws.send(JSON.stringify(['REQ', subscriptionId, { kinds: [0], limit: 1 }]));

          ws.on('message', (data) => {
            const response = JSON.parse(data.toString());
            if (response[0] === 'EOSE' && response[1] === subscriptionId) {
              done();
            }
          });
        }, 200);
      }, 200);
    });
  });

  describe('Error Handling', () => {
    it('should reject unknown message types', (done) => {
      ws.send(JSON.stringify(['UNKNOWN', 'param1', 'param2']));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        // Should receive NOTICE about unknown message type
        if (response[0] === 'NOTICE') {
          expect(response[1].toLowerCase()).toContain('unknown');
          done();
        }
      });
    });

    it('should handle malformed JSON gracefully', (done) => {
      ws.send('{invalid json}');

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'NOTICE') {
          done();
        }
      });
    });

    it('should handle non-array message format', (done) => {
      ws.send(JSON.stringify({ type: 'EVENT', data: 'test' }));

      ws.on('message', (data) => {
        const response = JSON.parse(data.toString());

        if (response[0] === 'NOTICE') {
          done();
        }
      });
    });
  });
});
