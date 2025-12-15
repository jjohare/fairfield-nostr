# GitHub Actions Workflows - GCP Deployment

## Overview

This project uses GitHub Actions for CI/CD with Google Cloud Platform (GCP) as the deployment target. All Cloudflare-specific workflows have been deprecated in favor of GCP Cloud Run.

## Workflow Files

### Active Workflows

#### 1. `deploy-relay-gcp.yml` - Nostr Relay Deployment

Deploys the Nosflare Nostr relay to GCP Cloud Run.

**Triggers:**
- Push to `main` branch with changes to `nosflare/**`
- Manual workflow dispatch

**Deployment:**
- **Service**: `nosflare-relay`
- **Platform**: GCP Cloud Run
- **Region**: `us-central1` (configurable)
- **Artifact Registry**: `nosflare` repository
- **Image**: `{region}-docker.pkg.dev/{project}/nosflare/nosflare-relay:{sha|latest}`

**Configuration:**
- Memory: 512Mi
- CPU: 1
- Min instances: 0
- Max instances: 10
- Concurrency: 80
- Timeout: 300s

#### 2. `deploy-embedding-api.yml` - Embedding API Deployment

Deploys the Python-based embedding API to GCP Cloud Run.

**Triggers:**
- Push to `main` branch with changes to `services/embedding-api/**`
- Manual workflow dispatch

**Deployment:**
- **Service**: `embedding-api`
- **Platform**: GCP Cloud Run
- **Region**: `us-central1` (configurable)
- **Artifact Registry**: `minimoonoir` repository
- **Image**: `{region}-docker.pkg.dev/{project}/minimoonoir/embedding-api:{sha|latest}`

**Configuration:**
- Memory: 2Gi
- CPU: 1
- Min instances: 0
- Max instances: 3
- Concurrency: 80
- Timeout: 60s
- CORS: Configured for GitHub Pages and localhost

#### 3. `generate-embeddings.yml` - Embedding Generation

Generates note embeddings and uploads to Google Cloud Storage.

**Triggers:**
- Scheduled: Daily at 3 AM UTC
- Manual workflow dispatch with optional full rebuild

**Process:**
1. Download previous manifest from GCS
2. Fetch new notes from Nostr relay
3. Generate embeddings using `sentence-transformers/all-MiniLM-L6-v2`
4. Build HNSW index
5. Upload to GCS bucket `minimoonoir-vectors`

**GCS Structure:**
```
gs://minimoonoir-vectors/
  ├── v{version}/
  │   ├── index.bin
  │   ├── embeddings.npz
  │   └── manifest.json
  └── latest/  (symlink to latest version)
```

#### 4. `deploy-pages.yml` - GitHub Pages Deployment

Deploys the SvelteKit frontend to GitHub Pages.

**Triggers:**
- Push to `main` branch (excluding `nosflare/**`)
- Manual workflow dispatch

**Environment Variables:**
- `VITE_RELAY_URL`: WebSocket URL of Nostr relay
- `VITE_EMBEDDING_API_URL`: HTTPS URL of embedding API
- `VITE_ADMIN_PUBKEY`: Admin public key (hex format)
- `VITE_APP_NAME`: Application name
- `BASE_PATH`: Repository name for GitHub Pages

### Deprecated Workflows

#### `deploy-relay.yml` - [DEPRECATED]

**Status**: Deprecated - migrated to GCP Cloud Run

This workflow previously deployed the Nostr relay to Cloudflare Workers. It has been replaced by `deploy-relay-gcp.yml`.

**Migration Notes:**
- Changed from Cloudflare Workers to GCP Cloud Run
- Changed from `wrangler` to `gcloud` CLI
- Changed from environment variables to Cloud Run configuration
- Changed from Workers KV to PostgreSQL/Redis

The workflow now shows a deprecation notice if manually triggered.

## Required GitHub Secrets

Configure these in: **Settings → Secrets and variables → Actions → Secrets**

### GCP Authentication
- `GCP_PROJECT_ID`: Your Google Cloud Project ID
- `GCP_SA_KEY`: Service Account JSON key with required permissions
- `GCP_REGION` (optional): GCP region (defaults to `us-central1`)

### Service Account Permissions

The service account requires these IAM roles:

```bash
# For Cloud Run deployments
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/run.admin"

# For Artifact Registry
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/artifactregistry.writer"

# For Storage (embeddings workflow)
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/storage.objectAdmin"

# For service account usage
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:SA_EMAIL" \
  --role="roles/iam.serviceAccountUser"
```

## Required GitHub Variables

Configure these in: **Settings → Secrets and variables → Actions → Variables**

### Frontend Configuration
- `RELAY_URL`: WebSocket URL of deployed Nostr relay
  - Example: `wss://nosflare-relay-xxx.run.app`
  - Used by: `deploy-pages.yml`, `generate-embeddings.yml`

- `EMBEDDING_API_URL`: HTTPS URL of deployed embedding API
  - Example: `https://embedding-api-xxx.run.app`
  - Used by: `deploy-pages.yml`

- `ADMIN_PUBKEY`: Nostr admin public key (hex format)
  - Example: `npub1...` converted to hex
  - Used by: `deploy-pages.yml`

## Deployment Order

When setting up from scratch:

