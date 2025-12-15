# Cloud Run Deployment Guide

## Overview

This Nostr relay uses SQLite instead of PostgreSQL, making it perfect for Cloud Run deployment with persistent storage.

## Architecture

- **Database**: SQLite stored in `/data` directory
- **Persistent Storage**: Cloud Run volume mount for SQLite database
- **Backup**: Automatic GCS backup of SQLite file
- **Container**: Single Node.js container (no separate database service)

## Prerequisites

1. Google Cloud Project
2. gcloud CLI installed
3. Docker installed (for local testing)

## Deployment Steps

### 1. Build and Push Container

```bash
# Set your project ID
export PROJECT_ID="your-project-id"
export REGION="us-central1"

# Build the image
cd services/nostr-relay
docker build -t gcr.io/${PROJECT_ID}/nostr-relay:latest .

# Push to Container Registry
docker push gcr.io/${PROJECT_ID}/nostr-relay:latest
```

### 2. Deploy to Cloud Run

```bash
# Deploy with persistent volume
gcloud run deploy nostr-relay \
  --image gcr.io/${PROJECT_ID}/nostr-relay:latest \
  --platform managed \
  --region ${REGION} \
  --port 8080 \
  --execution-environment gen2 \
  --add-volume name=data,type=cloud-storage,bucket=${PROJECT_ID}-nostr-data \
  --add-volume-mount volume=data,mount-path=/data \
  --set-env-vars "SQLITE_DATA_DIR=/data" \
  --set-env-vars "WHITELIST_PUBKEYS=" \
  --allow-unauthenticated \
  --max-instances 10 \
  --memory 512Mi \
  --cpu 1
```

### 3. Set Up Persistent Storage

```bash
# Create GCS bucket for SQLite database
gsutil mb -p ${PROJECT_ID} -l ${REGION} gs://${PROJECT_ID}-nostr-data

# Enable versioning for backups
gsutil versioning set on gs://${PROJECT_ID}-nostr-data
```

### 4. Configure Whitelist (Optional)

```bash
# Update service with whitelisted pubkeys
gcloud run services update nostr-relay \
  --region ${REGION} \
  --set-env-vars "WHITELIST_PUBKEYS=pubkey1,pubkey2,pubkey3"
```

## Local Testing with Docker

```bash
# Build the image
docker build -t nostr-relay:local .

# Run locally with volume mount
docker run -d \
  -p 8080:8080 \
  -v $(pwd)/data:/data \
  -e SQLITE_DATA_DIR=/data \
  -e WHITELIST_PUBKEYS="" \
  --name nostr-relay \
  nostr-relay:local

# View logs
docker logs -f nostr-relay

# Test WebSocket connection
wscat -c ws://localhost:8080

# Stop and remove
docker stop nostr-relay
docker rm nostr-relay
```

## Database Management

### Backup SQLite Database

```bash
# Download database from GCS bucket
gsutil cp gs://${PROJECT_ID}-nostr-data/nostr.db ./backup-$(date +%Y%m%d).db

# Restore from backup
gsutil cp ./backup-20240101.db gs://${PROJECT_ID}-nostr-data/nostr.db
```

### View Database Contents

```bash
# Copy database locally
gsutil cp gs://${PROJECT_ID}-nostr-data/nostr.db ./nostr.db

# Open with sqlite3
sqlite3 nostr.db

# Query events
SELECT COUNT(*) FROM events;
SELECT * FROM events ORDER BY created_at DESC LIMIT 10;
```

## Monitoring

### Cloud Run Metrics

```bash
# View logs
gcloud run services logs read nostr-relay --region ${REGION}

# View metrics in Cloud Console
open "https://console.cloud.google.com/run/detail/${REGION}/nostr-relay/metrics"
```

### Database Size

```bash
# Check database size
gsutil du -h gs://${PROJECT_ID}-nostr-data/nostr.db
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | HTTP server port |
| `HOST` | `0.0.0.0` | Server bind address |
| `SQLITE_DATA_DIR` | `/data` | Directory for SQLite database |
| `WHITELIST_PUBKEYS` | `""` | Comma-separated list of allowed pubkeys |

## Benefits of SQLite on Cloud Run

1. **Simplicity**: Single file database, no separate service
2. **Cost**: No database server costs, only storage
3. **Performance**: Fast local file access
4. **Backups**: GCS versioning provides automatic backups
5. **Portability**: Database file can be easily moved/copied

## Limitations

1. **Concurrency**: SQLite handles concurrent reads well, but writes are serialized
2. **Scaling**: Best for small to medium traffic (WAL mode helps)
3. **Storage**: Limited to Cloud Run volume size (currently up to 100GB)

## Troubleshooting

### Container Won't Start

```bash
# Check logs
gcloud run services logs read nostr-relay --region ${REGION} --limit 50

# Verify environment variables
gcloud run services describe nostr-relay --region ${REGION}
```

### Database Locked Errors

- SQLite uses WAL mode for better concurrency
- Increase `--max-instances` to reduce write contention
- Consider PostgreSQL if write traffic is very high

### Storage Issues

```bash
# Check available storage
gcloud run services describe nostr-relay --region ${REGION} --format="value(spec.template.spec.volumes)"

# Increase volume size if needed
gcloud run services update nostr-relay \
  --region ${REGION} \
  --clear-volumes \
  --add-volume name=data,type=cloud-storage,bucket=${PROJECT_ID}-nostr-data
```

## Cost Estimation

- **Cloud Run**: Pay per request + CPU/memory usage
- **Storage**: GCS Standard Storage pricing (~$0.02/GB/month)
- **Egress**: Standard GCP egress rates

Example: 1M events (~500MB database) ≈ $0.01/month storage

## Security

1. Database file is stored in private GCS bucket
2. Cloud Run service can be protected with IAM
3. Enable HTTPS/WSS in production
4. Regularly backup database file
5. Use whitelist in production environment
