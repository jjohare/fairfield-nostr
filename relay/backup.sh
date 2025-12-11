#!/bin/bash
# Fairfield Nostr Backup Script
# Run via cron: 0 2 * * * /opt/fairfield/backup.sh

set -euo pipefail

# Configuration
BACKUP_DIR="/var/backups/fairfield"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="fairfield-relay"
DATA_PATH="/data/strfry"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
    exit 1
}

# Check required environment variables
check_env() {
    if [ -z "${RESTIC_REPOSITORY:-}" ]; then
        error "RESTIC_REPOSITORY not set"
    fi
    if [ -z "${RESTIC_PASSWORD:-}" ]; then
        error "RESTIC_PASSWORD not set"
    fi
}

# Initialize restic repository if needed
init_repo() {
    log "Checking restic repository..."
    if ! restic snapshots &>/dev/null; then
        log "Initializing restic repository..."
        restic init || error "Failed to initialize repository"
    fi
}

# Create local backup
create_backup() {
    log "Creating local backup..."
    mkdir -p "$BACKUP_DIR"

    # Create snapshot of LMDB data
    BACKUP_FILE="$BACKUP_DIR/fairfield-$DATE.tar.gz"

    tar -czf "$BACKUP_FILE" \
        -C / \
        "$DATA_PATH" \
        --exclude='*.lock' \
        || error "Failed to create tar archive"

    log "Local backup created: $BACKUP_FILE"
    echo "$BACKUP_FILE"
}

# Upload to cloud storage via restic
upload_backup() {
    local backup_file="$1"

    log "Uploading to cloud storage..."

    restic backup \
        --tag "fairfield" \
        --tag "nostr-relay" \
        --tag "$DATE" \
        "$backup_file" \
        || error "Failed to upload backup"

    log "Upload complete"
}

# Cleanup old backups
cleanup() {
    log "Cleaning up old backups..."

    # Keep last 7 days of local backups
    find "$BACKUP_DIR" -type f -name "fairfield-*.tar.gz" -mtime +7 -delete

    # Prune restic snapshots (keep 7 daily, 4 weekly, 3 monthly)
    restic forget \
        --keep-daily 7 \
        --keep-weekly 4 \
        --keep-monthly 3 \
        --prune \
        || warn "Prune failed, will retry next time"

    log "Cleanup complete"
}

# Verify backup integrity
verify_backup() {
    log "Verifying backup integrity..."

    restic check \
        --read-data-subset=10% \
        || warn "Verification had warnings"

    log "Verification complete"
}

# Main execution
main() {
    log "Starting Fairfield Nostr backup..."

    check_env
    init_repo

    # Create and upload backup
    backup_file=$(create_backup)
    upload_backup "$backup_file"

    # Cleanup and verify
    cleanup
    verify_backup

    log "Backup completed successfully!"

    # Report stats
    restic stats --mode raw-data
}

# Run main function
main "$@"
