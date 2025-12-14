# Minimoonoir Nosflare Customization

This directory contains a customized version of [nosflare](https://github.com/Spl0itable/nosflare) configured for private community relay operation on Cloudflare's free tier.

## Changes from Upstream

### 1. Free Tier Configuration (`wrangler.toml`)

**Removed (require paid plan):**
- All queue bindings (40+ queues require $5/mo Workers Paid)
- R2 bucket (commented out, optional)
- Payment Durable Object

**Added:**
- D1 database binding for whitelist/cohort access control
- SQLite-backed Durable Objects (`new_sqlite_classes`)
- Environment variables for private relay mode

### 2. Private Relay Settings

```toml
PAY_TO_RELAY_ENABLED = "false"   # Disable payment system
AUTH_REQUIRED = "true"           # Require NIP-42 authentication
EXTERNAL_RELAY_SYNC = "false"    # Don't sync with public relays
FREE_TIER_MODE = "true"          # Use direct DO calls instead of queues
```

### 3. D1 Database Schema (`schema.sql`)

Custom schema for community access control:

| Table | Purpose |
|-------|---------|
| `whitelist` | Pubkey-based access control with cohort membership |
| `channels` | NIP-28 channel metadata with cohort restrictions |
| `channel_members` | Private channel membership |
| `calendar_events` | NIP-52 calendar events with cohort visibility |
| `calendar_rsvps` | Event RSVP tracking |
| `cohorts` | Cohort definitions and permissions |
| `admin_settings` | Relay configuration |
| `audit_log` | Admin action tracking |

### 4. Cohort System

Three default cohorts with different permissions:

| Cohort | Description | Permissions |
|--------|-------------|-------------|
| `admin` | Full access | read, write, delete, manage_users, manage_channels, manage_events |
| `business` | Business community | read, write, delete_own, create_events |
| `moomaa-tribe` | Community group | read, write, delete_own, create_events |

## Deployment

### Prerequisites

- Cloudflare account (free tier works)
- wrangler CLI installed: `npm install -g wrangler`
- Already authenticated: `wrangler login`

### First Time Setup

```bash
# From this directory (nosflare/)

# 1. Create D1 database
wrangler d1 create minimoonoir
# Note the database_id and update wrangler.toml

# 2. Apply schema
wrangler d1 execute minimoonoir --file=schema.sql

# 3. Add admin to whitelist
wrangler d1 execute minimoonoir --command="
INSERT INTO whitelist (pubkey, cohorts, added_at, added_by)
VALUES ('YOUR_HEX_PUBKEY', '[\"admin\"]', unixepoch(), 'system')
"

# 4. Deploy
wrangler deploy
```

### Updating

```bash
# Pull latest from this repo, then:
wrangler deploy
```

## Storage Limits (Free Tier)

| Resource | Limit | Notes |
|----------|-------|-------|
| Durable Objects | 1GB per DO, 10GB total | Events stored in EventShardDO |
| D1 Database | 5GB | Whitelist, channels, metadata |
| Workers Requests | 100k/day | WebSocket upgrades count |
| KV Storage | 1GB | Not currently used |

**Estimated Capacity:**
- ~50,000-100,000 text messages
- ~1,000 calendar events
- ~10,000 whitelisted users

## Credits

### Core Infrastructure

- [nosflare](https://github.com/Spl0itable/nosflare) - Original Cloudflare Workers Nostr relay by [@Spl0itable](https://github.com/Spl0itable)
- [Cloudflare Workers](https://workers.cloudflare.com) - Edge computing platform
- [Cloudflare D1](https://developers.cloudflare.com/d1) - Serverless SQLite database
- [Cloudflare Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects) - Stateful serverless storage

### Development Tools

- [Agentic QE Fleet](https://github.com/proffesor-for-testing/agentic-qe) - AI-powered quality engineering agents
- [Claude Code](https://claude.ai/claude-code) - AI-assisted development by Anthropic
- [Claude Flow](https://github.com/ruvnet/claude-flow) - Swarm coordination for parallel development

### Protocol

- [Nostr Protocol](https://nostr.com) - Decentralized social protocol
- [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) - Authentication
- [NIP-28](https://github.com/nostr-protocol/nips/blob/master/28.md) - Public Chat Channels
- [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md) - Calendar Events
