# GitHub Actions GCP Migration Summary

## Overview
Migrated GitHub Actions workflows from Cloudflare Workers/R2 to Google Cloud Platform (Cloud Run + Cloud Storage).

## Updated Workflows

### 1. generate-embeddings.yml
**Changes:**
- Replaced Cloudflare R2 with Google Cloud Storage (GCS)
- Changed bucket: `minimoonoir-embeddings` → `minimoonoir-vectors`
- Replaced `boto3` with `google-cloud-storage` Python library
- Added GCP authentication using `google-github-actions/auth@v2`
- Updated script call: `upload_to_r2.py` → `upload_to_gcs.py`

**Required Secrets:**
- `GCP_PROJECT_ID`: Google Cloud Project ID
- `GCP_SA_KEY`: Service Account JSON key (needs Storage Object Admin role)
- `GCP_REGION`: GCP region (default: us-central1)

### 2. deploy-pages.yml
**Changes:**
- Updated environment variables to point to Cloud Run services
- Added `VITE_EMBEDDING_API_URL` for embedding API endpoint
- Changed `VITE_RELAY_URL` to use Cloud Run URL (placeholder until deployed)

**Frontend still deploys to GitHub Pages** (no change)

### 3. deploy-relay-gcp.yml (NEW)
**Purpose:** Deploy Nosflare relay to Cloud Run
**Replaces:** deploy-relay.yml (Cloudflare Workers version still exists)

**Features:**
- Builds Docker image for relay
- Pushes to Artifact Registry
- Deploys to Cloud Run with:
  - 512Mi memory, 1 CPU
  - Auto-scaling: 0-10 instances
  - 80 concurrent requests
  - 300s timeout

**Required Secrets:** Same as #1 above, plus Cloud Run Admin role

### 4. deploy-embedding-api.yml (NEW)
**Purpose:** Deploy embedding API to Cloud Run

**Features:**
- Builds Docker image with TypeScript compilation
- Pushes to Artifact Registry
- Deploys to Cloud Run with:
  - 2Gi memory, 2 CPUs (for ML model)
  - Auto-scaling: 0-5 instances
  - 10 concurrent requests (resource-intensive)
  - 300s timeout
- Sets environment variables:
  - `NODE_ENV=production`
  - `GCS_BUCKET_NAME=minimoonoir-vectors`

**Required Secrets:** Same as #1, plus service account: `embedding-api@{PROJECT_ID}.iam.gserviceaccount.com`

## New Files Created

1. `/home/devuser/workspace/fairfield-nostr/.github/workflows/deploy-relay-gcp.yml`
2. `/home/devuser/workspace/fairfield-nostr/.github/workflows/deploy-embedding-api.yml`
3. `/home/devuser/workspace/fairfield-nostr/nosflare/Dockerfile`

## Required GitHub Repository Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
GCP_PROJECT_ID       # Your GCP project ID
GCP_SA_KEY           # Service account JSON key (see IAM setup below)
GCP_REGION           # Deployment region (e.g., us-central1)
```

## Required GitHub Repository Variables

Update these variables after first deployment:

```
RELAY_URL            # Cloud Run URL for relay (e.g., https://nosflare-relay-xxx.run.app)
EMBEDDING_API_URL    # Cloud Run URL for embedding API
ADMIN_PUBKEY         # Keep existing value
```

## GCP Setup Required

### 1. Create Service Account
```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment"
```

### 2. Grant Permissions
```bash
PROJECT_ID="your-project-id"

# Storage permissions for embeddings
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Cloud Run permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Artifact Registry permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Service Account User (to deploy Cloud Run)
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 3. Create Service Account for Embedding API
```bash
gcloud iam service-accounts create embedding-api \
  --display-name="Embedding API Service Account"

# Grant Storage Object Viewer role
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:embedding-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

### 4. Create Artifact Registry Repository
```bash
gcloud artifacts repositories create nosflare \
  --repository-format=docker \
  --location=us-central1 \
  --description="Nosflare Docker images"
