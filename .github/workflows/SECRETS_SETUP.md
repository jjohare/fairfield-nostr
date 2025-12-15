# GitHub Actions Secrets Setup Guide

## Required Secrets

Go to your repository: **Settings → Secrets and variables → Actions**

### Repository Secrets

| Secret Name | Description | How to Get |
|------------|-------------|------------|
| `GCP_PROJECT_ID` | Your Google Cloud Project ID | Run: `gcloud config get-value project` |
| `GCP_SA_KEY` | Service Account JSON key | See "Generate Service Account Key" below |
| `GCP_REGION` | GCP region for deployments | Example: `us-central1` |

### Repository Variables

| Variable Name | Description | Set After First Deploy |
|--------------|-------------|----------------------|
| `RELAY_URL` | Cloud Run relay WebSocket URL | Yes - from deploy output |
| `EMBEDDING_API_URL` | Cloud Run embedding API URL | Yes - from deploy output |
| `ADMIN_PUBKEY` | Nostr admin public key | Keep existing value |

## Step-by-Step Setup

### 1. Set Your Project ID
```bash
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID
```

### 2. Enable Required APIs
```bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com
```

### 3. Create GitHub Actions Service Account
```bash
gcloud iam service-accounts create github-actions \
  --display-name="GitHub Actions Deployment" \
  --description="Service account for GitHub Actions CI/CD"
```

### 4. Grant Required Permissions
```bash
# Cloud Run Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

# Storage Admin
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

# Artifact Registry Writer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"

# Service Account User
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
```

### 5. Create Embedding API Service Account
```bash
gcloud iam service-accounts create embedding-api \
  --display-name="Embedding API Runtime" \
  --description="Service account for Embedding API Cloud Run service"

# Grant Storage Object Viewer
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:embedding-api@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"
```

### 6. Create Artifact Registry Repository
```bash
gcloud artifacts repositories create nosflare \
  --repository-format=docker \
  --location=us-central1 \
  --description="Docker images for Nosflare relay and embedding API"
```

### 7. Create Storage Bucket
```bash
gcloud storage buckets create gs://minimoonoir-vectors \
  --location=us-central1 \
  --uniform-bucket-level-access

# Make bucket publicly readable (for frontend access)
gcloud storage buckets add-iam-policy-binding gs://minimoonoir-vectors \
  --member="allUsers" \
  --role="roles/storage.objectViewer"
```

### 8. Generate Service Account Key
```bash
gcloud iam service-accounts keys create github-actions-key.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

echo "Service account key created: github-actions-key.json"
echo "Copy the entire contents of this file to GitHub secret: GCP_SA_KEY"
echo ""
cat github-actions-key.json
```

### 9. Add Secrets to GitHub

1. Go to: `https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions`
2. Click "New repository secret"
3. Add each secret:

**GCP_PROJECT_ID:**
```bash
# Copy this value:
echo $PROJECT_ID
```

**GCP_SA_KEY:**
```bash
# Copy the entire JSON from this file:
cat github-actions-key.json
```

**GCP_REGION:**
```
us-central1
```

### 10. Verify Setup
```bash
# List service accounts
gcloud iam service-accounts list

# Verify permissions
gcloud projects get-iam-policy $PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:github-actions@$PROJECT_ID.iam.gserviceaccount.com"

# Check bucket exists
gcloud storage buckets list | grep minimoonoir-vectors

# Check Artifact Registry
gcloud artifacts repositories list --location=us-central1
```

## Security Best Practices

1. **Service Account Keys:**
   - Store only in GitHub Secrets (encrypted)
   - Never commit to version control
   - Rotate periodically (every 90 days recommended)

2. **Least Privilege:**
   - Each service account has only required permissions
   - Runtime service accounts (like embedding-api) have read-only access

3. **Bucket Access:**
   - Public read for frontend embedding access
   - Service accounts can write/admin via IAM roles

4. **Key Rotation:**
```bash
# Delete old key
gcloud iam service-accounts keys list \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

gcloud iam service-accounts keys delete KEY_ID \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com

# Create new key
gcloud iam service-accounts keys create github-actions-key-new.json \
  --iam-account=github-actions@$PROJECT_ID.iam.gserviceaccount.com
```

## Troubleshooting

### Workflow fails with "Permission denied"
- Verify service account has required roles
- Check if APIs are enabled
- Ensure service account key is correctly copied to GitHub secret

### Docker push fails
- Verify Artifact Registry repository exists
- Check repository location matches GCP_REGION
- Ensure github-actions SA has artifactregistry.writer role

### Cloud Run deployment fails
- Check if github-actions SA has run.admin role
- Verify github-actions SA has iam.serviceAccountUser role
- Ensure embedding-api service account exists (for embedding API deployments)

### Storage bucket access issues
- Verify bucket exists: `gcloud storage buckets list`
- Check IAM permissions: `gcloud storage buckets get-iam-policy gs://minimoonoir-vectors`
- Ensure embedding-api SA has storage.objectViewer role

## Next Steps

After setup:
1. Push code to trigger workflows
2. Monitor GitHub Actions runs
3. Copy Cloud Run URLs from deployment outputs
4. Update repository variables (RELAY_URL, EMBEDDING_API_URL)
5. Re-deploy frontend with updated URLs
