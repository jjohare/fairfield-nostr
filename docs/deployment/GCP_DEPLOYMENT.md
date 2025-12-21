---
title: Google Cloud Platform Deployment Guide
description: Step-by-step guide for deploying Nostr-BBS Embedding API to GCP Cloud Run with free tier optimization
category: howto
tags: [deployment, setup, search]
---

# Google Cloud Platform Deployment Guide

**Project**: Nostr-BBS Embedding API
**Service**: Cloud Run (containerized Node.js)
**Cost**: $0/month (100% free tier)
**Last Updated**: 2025-12-15

---

## Quick Start

### 1. Prerequisites

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Authenticate
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable APIs

```bash
gcloud services enable \
  run.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com
```

### 3. Create Infrastructure

```bash
# Create Artifact Registry repository
gcloud artifacts repositories create logseq-repo \
  --repository-format=docker \
  --location=us-central1 \
  --description="Embedding API container images"

# Create Cloud Storage bucket
gcloud storage buckets create gs://YOUR_PROJECT_ID-models \
  --location=us-central1 \
  --storage-class=STANDARD \
  --uniform-bucket-level-access
```

### 4. Deploy

```bash
# Build and deploy in one command
gcloud builds submit --config cloudbuild.yaml

# Get service URL
gcloud run services describe logseq-embeddings \
  --region us-central1 \
  --format 'value(status.url)'
```

---

## Detailed Setup

### Project Structure

```
.
├── cloudbuild/
│   └── Dockerfile          # Container definition
├── cloudbuild.yaml         # Cloud Build configuration
├── embedding-api/
│   ├── package.json
│   └── src/
│       └── index.js        # Express.js API server
└── docs/
    └── gcp-architecture.md # Architecture details
```

### Cloud Build Configuration

**cloudbuild.yaml**:
```yaml
steps:
  # Build Docker image
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'build',
      '-t', 'us-central1-docker.pkg.dev/${PROJECT_ID}/logseq-repo/logseq-embeddings:latest',
      '-f', 'cloudbuild/Dockerfile',
      '.'
    ]

  # Push to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args: [
      'push',
      'us-central1-docker.pkg.dev/${PROJECT_ID}/logseq-repo/logseq-embeddings:latest'
    ]

  # Deploy to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args: [
      'run', 'deploy', 'logseq-embeddings',
      '--image', 'us-central1-docker.pkg.dev/${PROJECT_ID}/logseq-repo/logseq-embeddings:latest',
      '--region', 'us-central1',
      '--platform', 'managed',
      '--allow-unauthenticated',
      '--memory', '512Mi',
      '--cpu', '1',
      '--timeout', '60',
      '--concurrency', '80',
      '--min-instances', '0',
      '--max-instances', '10'
    ]

images:
  - 'us-central1-docker.pkg.dev/${PROJECT_ID}/logseq-repo/logseq-embeddings:latest'
```

### Dockerfile

**cloudbuild/Dockerfile**:
```dockerfile
FROM node:20-slim

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY embedding-api/package*.json ./

# Install production dependencies
RUN npm ci --production

# Copy application code
COPY embedding-api/src ./src

# Configure Cloud Run environment
ENV PORT=8080
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Start server
CMD ["node", "src/index.js"]
```

---

## Testing

### Local Testing with Docker

```bash
# Build image
docker build -t embedding-api -f cloudbuild/Dockerfile .

# Run container
docker run -p 8080:8080 embedding-api

# Test endpoints
curl http://localhost:8080/health
curl -X POST http://localhost:8080/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"test embedding"}'
```

### Cloud Run Testing

```bash
# Get service URL
SERVICE_URL=$(gcloud run services describe logseq-embeddings \
  --region us-central1 \
  --format 'value(status.url)')

# Test health check
curl ${SERVICE_URL}/health

# Test embedding generation
curl -X POST ${SERVICE_URL}/embed \
  -H "Content-Type: application/json" \
  -d '{"text":"hello world"}'
```

---

## Monitoring

### View Logs

```bash
# Real-time logs
gcloud logs tail --service logseq-embeddings --format json

# Filter by severity
gcloud logs read --service logseq-embeddings \
  --filter='severity>=ERROR' \
  --limit 50 \
  --format json
```

### Check Metrics

```bash
# Request count (last 7 days)
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_count"' \
  --format='table(metric.labels.service_name, point.value.int64Value)'

# Latency percentiles
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/request_latencies"' \
  --format='table(metric.labels.service_name, point.value.distributionValue)'
```

### Cost Tracking

```bash
# Check current billing
gcloud billing accounts list

# View cost breakdown
gcloud billing budgets list --billing-account BILLING_ACCOUNT_ID

# Set budget alert at $0.01
gcloud billing budgets create \
  --billing-account BILLING_ACCOUNT_ID \
  --display-name "Embedding API Budget" \
  --budget-amount 0.01 \
  --threshold-rule threshold-percent=0.5 \
  --threshold-rule threshold-percent=1.0
```

---

## Troubleshooting

### Service Not Responding

```bash
# Check service status
gcloud run services describe logseq-embeddings --region us-central1

# View recent revisions
gcloud run revisions list --service logseq-embeddings --region us-central1

# Check logs for errors
gcloud logs read --service logseq-embeddings --limit 50
```

### Cold Start Issues

**Symptom**: 504 Gateway Timeout on first request

**Solutions**:
1. Increase timeout:
   ```bash
   gcloud run services update logseq-embeddings \
     --region us-central1 \
     --timeout 120
   ```

2. Add minimum instances (incurs cost):
   ```bash
   gcloud run services update logseq-embeddings \
     --region us-central1 \
     --min-instances 1
   ```

