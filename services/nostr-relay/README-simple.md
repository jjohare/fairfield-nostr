# Simple Nostr Relay

A minimal, whitelist-based Nostr relay for internal/point-to-point use with PostgreSQL storage.

## Features

- ✅ NIP-01 compliant (Basic protocol)
- ✅ Whitelist-based authentication
- ✅ PostgreSQL event storage
- ✅ WebSocket server
- ✅ Docker deployment ready
- ❌ NO federation (isolated relay)
- ❌ NO external connections

## Architecture

```
src/
├── server.ts     - WebSocket server (77 lines)
├── db.ts         - PostgreSQL client (160 lines)
├── whitelist.ts  - Whitelist management (42 lines)
└── handlers.ts   - Event/REQ/CLOSE handlers (174 lines)
```

Total: ~453 lines of code

## Quick Start

### 1. Configure Environment

```bash
cp .env.example .env
# Edit .env and set WHITELIST_PUBKEYS
```

### 2. Run with Docker Compose

```bash
docker-compose up -d
```

The relay will be available at `ws://localhost:8080`

### 3. Whitelist Configuration

Add allowed pubkeys to `.env`:

```env
WHITELIST_PUBKEYS=pubkey1,pubkey2,pubkey3
```

Leave empty for development mode (allows all).

## API

### WebSocket Messages (NIP-01)

**Send Event:**
```json
["EVENT", {"id": "...", "pubkey": "...", "created_at": 1234567890, ...}]
```

**Subscribe:**
```json
["REQ", "subscription-id", {"kinds": [1], "limit": 10}]
```

**Close Subscription:**
```json
["CLOSE", "subscription-id"]
```

## Database Schema

```sql
CREATE TABLE events (
  id VARCHAR(64) PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  created_at BIGINT NOT NULL,
  kind INTEGER NOT NULL,
  tags JSONB NOT NULL,
  content TEXT NOT NULL,
  sig VARCHAR(128) NOT NULL,
  received_at TIMESTAMP DEFAULT NOW()
);
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 8080 | WebSocket port |
| HOST | 0.0.0.0 | Bind address |
| POSTGRES_HOST | postgres | PostgreSQL host |
| POSTGRES_PORT | 5432 | PostgreSQL port |
| POSTGRES_DB | nostr | Database name |
| POSTGRES_USER | nostr | Database user |
| POSTGRES_PASSWORD | nostr_secure_password | Database password |
| WHITELIST_PUBKEYS | "" | Comma-separated pubkeys |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run locally (requires PostgreSQL)
npm start

# Development mode with watch
npm run dev
```

## Production Deployment

1. Update passwords in `.env`
2. Set `WHITELIST_PUBKEYS` with allowed pubkeys
3. Use Docker Compose or build Docker image:

```bash
docker build -t nostr-relay .
docker run -d \
  -p 8080:8080 \
  -e POSTGRES_HOST=your-postgres \
  -e WHITELIST_PUBKEYS=pubkey1,pubkey2 \
  nostr-relay
```

## Security Notes

- Change default PostgreSQL password
- Use HTTPS/WSS proxy (nginx/caddy) in production
- Whitelist is mandatory for production use
- No signature verification (trusts clients)
- Event ID verification only (SHA256 check)

## Limitations

- No NIP-42 AUTH implementation
- No rate limiting
- No event deletion
- No relay metadata (NIP-11)
- No federation
- Basic filtering only

## License

MIT
