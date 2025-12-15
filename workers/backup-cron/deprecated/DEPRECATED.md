# Deprecated Cloudflare Files

**Date Deprecated**: 2025-12-15

## Reason for Deprecation

These files are deprecated because the Fairfield Nostr project has migrated from Cloudflare Workers infrastructure to Google Cloud Platform (GCP) using Docker-based deployment.

## Migration Context

The backup-cron worker was designed for:
- **Cloudflare Cron Triggers** - Scheduled event execution
- **Cloudflare D1 Database** - SQLite-based database
- **GitHub API** - Backup storage in private repositories

The project now uses:
- **PostgreSQL** for primary data storage
- **Native PostgreSQL backup tools** (pg_dump, point-in-time recovery)
- **GCP Cloud Storage** for backup retention
- **Cloud Scheduler** for scheduled tasks

## Deprecated Files

### wrangler.toml
- **Purpose**: Cloudflare Workers cron trigger configuration
- **Replacement**: GCP Cloud Scheduler + Cloud Run jobs
- **Reason**: Migrated from Cloudflare D1 to PostgreSQL

## Backup Strategy Migration

**Old Strategy** (Cloudflare):
- Cron worker every 6 hours
- Export encrypted events from D1
- Upload JSON to GitHub repository
- 30-day retention policy

**New Strategy** (GCP):
- Continuous WAL archiving for point-in-time recovery
- Daily automated pg_dump snapshots
- GCP Cloud Storage with lifecycle policies
- 90-day retention with automated cleanup

## Cleanup Recommendation

These files can be safely removed once the migration is complete and verified. They are kept temporarily for reference during the transition period.

## Related Files

See also:
- `/nosflare/deprecated/` - Deprecated Cloudflare relay infrastructure
- `/workers/embedding-api/deprecated/` - Deprecated embedding API worker
