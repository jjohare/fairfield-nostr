# Nostr Relay Service - Internal Docker Deployment

**Private, whitelist-only relay with PostgreSQL storage. No external relay connections.**

## Features

- ✅ **Private Access**: Whitelist-only, no federation with external relays
- ✅ **Point-to-Point**: Direct communication within the application
- ✅ **PostgreSQL Storage**: Persistent event and whitelist storage
- ✅ **NIP Support**: NIP-01, NIP-02, NIP-09, NIP-11, NIP-17, NIP-25, NIP-28, NIP-42, NIP-44, NIP-52, NIP-59
- ✅ **Docker Deployment**: Easy containerized deployment
- ✅ **Rate Limiting**: Protection against abuse
- ✅ **WebSocket**: Real-time event streaming

## Architecture

```mermaid
graph TB
    subgraph Docker["Docker Container"]
        Relay["Nostr Relay<br/>ws://localhost:8008"]
        PG["PostgreSQL<br/>Database"]
    end

    subgraph Frontend["SvelteKit PWA"]
        PWA["Web Application"]
        IDB["IndexedDB<br/>Local Cache"]
    end

    PWA <-->|WebSocket| Relay
    Relay <-->|SQL| PG
    PWA <-->|Cache| IDB

    style Docker fill:#2496ed,color:#fff
    style Frontend fill:#1e40af,color:#fff
```

## Quick Start

### Prerequisites

- Docker 20+
- Docker Compose 2+
- Node.js 20+ (for development)

### 1. Start Services

```bash
cd services/nostr-relay

# Start PostgreSQL and relay
docker compose up -d

# View logs
docker compose logs -f
```

### 2. Verify Services

```bash
# Check service status
docker compose ps

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     http://localhost:8008

# Test NIP-11 relay info
curl http://localhost:8008 -H "Accept: application/nostr+json"
```

Expected NIP-11 response:
```json
{
  "name": "Minimoonoir Relay",
  "description": "Private community relay with whitelist access",
  "pubkey": "",
  "contact": "",
  "supported_nips": [1, 2, 9, 11, 17, 25, 28, 42, 44, 52, 59],
  "software": "minimoonoir-relay",
  "version": "1.0.0",
  "limitation": {
    "max_message_length": 16384,
    "max_subscriptions": 20,
    "max_filters": 100,
    "max_subid_length": 100,
    "min_pow_difficulty": 0,
    "auth_required": true,
    "payment_required": false
  }
}
```

### 3. Add Admin to Whitelist

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U nostr -d nostr_relay

# Add admin user
INSERT INTO whitelist (pubkey, cohorts, added_at, added_by)
VALUES ('your-admin-pubkey-hex', '["admin"]', EXTRACT(EPOCH FROM NOW()), 'system');

# Verify
SELECT * FROM whitelist;

# Exit
\q
```

## Configuration

### Environment Variables

Create `.env` file in `services/nostr-relay`:

```bash
# PostgreSQL Configuration
POSTGRES_USER=nostr
POSTGRES_PASSWORD=your-secure-password-here
POSTGRES_DB=nostr_relay

# Relay Configuration
DATABASE_URL=postgresql://nostr:your-secure-password-here@postgres:5432/nostr_relay
RELAY_PORT=8008
RELAY_NAME=Minimoonoir Relay
RELAY_DESCRIPTION=Private community relay with whitelist access
RELAY_PUBKEY=
RELAY_CONTACT=

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000

# Node Environment
NODE_ENV=production
```

### Docker Compose Configuration

`docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: nostr-relay-db
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-nostr}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-changeme}
      POSTGRES_DB: ${POSTGRES_DB:-nostr_relay}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./schema.sql:/docker-entrypoint-initdb.d/schema.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U nostr"]
      interval: 10s
      timeout: 5s
      retries: 5

  relay:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nostr-relay
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      RELAY_PORT: ${RELAY_PORT:-8008}
      RELAY_NAME: ${RELAY_NAME:-Minimoonoir Relay}
      RELAY_DESCRIPTION: ${RELAY_DESCRIPTION:-Private community relay}
      RELAY_PUBKEY: ${RELAY_PUBKEY:-}
      RELAY_CONTACT: ${RELAY_CONTACT:-}
      NODE_ENV: ${NODE_ENV:-production}
    ports:
      - "8008:8008"
    restart: unless-stopped

volumes:
  postgres-data:
