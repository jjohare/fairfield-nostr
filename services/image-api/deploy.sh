#!/bin/bash
# Deploy Image API to Cloud Run
# Usage: ./deploy.sh [tag]
#
# Required environment variables:
#   GCP_PROJECT_ID - Google Cloud project ID
#   GCS_BUCKET - Cloud Storage bucket for images
#
# Optional environment variables:
#   GCP_REGION - GCP region (default: us-central1)
#   ARTIFACT_REPO - Artifact Registry repository name (default: nostr-bbs)
#   SERVICE_ACCOUNT - Service account email for Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:?Error: GCP_PROJECT_ID not set}"
GCS_BUCKET="${GCS_BUCKET:?Error: GCS_BUCKET not set}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="image-api"
REPO="${ARTIFACT_REPO:-nostr-bbs}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}"
TAG="${1:-latest}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-}"

echo "=== Image API Deployment ==="
echo "Project: ${PROJECT_ID}"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo "GCS Bucket: ${GCS_BUCKET}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

echo "Building..."
docker build -t ${IMAGE_NAME}:${TAG} -t ${IMAGE_NAME}:latest .

echo "Pushing..."
docker push ${IMAGE_NAME}:${TAG}
docker push ${IMAGE_NAME}:latest

echo "Deploying..."
DEPLOY_ARGS=(
    "--image" "${IMAGE_NAME}:${TAG}"
    "--region" "${REGION}"
    "--platform" "managed"
    "--allow-unauthenticated"
    "--memory" "512Mi"
    "--cpu" "1"
    "--max-instances" "10"
    "--set-env-vars" "GCS_BUCKET=${GCS_BUCKET},GOOGLE_CLOUD_PROJECT=${PROJECT_ID}"
)

if [ -n "$SERVICE_ACCOUNT" ]; then
    DEPLOY_ARGS+=("--service-account" "${SERVICE_ACCOUNT}")
fi

gcloud run deploy ${SERVICE_NAME} "${DEPLOY_ARGS[@]}"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo ""
echo "=== Deployment Complete ==="
echo "URL: ${SERVICE_URL}"
curl -s "${SERVICE_URL}/health" | jq . 2>/dev/null || curl -s "${SERVICE_URL}/health"