```

### 5. Create GCS Bucket
```bash
gcloud storage buckets create gs://minimoonoir-vectors \
  --location=us-central1 \
  --uniform-bucket-level-access
```

### 6. Generate Service Account Key
```bash
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Copy the contents of github-actions-key.json to GitHub secret GCP_SA_KEY
cat github-actions-key.json
```

## Python Scripts to Update

The following Python scripts need to be created/updated:

### `/home/devuser/workspace/fairfield-nostr/scripts/embeddings/upload_to_gcs.py`
Replace boto3 with google-cloud-storage:

```python
from google.cloud import storage
import argparse

def upload_to_gcs(bucket_name, files, prefix):
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    for file_path in files:
        blob = bucket.blob(f"{prefix}/{file_path}")
        blob.upload_from_filename(file_path)
        print(f"Uploaded {file_path} to {prefix}/{file_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--bucket", required=True)
    parser.add_argument("--files", nargs="+", required=True)
    parser.add_argument("--prefix", required=True)
    args = parser.parse_args()
    
    upload_to_gcs(args.bucket, args.files, args.prefix)
```

### `/home/devuser/workspace/fairfield-nostr/scripts/embeddings/download_manifest.py`
Update to use GCS instead of R2:

```python
from google.cloud import storage
import json
import os

def download_manifest(bucket_name="minimoonoir-vectors"):
    client = storage.Client()
    bucket = client.bucket(bucket_name)
    
    # Find latest version manifest
    blobs = list(bucket.list_blobs(prefix="v"))
    if not blobs:
        return {"version": 0, "last_event_id": None}
    
    # Get the latest manifest
    latest_blob = max(blobs, key=lambda b: b.name)
    manifest_content = latest_blob.download_as_string()
    
    return json.loads(manifest_content)

if __name__ == "__main__":
    manifest = download_manifest()
    with open("manifest.json", "w") as f:
        json.dump(manifest, f)
```

## Deployment Workflow

1. **First-time setup:**
   - Complete GCP setup steps above
   - Add secrets to GitHub repository
   - Push code to trigger workflows

2. **Deploy embedding API:**
   - Workflow triggers on push to `workers/embedding-api/**`
   - Builds Docker image
   - Deploys to Cloud Run
   - Copy service URL from deployment summary

3. **Deploy relay:**
   - Workflow triggers on push to `nosflare/**`
   - Builds Docker image
   - Deploys to Cloud Run
   - Copy service URL from deployment summary

4. **Update repository variables:**
   - Set `RELAY_URL` to relay Cloud Run URL
   - Set `EMBEDDING_API_URL` to embedding API Cloud Run URL

5. **Deploy frontend:**
   - Workflow triggers automatically
   - Builds with updated URLs
   - Deploys to GitHub Pages

## Testing Checklist

- [ ] GCP service account created with proper roles
- [ ] GitHub secrets configured
- [ ] Artifact Registry repository created
- [ ] GCS bucket created
- [ ] Embedding API deploys successfully
- [ ] Relay deploys successfully
- [ ] Frontend builds with correct URLs
- [ ] Embedding generation workflow runs successfully
- [ ] Vectors uploaded to GCS bucket
- [ ] Embedding API can read from GCS bucket

## Cost Considerations

**Cloud Run:**
- Relay: Low cost (mostly idle with auto-scaling to 0)
- Embedding API: Higher cost (2Gi memory for ML model)
- Both have 300s timeout for long-running requests

**Cloud Storage:**
- Standard storage class
- Minimal egress costs (internal GCP access)

**Artifact Registry:**
- Storage costs for Docker images
- No egress costs for Cloud Run deployments in same region

## Migration Notes

- Cloudflare Workers deployment workflow (`deploy-relay.yml`) is unchanged
- Can run both Cloudflare and GCP deployments simultaneously
- GCP workflows use `-gcp` suffix to distinguish from Cloudflare versions
- Frontend deployment updated to support both backends via environment variables
