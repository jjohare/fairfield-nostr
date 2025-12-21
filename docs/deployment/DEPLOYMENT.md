---
title: Deployment Guide - Nostr-BBS
description: Complete deployment guide for Nostr-BBS including GitHub Pages, Docker relay, and GCP integration
category: howto
tags: [deployment, setup, relay, architecture]
---

[← Back to Main README](../../README.md)

# Deployment Guide - Nostr-BBS

## Architecture

**Private Community Platform** with Internal Nostr Relay and Google Cloud Platform:

```mermaid
flowchart TB
    subgraph Internet["Internet Access"]
        Browser["Web Browser"]
        Mobile["Mobile PWA"]
    end

    subgraph GitHub["GitHub Pages"]
        Static["SvelteKit PWA<br/>Static Site"]
        Assets["Assets & Service Worker"]
    end

    subgraph Docker["Docker Container (Internal)"]
        Relay["Nostr Relay<br/>ws://localhost:8008"]
        PG["PostgreSQL<br/>Whitelist & Events"]
    end

    subgraph GCP["Google Cloud Platform"]
        CloudRun["Cloud Run<br/>Embedding API"]
        Storage["Cloud Storage<br/>Vector Index"]
    end

    Browser --> Static
    Mobile --> Static
    Static <-->|WebSocket| Relay
    Relay <--> PG
    Static -->|HTTPS POST /embed| CloudRun
    CloudRun --> Storage

    style GitHub fill:#2d3748,color:#fff
    style Docker fill:#2496ed,color:#fff
    style GCP fill:#4285f4,color:#fff
    style Internet fill:#064e3b,color:#fff
```

### Architecture Components

1. **Frontend (GitHub Pages)**: SvelteKit PWA with static site generation
2. **Relay (Docker)**: Private Nostr relay with PostgreSQL (whitelist-only, no federation)
3. **Embedding API (GCP Cloud Run)**: Semantic search vector generation
4. **Storage (GCP Cloud Storage)**: Vector index files

## Prerequisites