```

## Database Management

### Schema

The relay uses the following PostgreSQL schema:

```sql
-- Whitelist table for access control
CREATE TABLE IF NOT EXISTS whitelist (
  pubkey TEXT PRIMARY KEY,
  cohorts JSONB NOT NULL DEFAULT '[]'::jsonb,
  added_at BIGINT NOT NULL,
  added_by TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Events table for Nostr events
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  kind INTEGER NOT NULL,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  content TEXT NOT NULL,
  sig TEXT NOT NULL,
  stored_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_whitelist_cohorts ON whitelist USING gin(cohorts);
```

### Database Operations

**View Whitelist**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c "SELECT * FROM whitelist;"
```

**Add User**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c \
  "INSERT INTO whitelist (pubkey, cohorts, added_at, added_by) \
   VALUES ('user-pubkey-hex', '[\"members\"]', EXTRACT(EPOCH FROM NOW()), 'admin-pubkey');"
```

**Update User Cohorts**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c \
  "UPDATE whitelist SET cohorts = '[\"admin\", \"members\"]' WHERE pubkey = 'user-pubkey-hex';"
```

**Remove User**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c \
  "DELETE FROM whitelist WHERE pubkey = 'user-pubkey-hex';"
```

**View Events**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c "SELECT id, kind, created_at FROM events ORDER BY created_at DESC LIMIT 10;"
```

**Backup Database**:
```bash
# Full backup
docker compose exec postgres pg_dump -U nostr nostr_relay > backup_$(date +%Y%m%d_%H%M%S).sql

# Whitelist only
docker compose exec postgres pg_dump -U nostr -d nostr_relay -t whitelist > whitelist_backup.sql
```

**Restore Database**:
```bash
docker compose exec -T postgres psql -U nostr nostr_relay < backup.sql
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL only
docker compose up postgres -d

# Run relay in development mode
npm run dev

# View logs
npm run dev | bunyan
```

### Build Container

```bash
# Build locally
docker build -t nostr-relay:latest .

# Build with Docker Compose
docker compose build
```

### Run Tests

```bash
# Unit tests
npm run test:unit

# Integration tests (requires PostgreSQL)
npm run test:integration

# Performance tests
npm run test:performance

# All tests
npm test

# Coverage
npm run test:coverage
```

## Monitoring

### View Logs

```bash
# All services
docker compose logs -f

# Relay only
docker compose logs -f relay

# PostgreSQL only
docker compose logs -f postgres

# Last 100 lines
docker compose logs --tail 100
```

### Health Check

```bash
# Relay health
curl http://localhost:8008/health

# PostgreSQL health
docker compose exec postgres pg_isready -U nostr
```

## Security

### Whitelist Enforcement

The relay enforces whitelist-only access:
- All write operations require authenticated pubkey in whitelist
- Read operations can be restricted per configuration
- Cohort-based access control for advanced features

### Rate Limiting

Rate limiting is enabled by default:
- **Max Requests**: 100 per minute per IP
- **Window**: 60 seconds
- **Block Duration**: 5 minutes

Configure in `.env`:
```bash
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=60000
```

### PostgreSQL Security

**Best Practices**:
1. Change default password in `.env`
2. Use strong passwords (20+ characters)
3. Restrict network access (bind to localhost only)
4. Regular backups
5. Monitor access logs

**Production Deployment**:
```yaml
# docker-compose.prod.yml
services:
  postgres:
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}  # From secrets
    # Bind to internal network only (no exposed ports)
    # Use Docker secrets for credentials
```

## Troubleshooting

### Relay Won't Start

**Check logs**:
```bash
docker compose logs relay
```

**Common issues**:
- Database connection error: Verify `DATABASE_URL`
- Port conflict: Check if port 8008 is available
- Missing dependencies: Rebuild container

### Database Connection Fails

**Verify PostgreSQL is running**:
```bash
docker compose ps postgres
docker compose exec postgres pg_isready -U nostr
```

**Check connection string**:
```bash
docker compose exec relay env | grep DATABASE_URL
```

**Reset database**:
```bash
docker compose down -v
docker compose up -d
```

### WebSocket Connection Issues

**Test with curl**:
```bash
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     http://localhost:8008
```

**Check CORS headers**:
```bash
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: GET" \
     -H "Access-Control-Request-Headers: X-Requested-With" \
     -X OPTIONS http://localhost:8008
```

## Production Deployment

### Checklist

- [ ] Change default PostgreSQL password
- [ ] Configure rate limiting
- [ ] Set up database backups (daily)
- [ ] Configure log rotation
- [ ] Set up monitoring/alerts
- [ ] Restrict network access (firewall)
- [ ] Enable HTTPS (reverse proxy)
- [ ] Test whitelist enforcement
- [ ] Test rate limiting
- [ ] Load testing (optional)

### Reverse Proxy (Nginx)

For production, use Nginx as a reverse proxy with HTTPS:

```nginx
upstream nostr_relay {
    server localhost:8008;
}

server {
    listen 443 ssl http2;
    server_name relay.yourdomain.com;

    ssl_certificate /etc/ssl/certs/relay.crt;
    ssl_certificate_key /etc/ssl/private/relay.key;

    location / {
        proxy_pass http://nostr_relay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }
}
```

## Documentation

For complete deployment guide, see **[../../docs/DEPLOYMENT.md](../../docs/DEPLOYMENT.md)**

## Support

- **Issues**: https://github.com/jjohare/minimoonoir/issues
- **Documentation**: https://github.com/jjohare/minimoonoir/tree/main/docs
- **Nostr Protocol**: https://github.com/nostr-protocol/nips

## License

MIT License - see [LICENSE](../../LICENSE) for details.

---

**Version**: 1.0.0
**Last Updated**: 2025-12-15
**Status**: Production Ready
