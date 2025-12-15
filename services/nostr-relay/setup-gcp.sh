#!/bin/bash
# Setup script for GCP infrastructure
# Run once to configure Cloud SQL, secrets, IAM, and service accounts

set -e

# Configuration
PROJECT_ID="${GOOGLE_CLOUD_PROJECT:-cumbriadreamlab}"
REGION="us-central1"
SERVICE_NAME="nostr-relay"
DB_INSTANCE="nostr-db"
DB_NAME="nostr"

echo "🚀 Setting up GCP infrastructure for Nostr Relay"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"

# Set project
gcloud config set project "$PROJECT_ID"

# Enable required APIs
echo "📦 Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  sql-component.googleapis.com

# Create service account for Cloud Run
echo "🔐 Creating service account..."
SA_EMAIL="$SERVICE_NAME@$PROJECT_ID.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$SA_EMAIL" &>/dev/null; then
  gcloud iam service-accounts create "$SERVICE_NAME" \
    --display-name="Nostr Relay Service Account" \
    --description="Service account for Nostr relay Cloud Run service"
fi

# Grant IAM roles
echo "🔑 Granting IAM permissions..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/cloudsql.client" \
  --condition=None

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor" \
  --condition=None

# Create Cloud SQL instance (PostgreSQL 15)
echo "🗄️  Creating Cloud SQL instance..."
if ! gcloud sql instances describe "$DB_INSTANCE" --project="$PROJECT_ID" &>/dev/null; then
  gcloud sql instances create "$DB_INSTANCE" \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region="$REGION" \
    --network=default \
    --no-assign-ip \
    --database-flags=max_connections=100 \
    --backup-start-time=03:00 \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=4 \
    --labels=app=nostr-relay,env=production

  echo "⏳ Waiting for instance to be ready..."
  sleep 60
else
  echo "✓ Cloud SQL instance already exists"
fi

# Create database
echo "📊 Creating database..."
gcloud sql databases create "$DB_NAME" \
  --instance="$DB_INSTANCE" \
  --charset=UTF8 || echo "✓ Database already exists"

# Create database user
echo "👤 Creating database user..."
DB_USER="nostr_app"
DB_PASSWORD=$(openssl rand -base64 32)

gcloud sql users create "$DB_USER" \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD" || echo "✓ User already exists"

# Store database URL in Secret Manager
echo "🔒 Storing secrets..."
DB_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?host=/cloudsql/$PROJECT_ID:$REGION:$DB_INSTANCE"

echo -n "$DB_URL" | gcloud secrets create nostr-db-url \
  --data-file=- \
  --replication-policy=automatic || \
  echo -n "$DB_URL" | gcloud secrets versions add nostr-db-url --data-file=-

# Store admin pubkey (placeholder - replace with actual)
echo -n "0000000000000000000000000000000000000000000000000000000000000000" | \
  gcloud secrets create admin-pubkey \
  --data-file=- \
  --replication-policy=automatic || echo "✓ admin-pubkey secret exists"

# Grant service account access to secrets
gcloud secrets add-iam-policy-binding nostr-db-url \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding admin-pubkey \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

# Initialize database schema
echo "🏗️  Initializing database schema..."
cat > /tmp/init-schema.sql <<'EOF'
-- Nostr events table
CREATE TABLE IF NOT EXISTS events (
  id VARCHAR(64) PRIMARY KEY,
  pubkey VARCHAR(64) NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  tags JSONB DEFAULT '[]',
  content TEXT DEFAULT '',
  sig VARCHAR(128) NOT NULL,
  indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_events_pubkey ON events(pubkey);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_tags ON events USING GIN(tags);

-- Whitelist table
CREATE TABLE IF NOT EXISTS whitelist (
  pubkey VARCHAR(64) PRIMARY KEY,
  cohorts JSONB DEFAULT '[]',
  added_at INTEGER NOT NULL,
  added_by VARCHAR(64) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whitelist_cohorts ON whitelist USING GIN(cohorts);

-- Subscriptions table (for monitoring)
CREATE TABLE IF NOT EXISTS subscriptions (
  id VARCHAR(64) PRIMARY KEY,
  connection_id VARCHAR(64) NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_connection ON subscriptions(connection_id);
EOF

gcloud sql import sql "$DB_INSTANCE" /tmp/init-schema.sql \
  --database="$DB_NAME" --quiet || echo "⚠️  Schema already initialized"

rm /tmp/init-schema.sql

# Setup Workload Identity Federation for GitHub Actions (recommended)
echo "🔗 Setting up Workload Identity Federation..."
POOL_NAME="github-pool"
PROVIDER_NAME="github-provider"
REPO_OWNER="${GITHUB_REPO_OWNER:-your-github-username}"
REPO_NAME="${GITHUB_REPO_NAME:-fairfield-nostr}"

if ! gcloud iam workload-identity-pools describe "$POOL_NAME" --location=global &>/dev/null; then
  gcloud iam workload-identity-pools create "$POOL_NAME" \
    --location=global \
    --display-name="GitHub Actions Pool"
fi

if ! gcloud iam workload-identity-pools providers describe "$PROVIDER_NAME" \
  --workload-identity-pool="$POOL_NAME" --location=global &>/dev/null; then

  gcloud iam workload-identity-pools providers create-oidc "$PROVIDER_NAME" \
    --workload-identity-pool="$POOL_NAME" \
    --location=global \
    --issuer-uri="https://token.actions.githubusercontent.com" \
    --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
    --attribute-condition="assertion.repository_owner=='$REPO_OWNER'"
fi

# Grant service account permissions to GitHub Actions
WORKLOAD_IDENTITY_SA="${SERVICE_NAME}-deploy@${PROJECT_ID}.iam.gserviceaccount.com"

if ! gcloud iam service-accounts describe "$WORKLOAD_IDENTITY_SA" &>/dev/null; then
  gcloud iam service-accounts create "${SERVICE_NAME}-deploy" \
    --display-name="GitHub Actions Deploy"
fi

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKLOAD_IDENTITY_SA" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKLOAD_IDENTITY_SA" \
  --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$WORKLOAD_IDENTITY_SA" \
  --role="roles/cloudbuild.builds.builder"

gcloud iam service-accounts add-iam-policy-binding "$WORKLOAD_IDENTITY_SA" \
  --member="principalSet://iam.googleapis.com/projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/$POOL_NAME/attribute.repository/$REPO_OWNER/$REPO_NAME" \
  --role="roles/iam.workloadIdentityUser"

# Output GitHub secrets to configure
echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Add these secrets to your GitHub repository:"
echo "   Settings → Secrets and variables → Actions → New repository secret"
echo ""
echo "GOOGLE_CLOUD_PROJECT=$PROJECT_ID"
echo "WIF_PROVIDER=projects/$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')/locations/global/workloadIdentityPools/$POOL_NAME/providers/$PROVIDER_NAME"
echo "WIF_SERVICE_ACCOUNT=$WORKLOAD_IDENTITY_SA"
echo ""
echo "🔗 Cloud SQL Connection:"
echo "   Instance: $PROJECT_ID:$REGION:$DB_INSTANCE"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""
echo "🚀 Deploy with:"
echo "   git push origin main"
echo ""
echo "📊 Monitor with:"
echo "   gcloud run logs read $SERVICE_NAME --region=$REGION --follow"