### Required
- **Node.js 20+** - JavaScript runtime
- **GitHub Account** - With Pages enabled (free)
- **Docker & Docker Compose** - Container runtime
- **Google Cloud Account** - Free tier available (https://cloud.google.com/free)
- **Git** - Version control

### Optional
- **gcloud CLI** - For local GCP development and deployment
- **Custom Domain** - For production use

## Quick Start

### 1. Fork and Clone Repository

```bash
git clone https://github.com/your-username/Nostr-BBS-nostr.git
cd Nostr-BBS-nostr
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```bash
# Internal Docker relay (no external connections)
VITE_RELAY_URL=ws://localhost:8008

# GCP Cloud Run embedding API URL (update after deployment)
VITE_EMBEDDING_API_URL=https://your-service.us-central1.run.app

# Admin pubkey in hex format (64 characters)
VITE_ADMIN_PUBKEY=your-hex-pubkey-here

# Application configuration
VITE_APP_NAME=Nostr-BBS
VITE_NDK_DEBUG=false

# GCP credentials (for local development only)
# ⚠️ DO NOT commit these! Use GitHub Secrets for CI/CD
GCP_PROJECT_ID=your-project-id
GCP_REGION=us-central1
```

### 3. Generate Admin Keypair

If you don't have a Nostr keypair:

```bash
# Generate new keypair
npx nostr-tools-cli generate

# Output will show:
# Private key (nsec): nsec1...
# Public key (npub): npub1...
# Public key (hex): 49dfa09158b64f1c...
```

**Important**: Save your `nsec` (private key) securely. You'll need the hex public key for `VITE_ADMIN_PUBKEY`.

## Docker Relay Setup

### Step 1: Start Docker Services

```bash
cd services/nostr-relay

# Start PostgreSQL and Nostr relay
docker compose up -d

# View logs
docker compose logs -f
```

### Step 2: Verify Relay is Running

```bash
# Check service status
docker compose ps

# Test WebSocket connection
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: test" \
     http://localhost:8008

# Test NIP-11 relay info
curl http://localhost:8008 -H "Accept: application/nostr+json"
```

Expected response:
```json
{
  "name": "Nostr-BBS Relay",
  "description": "Private community relay with whitelist access",
  "supported_nips": [1, 2, 9, 11, 17, 25, 28, 42, 44, 52, 59],
  "software": "Nostr-BBS-relay",
  "version": "1.0.0"
}
```

### Step 3: Add Admin to Whitelist

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U nostr -d nostr_relay

# Add admin user
INSERT INTO whitelist (pubkey, cohorts, added_at, added_by)
VALUES ('your-hex-pubkey-here', '["admin"]', EXTRACT(EPOCH FROM NOW()), 'system');

# Verify
SELECT * FROM whitelist;

# Exit
\q
```

### Step 4: Database Management

**View Whitelist**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c "SELECT * FROM whitelist;"
```

**Add User**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c \
  "INSERT INTO whitelist (pubkey, cohorts, added_at, added_by) \
   VALUES ('user-pubkey-hex', '[\"members\"]', EXTRACT(EPOCH FROM NOW()), 'admin-pubkey');"
```

**Remove User**:
```bash
docker compose exec postgres psql -U nostr -d nostr_relay -c \
  "DELETE FROM whitelist WHERE pubkey = 'user-pubkey-hex';"
```

**Backup Database**:
```bash
docker compose exec postgres pg_dump -U nostr nostr_relay > backup.sql
```

**Restore Database**:
```bash
docker compose exec -T postgres psql -U nostr nostr_relay < backup.sql
```

## Google Cloud Platform Setup

For detailed GCP deployment instructions, see **[GCP Deployment Guide](./GCP_DEPLOYMENT.md)**.

### Quick GCP Setup

```bash
# 1. Enable APIs
gcloud services enable run.googleapis.com storage.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com

# 2. Create infrastructure
gcloud artifacts repositories create logseq-repo \
  --repository-format=docker --location=us-central1

gcloud storage buckets create gs://YOUR_PROJECT_ID-models \
  --location=us-central1 --storage-class=STANDARD

# 3. Deploy embedding API
gcloud builds submit --config cloudbuild.yaml

# 4. Get service URL
gcloud run services describe logseq-embeddings \
  --region us-central1 --format 'value(status.url)'
```

**Save the Cloud Run URL** - you'll use it as `VITE_EMBEDDING_API_URL`.

For complete GCP setup, troubleshooting, and cost optimisation, see:
- **[GCP Deployment Guide](./GCP_DEPLOYMENT.md)** - Step-by-step Cloud Run deployment
- **[GCP Architecture](./gcp-architecture.md)** - Architecture design and verification

## GitHub Pages Setup

### Step 1: Configure Repository Settings

1. Go to **Settings** > **Pages**
2. Source: **GitHub Actions**
3. No custom build needed (using workflow)

### Step 2: Set GitHub Repository Variables

Go to your GitHub repository → Settings → Secrets and variables → Actions → Variables tab.

Add these repository variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `ADMIN_PUBKEY` | `your-64-char-hex-pubkey` | Admin public key (hex format) |

The workflow references these via `${{ vars.ADMIN_PUBKEY }}`.

Relay URL and app name are set directly in `.github/workflows/deploy-pages.yml`:

```yaml
env:
  NODE_VERSION: '20'
  VITE_RELAY_URL: ws://localhost:8008
  VITE_ADMIN_PUBKEY: ${{ vars.ADMIN_PUBKEY }}
  VITE_APP_NAME: Nostr-BBS
  VITE_NDK_DEBUG: false
```

### Step 3: Deploy

```bash
# Commit and push to trigger deployment
git add .
git commit -m "Configure deployment"
git push origin main
```

GitHub Actions will:
1. Install dependencies
2. Build SvelteKit PWA
3. Deploy to GitHub Pages

### Step 4: Verify Deployment

1. Check Actions tab for build status
2. Once complete, visit: `https://your-username.github.io/Nostr-BBS-nostr/`
3. PWA should load and connect to your Docker relay

### Step 5: Configure Custom Domain (Optional)

1. Go to **Settings** > **Pages**
2. **Custom domain**: `chat.yourdomain.com`
3. Update DNS:
   ```
   Type: CNAME
   Name: chat
   Value: your-username.github.io
   ```
4. Wait for DNS propagation (5-60 minutes)
5. Enable **Enforce HTTPS**

## Local Development

### Development Server

```bash
# Install dependencies
npm install

# Start Docker relay (first terminal)
cd services/nostr-relay
docker compose up -d

# Start dev server (second terminal)
cd ../..
npm run dev

# Access at http://localhost:5173
```

The dev server will:
- Hot reload on file changes
- Connect to local Docker relay at ws://localhost:8008
- Use environment variables from `.env`

### Testing

```bash
# Run all tests
npm test

# Type checking
npm run check

# Linting
npm run lint

# E2E tests (requires Docker relay running)
npm run test:e2e
```

## Environment Variables Reference

### Frontend (.env)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `VITE_RELAY_URL` | Yes | Internal Docker relay URL | `ws://localhost:8008` |
| `VITE_EMBEDDING_API_URL` | Yes | GCP Cloud Run embedding API | `https://service.us-central1.run.app` |
| `VITE_ADMIN_PUBKEY` | Yes | Admin public key (hex) | `49dfa09...` (64 chars) |
| `VITE_APP_NAME` | No | Application name | `Nostr-BBS` |
| `VITE_NDK_DEBUG` | No | Enable NDK debug logs | `false` |

### Docker Relay (.env in services/nostr-relay)

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | Yes | PostgreSQL connection | `postgresql://nostr:password@postgres:5432/nostr_relay` |
| `RELAY_PORT` | No | WebSocket port | `8008` |
| `RELAY_NAME` | No | Relay name (NIP-11) | `Nostr-BBS Relay` |

### Build Variables (.github/workflows)

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_VERSION` | Node.js version | `20` |
| `BASE_PATH` | GitHub Pages base path | `/${{ github.event.repository.name }}` |

## Production Checklist

### Pre-Deployment
- [ ] Generate admin keypair and save securely
- [ ] Configure GitHub repository secrets
- [ ] Update environment variables in workflows
- [ ] Test local build: `npm run build`

### Docker Relay Setup
- [ ] Start Docker services: `docker compose up -d`
- [ ] Verify PostgreSQL is running
- [ ] Apply database schema
- [ ] Add admin to whitelist
- [ ] Verify whitelist: `docker compose exec postgres psql ...`
- [ ] Test relay WebSocket connection
- [ ] Test NIP-11 relay info endpoint

### GitHub Pages Setup
- [ ] Enable Pages in repository settings
- [ ] Add variables to GitHub
- [ ] Update workflow environment variables
- [ ] Push to `main` branch
- [ ] Verify GitHub Actions workflow succeeds
- [ ] Test PWA loads at GitHub Pages URL
- [ ] Verify WebSocket connects to Docker relay

### Post-Deployment
- [ ] Test PWA installation on mobile
- [ ] Verify service worker registers
- [ ] Test offline functionality
- [ ] Configure custom domain (if applicable)
- [ ] Enable HTTPS enforcement
- [ ] Test admin authentication
- [ ] Create additional users and cohorts
- [ ] Monitor relay logs: `docker compose logs -f relay`

### Security
- [ ] Verify admin pubkey matches your keypair
- [ ] Confirm whitelist enforces access control
- [ ] Test unauthorized access is blocked
- [ ] Enable rate limiting (if needed)
- [ ] Review relay logs for suspicious activity
- [ ] Secure PostgreSQL with strong passwords
- [ ] Restrict Docker network access

## Troubleshooting

### PWA Not Loading

**Symptom**: Blank page or 404 error

**Solutions**:
```bash
# Check build output
npm run build
ls -la build/

# Verify GitHub Pages deployment
# Go to Settings > Pages
# Check Actions tab for errors

# Check BASE_PATH in workflow
# Should match repository name
```

### WebSocket Connection Fails

**Symptom**: "Failed to connect to relay" error

**Solutions**:
```bash
# Verify Docker services are running
docker compose ps

# Check relay logs
docker compose logs relay

# Test relay endpoint
curl -i -N -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     http://localhost:8008

# Verify VITE_RELAY_URL in .env
# Must be ws://localhost:8008 (not wss://)
```

### Authentication Fails

**Symptom**: "Not authorized" or "Invalid signature"

**Solutions**:
```bash
# Verify admin pubkey (hex format, 64 chars)
echo $VITE_ADMIN_PUBKEY | wc -c  # Should be 65 (64 + newline)

# Check whitelist
docker compose exec postgres psql -U nostr -d nostr_relay -c "SELECT * FROM whitelist;"

# Add admin if missing
docker compose exec postgres psql -U nostr -d nostr_relay -c \
  "INSERT INTO whitelist (pubkey, cohorts, added_at, added_by) \
   VALUES ('your-hex-pubkey', '[\"admin\"]', EXTRACT(EPOCH FROM NOW()), 'system');"
```

### Database Connection Errors

**Symptom**: Relay logs show PostgreSQL connection errors

**Solutions**:
```bash
# Verify PostgreSQL is running
docker compose ps postgres

# Check database logs
docker compose logs postgres

# Verify connection string
docker compose exec relay env | grep DATABASE_URL

# Restart services
docker compose restart
```

### Docker Services Won't Start

**Symptom**: `docker compose up` fails

**Solutions**:
```bash
# Check for port conflicts
lsof -i :8008  # Relay port
lsof -i :5432  # PostgreSQL port

# View detailed logs
docker compose up

# Reset and rebuild
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

## Cost Estimation

### Docker Relay (Self-Hosted)
- **Hosting**: Free (local development) or ~$5-10/month (VPS)
- **Storage**: Minimal (<1GB for small community)
- **Cost**: $0-10/month

### Google Cloud Platform Free Tier
- **Cloud Run Requests**: 2 million/month
- **Cloud Run CPU**: 2M vCPU-seconds/month
- **Cloud Run Memory**: 360K vCPU-seconds/month
- **Cloud Storage**: 5 GB/month
- **Network Egress**: 1 GB/month
- **Cost**: $0/month (for typical small community usage)

### GitHub Pages
- **Bandwidth**: 100 GB/month
- **Build minutes**: 2,000/month
- **Cost**: $0/month (for public repositories)

### Custom Domain (Optional)
- **Domain registration**: ~$10-15/year
- **DNS**: Usually included with domain

**Total estimated cost**: **$0-25/year** (domain + optional VPS)

**Note**: With current usage patterns (1K requests/day), all services remain within free tier limits. See [GCP Architecture](./gcp-architecture.md) for detailed cost analysis.

## Next Steps

After successful deployment:

1. **Invite Users**: Share your GitHub Pages URL and provide nsec keys
2. **Create Cohorts**: Organize users into groups
3. **Configure Channels**: Set up NIP-28 chat channels
4. **Schedule Events**: Create NIP-52 calendar events
5. **Monitor Usage**: Check Docker relay logs and GCP metrics
6. **Backup Data**: Regularly export PostgreSQL database

## Support

- **Issues**: https://github.com/your-username/Nostr-BBS-nostr/issues
- **Nostr Protocol**: https://nostr.com
- **Docker**: https://docs.docker.com
- **SvelteKit**: https://kit.svelte.dev

---

**Architecture**: Private Internal Relay (Docker + PostgreSQL) + GitHub Pages + GCP Cloud Run
**Database**: PostgreSQL
**Cost**: Free tier available ($0-25/year)
**Maintenance**: Minimal (serverless platform + containerized relay)
