#!/bin/bash
# Deploy Nostr Relay to Cloud Run
# Usage: ./deploy.sh [tag]
#
# Required environment variables:
#   GCP_PROJECT_ID - Google Cloud project ID
#
# Optional environment variables:
#   GCP_REGION - GCP region (default: us-central1)
#   ARTIFACT_REPO - Artifact Registry repository name (default: nostr-bbs)
#   SERVICE_ACCOUNT - Service account email for Cloud Run

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID:?Error: GCP_PROJECT_ID not set}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="nostr-relay"
REPO="${ARTIFACT_REPO:-nostr-bbs}"
IMAGE_NAME="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE_NAME}"
TAG="${1:-latest}"
SERVICE_ACCOUNT="${SERVICE_ACCOUNT:-}"

echo "=== Nostr Relay Deployment ==="
echo "Project: ${PROJECT_ID}"
echo "Image: ${IMAGE_NAME}:${TAG}"
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
    "--platform" "managed"
    "--region" "${REGION}"
    "--allow-unauthenticated"
    "--memory" "512Mi"
    "--cpu" "1"
    "--min-instances" "1"
    "--max-instances" "1"
    "--timeout" "3600"
    "--no-cpu-throttling"
    "--port" "8080"
)

if [ -n "$SERVICE_ACCOUNT" ]; then
    DEPLOY_ARGS+=("--service-account" "${SERVICE_ACCOUNT}")
fi

gcloud run deploy ${SERVICE_NAME} "${DEPLOY_ARGS[@]}"

SERVICE_URL=$(gcloud run services describe ${SERVICE_NAME} --region ${REGION} --format 'value(status.url)')
WS_URL="${SERVICE_URL/https:\/\//wss://}"

echo ""
echo "=== Deployment Complete ==="
echo "HTTP URL: ${SERVICE_URL}"
echo "WebSocket URL: ${WS_URL}"
