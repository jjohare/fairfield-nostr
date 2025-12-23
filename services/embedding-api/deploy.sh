#!/bin/bash
# Deploy Embedding API to Cloud Run
# Usage: ./deploy.sh [tag]
#
# Required environment variables (or set defaults below):
#   GCP_PROJECT_ID - Google Cloud project ID
#   GCP_REGION - GCP region (default: us-central1)
#   ARTIFACT_REPO - Artifact Registry repository name (default: nostr-bbs)
#   SERVICE_ACCOUNT - Service account email for Cloud Run
#   ALLOWED_ORIGINS - CORS allowed origins

set -e

# Configuration - override via environment variables
PROJECT_ID="${GCP_PROJECT_ID:?Error: GCP_PROJECT_ID not set}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="embedding-api"
REPO="${ARTIFACT_REPO:-nostr-bbs}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}"
TAG="${1:-latest}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-}"
ORIGINS="${ALLOWED_ORIGINS:-*}"

echo "=== Embedding API Deployment ==="
echo "Project: ${PROJECT_ID}"
echo "Region: ${REGION}"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo ""

# Check prerequisites
command -v docker >/dev/null 2>&1 || { echo "Error: docker not found"; exit 1; }
command -v gcloud >/dev/null 2>&1 || { echo "Error: gcloud not found"; exit 1; }

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Step 1: Configure Docker for Artifact Registry ==="
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

echo ""
echo "=== Step 2: Build Docker Image ==="
echo "This may take several minutes (PyTorch + ML model)..."
docker build \
    -t ${IMAGE_NAME}:${TAG} \
    -t ${IMAGE_NAME}:latest \
    .

echo ""
echo "=== Step 3: Push to Artifact Registry ==="
docker push ${IMAGE_NAME}:${TAG}
docker push ${IMAGE_NAME}:latest

echo ""
echo "=== Step 4: Deploy to Cloud Run ==="
DEPLOY_ARGS=(
    "--image" "${IMAGE_NAME}:${TAG}"
    "--platform" "managed"
    "--region" "${REGION}"
    "--allow-unauthenticated"
    "--memory" "2Gi"
    "--cpu" "1"
    "--min-instances" "0"
    "--max-instances" "3"
    "--concurrency" "80"
    "--timeout" "60"
    "--set-env-vars" "ALLOWED_ORIGINS=${ORIGINS}"
)

if [ -n "$SERVICE_ACCOUNT" ]; then
    DEPLOY_ARGS+=("--service-account" "${SERVICE_ACCOUNT}")
fi

gcloud run deploy ${SERVICE_NAME} "${DEPLOY_ARGS[@]}"

echo ""
echo "=== Step 5: Verify Deployment ==="
SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "Service URL: ${SERVICE_URL}"
echo ""
echo "Testing health endpoint..."
curl -s "${SERVICE_URL}/health" | jq . 2>/dev/null || curl -s "${SERVICE_URL}/health"

echo ""
echo "=== Deployment Complete ==="
