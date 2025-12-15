/**
 * WebSocket Connection Tests
 * Tests real WebSocket connections to the Nostr relay
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import WebSocket from 'ws';
import { TEST_RELAY_CONFIG } from '../setup.js';

describe('WebSocket Connection Tests', () => {
  let ws: WebSocket;
  const RELAY_URL = TEST_RELAY_CONFIG.wsUrl;

  afterEach((done) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
      ws.on('close', () => done());
    } else {
      done();
    }
  });

  it('should establish WebSocket connection', (done) => {
    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should receive connection acknowledgment', (done) => {
    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
      // Relay might send NOTICE on connect
      setTimeout(() => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      }, 100);
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should handle multiple concurrent connections', (done) => {
    const connections: WebSocket[] = [];
    const CONCURRENT_COUNT = 10;
    let openedCount = 0;

    for (let i = 0; i < CONCURRENT_COUNT; i++) {
      const conn = new WebSocket(RELAY_URL);
      connections.push(conn);

      conn.on('open', () => {
        openedCount++;
        if (openedCount === CONCURRENT_COUNT) {
          expect(openedCount).toBe(CONCURRENT_COUNT);

          // Close all connections
          connections.forEach(c => c.close());
          done();
        }
      });

      conn.on('error', (error) => {
        connections.forEach(c => c.close());
        done(error);
      });
    }
  });

  it('should handle connection close gracefully', (done) => {
    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
      ws.close();
    });

    ws.on('close', (code, reason) => {
      expect([1000, 1001, 1005, 1006]).toContain(code); // Normal closure codes
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should reject malformed messages', (done) => {
    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
      ws.send('invalid json');

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString());

        // Should receive NOTICE about invalid message
        if (message[0] === 'NOTICE') {
          expect(message[1]).toBeTruthy();
          done();
        }
      });
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should handle ping/pong frames', (done) => {
    ws = new WebSocket(RELAY_URL);

    ws.on('open', () => {
      ws.ping();
    });

    ws.on('pong', () => {
      expect(true).toBe(true); // Pong received
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should handle rapid message sending', (done) => {
    ws = new WebSocket(RELAY_URL);
    const MESSAGE_COUNT = 50;
    let sentCount = 0;

    ws.on('open', () => {
      // Send many messages rapidly
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        try {
          ws.send(JSON.stringify(['REQ', `sub-${i}`, {}]));
          sentCount++;
        } catch (error) {
          done(error);
          return;
        }
      }

      expect(sentCount).toBe(MESSAGE_COUNT);
      setTimeout(() => done(), 500); // Give time for processing
    });

    ws.on('error', (error) => {
      done(error);
    });
  });
});
