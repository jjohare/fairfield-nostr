import { WebSocketServer, WebSocket } from 'ws';
import { Database } from './db';
import { Whitelist } from './whitelist';
import { NostrHandlers } from './handlers';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT || '8080');
const HOST = process.env.HOST || '0.0.0.0';

class NostrRelay {
  private wss: WebSocketServer;
  private db: Database;
  private whitelist: Whitelist;
  private handlers: NostrHandlers;

  constructor() {
    this.db = new Database();
    this.whitelist = new Whitelist();
    this.handlers = new NostrHandlers(this.db, this.whitelist);
    this.wss = new WebSocketServer({ port: PORT, host: HOST });
  }

  async start(): Promise<void> {
    await this.db.init();

    this.wss.on('connection', (ws: WebSocket) => {
      console.log('New client connected');

      ws.on('message', async (data: Buffer) => {
        const message = data.toString();
        await this.handlers.handleMessage(ws, message);
      });

      ws.on('close', () => {
        console.log('Client disconnected');
        this.handlers.handleDisconnect(ws);
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log(`Nostr relay listening on ws://${HOST}:${PORT}`);
    console.log(`Whitelist mode: ${this.whitelist.list().length > 0 ? 'ENABLED' : 'DEVELOPMENT (all allowed)'}`);
  }

  async stop(): Promise<void> {
    this.wss.close();
    await this.db.close();
    console.log('Relay stopped');
  }
}

// Start the relay
const relay = new NostrRelay();

relay.start().catch((error) => {
  console.error('Failed to start relay:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await relay.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down...');
  await relay.stop();
  process.exit(0);
});