3. Implement warmup function (recommended):
   ```bash
   # Deploy Cloud Scheduler job to ping every 5 minutes
   gcloud scheduler jobs create http embedding-warmup \
     --schedule "*/5 * * * *" \
     --uri "https://logseq-embeddings-428310134154.us-central1.run.app/health" \
     --http-method GET
   ```

### Build Failures

```bash
# View recent builds
gcloud builds list --limit 10

# Get build logs
gcloud builds log BUILD_ID

# Retry failed build
gcloud builds submit --config cloudbuild.yaml
```

### Permission Errors

```bash
# Grant Cloud Run Invoker role (public access)
gcloud run services add-iam-policy-binding logseq-embeddings \
  --region us-central1 \
  --member="allUsers" \
  --role="roles/run.invoker"

# Grant Cloud Build service account access to Artifact Registry
gcloud artifacts repositories add-iam-policy-binding logseq-repo \
  --location us-central1 \
  --member="serviceAccount:PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

---

## Cost Optimization

### Free Tier Limits

| Resource | Free Tier | Usage Projection | Headroom |
|----------|-----------|------------------|----------|
| Cloud Run Requests | 2M/month | 10K/month | 99.5% |
| Cloud Run CPU | 2M vCPU-sec/month | 100K vCPU-sec | 95% |
| Cloud Run Memory | 360K vCPU-sec/month | 50K vCPU-sec | 86% |
| Cloud Storage | 5GB | 0.022GB | 99.6% |
| Artifact Registry | 0.5GB | 0.15GB | 70% |
| Network Egress | 1GB/month | 0.015GB | 98.5% |

### Cost-Saving Strategies

1. **Scale to Zero**: Keep `--min-instances=0` (default)
2. **Bundle Model in Container**: Avoid Cloud Storage read operations
3. **Use HTTP/2**: Enabled by default on Cloud Run
4. **Compress Responses**: Implement gzip middleware
5. **Cache Embeddings**: Store frequently requested embeddings in Redis

### Budget Alerts

```bash
# Create alert at $0.01 (catches any overage)
gcloud billing budgets create \
  --billing-account BILLING_ACCOUNT_ID \
  --display-name "GCP Embedding API Budget" \
  --budget-amount 0.01 \
  --threshold-rule threshold-percent=0.5 \
  --threshold-rule threshold-percent=0.9 \
  --threshold-rule threshold-percent=1.0 \
  --notification-channel-ids CHANNEL_ID
```

---

## CI/CD Integration

### GitHub Actions Workflow

**.github/workflows/deploy-embedding-api.yml**:
```yaml
name: Deploy Embedding API to Cloud Run

on:
  push:
    branches:
      - main
    paths:
      - 'embedding-api/**'
      - 'cloudbuild/**'
      - 'cloudbuild.yaml'
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Build and Deploy
        run: |
          gcloud builds submit --config cloudbuild.yaml

      - name: Get Service URL
        run: |
          gcloud run services describe logseq-embeddings \
            --region us-central1 \
            --format 'value(status.url)'
```

### Required GitHub Secrets

| Secret | Description | How to Create |
|--------|-------------|---------------|
| `GCP_SA_KEY` | Service account JSON key | See below |

**Create Service Account**:
```bash
# Create service account
gcloud iam service-accounts create github-actions \
  --display-name "GitHub Actions Deployer"

# Grant Cloud Run Admin role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Grant Storage Admin role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Grant Artifact Registry Admin role
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:github-actions@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.admin"

# Generate key
gcloud iam service-accounts keys create key.json \
  --iam-account github-actions@PROJECT_ID.iam.gserviceaccount.com

# Copy key.json content to GitHub Secret GCP_SA_KEY
```

---

## Production Checklist

### Pre-Deployment
- [ ] Create GCP project
- [ ] Enable billing account (free tier)
- [ ] Install gcloud CLI
- [ ] Authenticate with `gcloud auth login`
- [ ] Enable required APIs

### Infrastructure Setup
- [ ] Create Artifact Registry repository
- [ ] Create Cloud Storage bucket
- [ ] Configure IAM permissions
- [ ] Set up budget alerts

### Code Preparation
- [ ] Update `PROJECT_ID` in cloudbuild.yaml
- [ ] Test Docker build locally
- [ ] Verify health check endpoint
- [ ] Test embedding generation

### Deployment
- [ ] Build and push image: `gcloud builds submit`
- [ ] Verify Cloud Run service is running
- [ ] Test API endpoints
- [ ] Update PWA environment variable
- [ ] Test end-to-end integration

### Post-Deployment
- [ ] Monitor Cloud Run metrics
- [ ] Verify free tier usage
- [ ] Set up Cloud Logging dashboards
- [ ] Configure uptime monitoring
- [ ] Document service URL in team wiki

---

## Support and Documentation

### Internal Documentation
- [GCP Architecture Specification](./gcp-architecture.md)
- [General Deployment Guide](./DEPLOYMENT.md)

### External Resources
- [Cloud Run Documentation](https://cloud.google.com/run/docs)
- [Artifact Registry Documentation](https://cloud.google.com/artifact-registry/docs)
- [Cloud Build Documentation](https://cloud.google.com/build/docs)
- [Transformers.js ONNX Runtime](https://huggingface.co/docs/transformers.js)

### Support Channels
- **Issues**: GitHub Issues tab
- **Cloud Console**: https://console.cloud.google.com
- **GCP Support**: https://cloud.google.com/support

---

**Service**: logseq-embeddings
**Region**: us-central1
**Cost**: $0/month (free tier)
**Status**: ✅ Production
