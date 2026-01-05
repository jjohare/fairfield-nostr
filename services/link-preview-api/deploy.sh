#!/bin/bash
# Deploy Link Preview API to Cloud Run
# Usage: ./deploy.sh [tag]
# Environment: GCP_PROJECT_ID (required), GCP_REGION (default: us-central1)

set -e

PROJECT_ID="${GCP_PROJECT_ID:?Error: GCP_PROJECT_ID environment variable must be set}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="link-preview-api"
REPO="nostr-bbs"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}"
TAG="${1:-latest}"
SERVICE_ACCOUNT="nostr-bbs-runtime@${PROJECT_ID}.iam.gserviceaccount.com"

echo "=== Link Preview API Deployment ==="
echo "Image: ${IMAGE_NAME}:${TAG}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

echo "Building..."
docker build -t ${IMAGE_NAME}:${TAG} -t ${IMAGE_NAME}:latest .

echo "Pushing..."
docker push ${IMAGE_NAME}:${TAG}
docker push ${IMAGE_NAME}:latest

echo "Deploying..."
gcloud run deploy ${SERVICE_NAME} \
    --image ${IMAGE_NAME}:${TAG} \
    --platform managed \
    --region ${REGION} \
    --allow-unauthenticated \
    --service-account ${SERVICE_ACCOUNT} \
    --memory 256Mi \
    --cpu 1 \
    --min-instances 0 \
    --max-instances 5 \
    --timeout 30 \
    --set-env-vars "ALLOWED_ORIGINS=http://localhost:5173"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
echo "Deployed: ${SERVICE_URL}"
echo "Health: ${SERVICE_URL}/health"