1. **Deploy Relay**: `deploy-relay-gcp.yml`
   - Get WebSocket URL from deployment output
   - Update `RELAY_URL` variable

2. **Deploy Embedding API**: `deploy-embedding-api.yml`
   - Get HTTPS URL from deployment output
   - Update `EMBEDDING_API_URL` variable

3. **Generate Embeddings**: `generate-embeddings.yml`
   - Run manually with `full_rebuild: true`
   - Verify GCS bucket created and populated

4. **Deploy Frontend**: `deploy-pages.yml`
   - Automatically uses URLs from variables
   - Publishes to GitHub Pages

## GCP Resources Required

### Artifact Registry Repositories

Create two Artifact Registry repositories:

```bash
# For Nostr relay
gcloud artifacts repositories create nosflare \
  --repository-format=docker \
  --location=us-central1 \
  --description="Nosflare Nostr relay images"

# For embedding API
gcloud artifacts repositories create minimoonoir \
  --repository-format=docker \
  --location=us-central1 \
  --description="Minimoonoir embedding API images"
```

### Cloud Storage Bucket

Create bucket for embeddings:

```bash
gcloud storage buckets create gs://minimoonoir-vectors \
  --location=us-central1 \
  --uniform-bucket-level-access

# Make bucket publicly readable (for embedding access)
gcloud storage buckets add-iam-policy-binding gs://minimoonoir-vectors \
  --member=allUsers \
  --role=roles/storage.objectViewer
```

### Cloud Run Services

Services are automatically created by workflows, but can be pre-created:

```bash
# Services will be created by GitHub Actions workflows
# with proper configuration (memory, CPU, scaling, etc.)
```

## Workflow Outputs

Each deployment workflow provides outputs in the GitHub Actions summary:

### Relay Deployment
- Service name
- Region
- Branch and commit
- **Service URL** (WebSocket endpoint)

### Embedding API Deployment
- Service name
- Region
- Branch and commit
- **Service URL** (HTTPS endpoint)
- Next steps for configuration

### Embedding Generation
- Model information
- Notes processed
- Index version
- Total vectors
- Index size
- GCS public URL

## Troubleshooting

### Workflow Failures

**Authentication errors:**
```bash
# Verify service account key is valid JSON
echo "$GCP_SA_KEY" | jq .

# Verify service account has required permissions
gcloud projects get-iam-policy PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:SA_EMAIL"
```

**Docker push errors:**
```bash
# Verify Artifact Registry repositories exist
gcloud artifacts repositories list --location=us-central1

# Verify Docker authentication
gcloud auth configure-docker us-central1-docker.pkg.dev
```

**Cloud Run deployment errors:**
```bash
# Check Cloud Run service logs
gcloud run services logs read SERVICE_NAME \
  --region=us-central1 \
  --limit=50

# Verify service configuration
gcloud run services describe SERVICE_NAME \
  --region=us-central1
```

### Variable Configuration

**Missing URLs in frontend:**
- Verify `RELAY_URL` and `EMBEDDING_API_URL` are set in GitHub variables
- Check deployment summaries for actual URLs
- URLs must include protocol (`wss://` or `https://`)

**CORS errors:**
- Verify `ALLOWED_ORIGINS` in embedding API deployment
- Update if GitHub Pages URL changes
- Test with: `curl -H "Origin: https://yourusername.github.io" SERVICE_URL/health`

## Migration from Cloudflare

If migrating from Cloudflare Workers:

1. **Remove Cloudflare secrets:**
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

2. **Add GCP secrets:**
   - `GCP_PROJECT_ID`
   - `GCP_SA_KEY`
   - `GCP_REGION` (optional)

3. **Update variables:**
   - Change `RELAY_URL` from `wss://*.workers.dev` to `wss://*.run.app`
   - Change `EMBEDDING_API_URL` from Cloudflare R2 to Cloud Run

4. **Data migration:**
   - Export data from Workers KV/D1
   - Import to GCP Cloud SQL/Firestore
   - Migrate R2 objects to GCS

5. **DNS updates:**
   - Update custom domains to point to Cloud Run
   - Configure Cloud Run domain mappings

## Monitoring

### GitHub Actions
- View workflow runs: **Actions** tab
- Check deployment summaries
- Review job logs for errors

### GCP Console
- Cloud Run services: https://console.cloud.google.com/run
- Artifact Registry: https://console.cloud.google.com/artifacts
- Cloud Storage: https://console.cloud.google.com/storage
- Logs: https://console.cloud.google.com/logs

### Service Health
```bash
# Check relay health
curl -I https://nosflare-relay-xxx.run.app/

# Check embedding API health
curl https://embedding-api-xxx.run.app/health

# Check embeddings in GCS
curl https://storage.googleapis.com/minimoonoir-vectors/latest/manifest.json
```

## Cost Optimization

- Cloud Run scales to zero when not in use
- Artifact Registry only charges for storage
- GCS bucket costs depend on storage and egress
- Monitor costs: https://console.cloud.google.com/billing

**Estimated monthly costs (low traffic):**
- Cloud Run: $0-5 (free tier covers most)
- Artifact Registry: $0-1 (per GB stored)
- Cloud Storage: $0-2 (per GB stored + egress)
- Total: ~$0-10/month for development
