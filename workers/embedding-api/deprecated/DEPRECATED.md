# Deprecated Cloudflare Files

**Date Deprecated**: 2025-12-15

## Reason for Deprecation

These files are deprecated because the Fairfield Nostr project has migrated from Cloudflare Workers infrastructure to Google Cloud Platform (GCP) using Docker-based deployment.

## Migration Context

The project previously used:
- **Cloudflare Workers** for serverless compute
- **Cloudflare Durable Objects** for stateful data
- **Cloudflare R2** for object storage

The project now uses:
- **Google Cloud Run** for containerized deployment
- **PostgreSQL** for relational data
- **Vector databases** for embedding storage
- **Docker** for consistent deployments

## Deprecated Files

### wrangler.toml
- **Purpose**: Cloudflare Workers configuration
- **Replacement**: Docker Compose and GCP deployment configs
- **Reason**: No longer using Cloudflare Workers infrastructure

### .gcloud-setup.md
- **Purpose**: Early GCP setup documentation
- **Replacement**: Main project documentation and deployment guides
- **Reason**: Outdated setup instructions, superseded by current docs

## Embedding API Migration

The embedding API functionality has been integrated into the main application:
- Local embedding generation using transformers.js
- Integration with vector database for semantic search
- RESTful API endpoints for embedding operations

## Cleanup Recommendation

These files can be safely removed once the migration is complete and verified. They are kept temporarily for reference during the transition period.

## Related Files

See also:
- `/nosflare/deprecated/` - Deprecated Cloudflare relay infrastructure
- `/workers/backup-cron/deprecated/` - Deprecated backup cron worker
