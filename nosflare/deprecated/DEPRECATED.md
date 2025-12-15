# Deprecated Cloudflare Infrastructure

**Date Deprecated**: 2025-12-15

## Reason for Deprecation

The Nosflare Cloudflare-based relay infrastructure has been deprecated in favor of a Docker-based deployment on Google Cloud Platform (GCP). The project has evolved from a pure serverless architecture to a more traditional containerized application.

## Migration Context

**Nosflare Architecture** (Cloudflare):
- Cloudflare Workers for WebSocket handling
- Durable Objects (ConnectionDO, SessionManagerDO, EventShardDO, PaymentDO)
- Cloudflare Queues (50 broadcast, 200 indexing, 1 R2 archive)
- Cloudflare R2 for event archival
- Cloudflare D1 for whitelist/cohort access control

**Fairfield Nostr Architecture** (GCP):
- Docker containers with Node.js/Express
- PostgreSQL for relational data
- Vector databases for semantic search
- WebSocket server for real-time communication
- RESTful API for event management

## Deprecated Files

### wrangler.toml
- **Purpose**: Cloudflare Workers configuration with Durable Objects bindings
- **Replacement**: docker-compose.yml and Kubernetes manifests
- **Reason**: No longer using Cloudflare Workers infrastructure

### scripts/deploy.sh
- **Purpose**: Automated deployment to Cloudflare Workers
- **Replacement**: GCP Cloud Build and deployment scripts
- **Reason**: Migrated from Cloudflare Workers to GCP Cloud Run

### scripts/setup-queues.sh
- **Purpose**: Create 254 Cloudflare Queues for event processing
- **Replacement**: PostgreSQL with background job processing
- **Reason**: Simplified architecture without complex queue sharding

## Architecture Migration

### Durable Objects → PostgreSQL Tables

| Cloudflare DO | GCP Replacement |
|---------------|-----------------|
| ConnectionDO | WebSocket session management in-memory |
| SessionManagerDO | PostgreSQL subscriptions table |
| EventShardDO | PostgreSQL events table with indexes |
| PaymentDO | PostgreSQL payments/access table |

### Queues → Background Jobs

| Cloudflare Queue | GCP Replacement |
|------------------|-----------------|
| Broadcast Queues (50) | Event broadcasting via WebSocket server |
| Indexing Queues (200) | PostgreSQL indexing (automatic) |
| R2 Archive Queue | Periodic archival jobs to Cloud Storage |

### Key Differences

**Cloudflare Approach**:
- Distributed, sharded architecture
- 50+ SessionManager shards for parallel subscription matching
- 4 read replicas per 24-hour EventShard
- Complex DO-to-DO communication
- Queue-based event broadcasting

**GCP Approach**:
- Centralized PostgreSQL with proper indexes
- Single source of truth for events and subscriptions
- Simplified WebSocket broadcasting
- Standard database backup/recovery
- RESTful API + WebSocket hybrid

## CFNDB (CloudFlare Nostr Database)

CFNDB was a custom-built database layer using Durable Objects with in-memory indices. It has been replaced with:
- **PostgreSQL** with standard B-tree and GiST indexes
- **Vector databases** for semantic search capabilities
- **Proper database normalization** for relational queries

## NIN (Nostr Indexation Natively)

NIN's native index structures have been replaced with:
- PostgreSQL composite indexes for (kind, pubkey, created_at)
- Tag indexes using PostgreSQL arrays and GIN indexes
- Full-text search using PostgreSQL tsvector
- Vector similarity search using pgvector extension

## Nosflare Directory Status

The entire `/nosflare` directory is considered legacy infrastructure. The following files remain for reference:

**Keep for Reference**:
- `README.md` - Architecture documentation
- `CHANGELOG.md` - Historical changes
- `diagram.html` - Architecture visualization
- `src/*.ts` - Source code for understanding original design

**Not Used in Production**:
- All Cloudflare-specific configurations
- Deployment scripts
- Queue setup scripts

## Cleanup Recommendation

The `/nosflare` directory should be archived or moved to a separate repository for historical reference. It is not used in the current production deployment.

**Suggested Actions**:
1. Archive entire `/nosflare` directory to `/docs/legacy/nosflare-cloudflare/`
2. Create summary document explaining architectural evolution
3. Remove from production codebase once migration is verified
4. Preserve git history for reference

## Related Files

See also:
- `/workers/embedding-api/deprecated/` - Deprecated embedding API worker
- `/workers/backup-cron/deprecated/` - Deprecated backup cron worker

## Contact

For questions about the migration or architectural decisions, refer to project documentation or commit history from December 2024.
