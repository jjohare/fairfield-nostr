<div align="center">

# Nostr BBS

### A Decentralized Community Platform Built on Open Protocols

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Nostr](https://img.shields.io/badge/Nostr-Protocol-purple.svg)](https://nostr.com)
[![SOLID](https://img.shields.io/badge/SOLID-WebID-green.svg)](https://solidproject.org)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-5.x-orange.svg)](https://kit.svelte.dev)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Platform-blue.svg)](https://cloud.google.com)

**Nostr BBS** is a fully decentralized bulletin board system combining the censorship-resistant Nostr protocol with SOLID personal data pods. Features end-to-end encrypted messaging, AI-powered semantic search, calendar events with RSVP, and cohort-based access control—all running on a serverless architecture with zero infrastructure costs.

[Features](#features) • [Quick Start](#quick-start) • [Architecture](#architecture) • [Documentation](#documentation) • [Contributing](#contributing)

</div>

---

## Overview

Nostr BBS provides communities with a self-sovereign communication platform where users control their own data and identity. Built on open standards (Nostr NIPs, SOLID/WebID, DIDs), it offers:

- **True Decentralization** — No central authority controls messages, identity, or access
- **Privacy by Design** — End-to-end encryption with NIP-44/59 gift-wrapped DMs
- **Data Sovereignty** — SOLID pod integration for personal data ownership
- **Zero Cost Hosting** — Runs entirely on cloud free tiers (GCP, GitHub Pages)
- **Offline-First PWA** — Full functionality without connectivity

---

## Screenshots

| Homepage | Messages | Calendar |
|:--------:|:--------:|:--------:|
| ![Homepage](docs/screenshots/homepage.png) | ![Messages](docs/screenshots/messages.png) | ![Calendar](docs/screenshots/calendar-compact.png) |
| **Login** | **Signup** | **Mobile View** |
| ![Login](docs/screenshots/login.png) | ![Signup](docs/screenshots/signup.png) | ![Mobile](docs/screenshots/homepage-mobile.png) |
| **Profile** | **Semantic Search** | **Admin Dashboard** |
| ![Profile](docs/screenshots/profile.png) | ![Semantic Search](docs/screenshots/semantic-search.png) | ![Admin Dashboard](docs/screenshots/admin-dashboard.png) |

---

## Features

### Core Communication
- **Public Chat Channels** — NIP-28 group messaging with cohort-based access control
- **Encrypted Direct Messages** — NIP-17/59 gift-wrapped private messaging with metadata protection
- **Calendar Events** — NIP-52 event scheduling with RSVP and channel integration
- **Reactions & Threading** — NIP-25 emoji reactions and message threading

### Decentralized Identity
- **SOLID/WebID Integration** — Personal data pods for true data ownership
- **DID-Nostr Bridge** — Decentralized identifiers linked to Nostr keypairs
- **NIP-98 HTTP Auth** — Cryptographic authentication for API endpoints
- **BIP-39 Key Management** — Mnemonic-based key generation and recovery

### Advanced Features
- **Semantic Vector Search** — AI-powered similarity search with HNSW indexing (100k+ messages)
- **Link Previews** — Rich URL previews with dedicated microservice
- **NIP-16 Ephemeral Events** — Temporary events that don't persist
- **Offline Message Queue** — Background sync when connectivity returns
- **PWA Support** — Installable app with service worker caching

### Administration
- **Cohort-Based Access** — Business, members, and admin role hierarchies
- **Section Management** — Configurable category/section/forum structure
- **Moderation Tools** — Message deletion, pinning, and user management

---

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account (free tier)
- GitHub account (for deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/jjohare/Nostr-BBS.git
cd Nostr-BBS

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your relay URL and admin pubkey

# Start development server
npm run dev

# Access: http://localhost:5173
```

### Production Deployment

**Frontend (GitHub Pages):**
```bash
npm run build
# Deployment via GitHub Actions on push to main
```

**Backend (Google Cloud Run):**
See [Deployment Guide](#deployment) for complete GCP setup instructions.

---

## Architecture

<details>
<summary><strong>System Overview</strong></summary>

```mermaid
graph TB
    subgraph Internet["Internet Access"]
        User["Web Browser"]
        CDN["GitHub Pages<br/>(Static CDN)"]
    end

    subgraph Docker["Docker Container (Internal)"]
        Relay["Nostr Relay<br/>(ws://localhost:8008)"]
        DB["SQLite/sql.js<br/>(In-memory + File)"]
    end

    subgraph GCP["Google Cloud Platform"]
        CloudRun["Cloud Run<br/>(Embedding API)"]
        LinkPreview["Cloud Run<br/>(Link Preview)"]
        GCS["Cloud Storage<br/>(Vector Index)"]
    end

    subgraph SOLID["SOLID Infrastructure"]
        SolidServer["JavaScriptSolidServer"]
        Pods["Personal Data Pods"]
        WebID["WebID Profiles"]
    end

    subgraph Frontend["SvelteKit PWA"]
        Static["Static Site<br/>(adapter-static)"]
        SW["Service Worker<br/>(Offline Support)"]
        IDB["IndexedDB<br/>(Local Cache)"]
    end

    User -->|HTTPS| CDN
    CDN -->|Serves| Static
    Static -->|Registers| SW
    SW -->|Caches| IDB

    Static <-->|WebSocket| Relay
    Relay <-->|SQL| DB
    Static -->|HTTPS API| CloudRun
    Static -->|HTTPS API| LinkPreview
    CloudRun -->|Vector Index| GCS
    IDB -.->|Sync| GCS

    Static <-->|SOLID Protocol| SolidServer
    SolidServer -->|Manages| Pods
    Pods -->|Identity| WebID

    style Internet fill:#064e3b,color:#fff
    style Docker fill:#2496ed,color:#fff
    style GCP fill:#4285f4,color:#fff
    style SOLID fill:#7c3aed,color:#fff
    style Frontend fill:#1e3a8a,color:#fff
```

</details>

<details>
<summary><strong>Deployment Architecture</strong></summary>

```mermaid
graph LR
    subgraph Development["Development"]
        Dev["Local Dev<br/>localhost:5173"] -->|npm run dev| Docker["Docker Relay<br/>localhost:8008"]
    end

    subgraph Production["Production"]
        Browser["Browser"] -->|HTTPS| GHP["GitHub Pages<br/>your-username.github.io"]
        GHP -->|Loads| PWA["SvelteKit PWA"]
        PWA -->|WebSocket| Relay["Docker Relay<br/>(Internal Network)"]
        PWA -->|HTTPS| CloudRun["Cloud Run API<br/>embedding-api-*.run.app"]
        PWA -->|HTTPS| LinkAPI["Link Preview API"]
        CloudRun -->|Store| GCS["Google Cloud Storage"]
        Relay -->|sql.js| SQLite["SQLite (WASM)"]
    end

    subgraph CI/CD["GitHub Actions"]
        Push["git push main"] -->|Trigger| GHWorkflow["GitHub Actions"]
        GHWorkflow -->|Deploy Frontend| GHP
        GHWorkflow -->|Build Docker| DockerHub["Docker Image"]
    end

    style Development fill:#065f46,color:#fff
    style Production fill:#1e40af,color:#fff
    style CI/CD fill:#6b21a8,color:#fff
```

</details>

<details>
<summary><strong>Free Tier Cost Analysis</strong></summary>

```mermaid
graph TB
    subgraph Free["Free Tier Services"]
        GH["GitHub Pages<br/>✅ Unlimited bandwidth"]
        Docker["Docker Hub<br/>✅ Free public images"]
        CloudRun["Cloud Run<br/>✅ 2M requests/month<br/>✅ 360,000 GB-seconds"]
        GCS["Cloud Storage<br/>✅ 5 GB storage<br/>✅ 5,000 Class A ops<br/>✅ 50,000 Class B ops"]
        GHA["GitHub Actions<br/>✅ 2000 min/month"]
    end

    subgraph Costs["Zero Cost Architecture"]
        Static["Static Hosting"] -->|Free| GH
        Relay["Nostr Relay"] -->|Free| Docker
        API["Embedding API"] -->|Free| CloudRun
        VectorIndex["Vector Index"] -->|Free| GCS
        Pipeline["CI/CD Pipeline"] -->|Free| GHA
    end

    style Free fill:#065f46,color:#fff
    style Costs fill:#064e3b,color:#fff
```

| Resource | Free Tier Limit | Typical Usage (100k msgs) | Utilization |
|----------|-----------------|---------------------------|-------------|
| **Cloud Run** | 2M requests/month | ~10k/month | 0.5% |
| **Cloud Storage** | 5 GB | ~20 MB | 0.4% |
| **GCS Reads** | 50k ops/month | ~10k/month | 20% |
| **GCS Egress** | 1 GB/month | ~500 MB | 50% |
| **Firestore** | 50k reads/day | ~1k/day | 2% |

</details>

---

## Semantic Vector Search

AI-powered search that understands meaning, not just keywords. Search for "schedule tomorrow's meeting" and find messages about "planning the session for Friday."

<details>
<summary><strong>Search Architecture</strong></summary>

```mermaid
graph TB
    subgraph Pipeline["Cloud-Based Embedding Pipeline"]
        CloudRun["Cloud Run API<br/>REST Endpoints"]
        Relay["Nostr Relay<br/>Fetch Messages"]
        ST["sentence-transformers<br/>all-MiniLM-L6-v2"]
        HNSW["hnswlib<br/>Build Index"]
        GCS["Cloud Storage<br/>Store Index"]
    end

    subgraph PWA["PWA Client"]
        WiFi{"WiFi<br/>Detection"}
        Sync["Lazy Sync<br/>Background"]
        IDB["IndexedDB<br/>Cache Index"]
        WASM["hnswlib-wasm<br/>Local Search"]
        UI["SemanticSearch<br/>Component"]
    end

    CloudRun -->|1. Trigger| Relay
    Relay -->|2. Kind 1,9| ST
    ST -->|3. 384d Vectors| HNSW
    HNSW -->|4. Upload| GCS

    WiFi -->|5. Check Network| Sync
    Sync -->|6. Download| GCS
    Sync -->|7. Store| IDB
    IDB -->|8. Load| WASM
    UI -->|9. Query| WASM
    WASM -->|10. Results| UI

    style Pipeline fill:#4285f4,color:#fff
    style PWA fill:#1e40af,color:#fff
```

</details>

<details>
<summary><strong>Data Flow Sequence</strong></summary>

```mermaid
sequenceDiagram
    participant API as Cloud Run API
    participant Relay as Nostr Relay
    participant GCS as Cloud Storage
    participant PWA as Browser PWA
    participant IDB as IndexedDB
    participant WASM as hnswlib-wasm

    Note over API,GCS: On-Demand Pipeline (API Triggered)
    API->>Relay: 1. Fetch kind 1 & 9 events
    Relay-->>API: 2. Return messages
    API->>API: 3. Generate embeddings (384d)
    API->>API: 4. Quantize to int8
    API->>API: 5. Build HNSW index
    API->>GCS: 6. Upload index + manifest

    Note over PWA,WASM: User Opens App
    PWA->>PWA: 7. Check WiFi connection
    PWA->>GCS: 8. Fetch manifest.json
    GCS-->>PWA: 9. Return version info

    alt New Version Available
        PWA->>GCS: 10. Download index.bin
        GCS-->>PWA: 11. Return ~15MB index
        PWA->>IDB: 12. Store in embeddings table
    end

    Note over PWA,WASM: User Searches
    PWA->>IDB: 13. Load index
    IDB-->>PWA: 14. Return ArrayBuffer
    PWA->>WASM: 15. Initialize HNSW
    PWA->>WASM: 16. searchKnn(query, k=10)
    WASM-->>PWA: 17. Return note IDs + scores
    PWA->>Relay: 18. Fetch full notes by ID
    Relay-->>PWA: 19. Return decrypted content
```

</details>

### Technical Specifications

| Component | Implementation | Benefit |
|-----------|----------------|---------|
| **Embedding Model** | all-MiniLM-L6-v2 (384d) | Semantic understanding |
| **HNSW Index** | O(log n) ANN search | Sub-millisecond on 100k+ vectors |
| **Int8 Quantization** | 75% storage reduction | 100k messages = ~15MB |
| **WiFi-Only Sync** | Network Information API | Respects mobile data |
| **Offline Search** | IndexedDB + hnswlib-wasm | No connectivity required |

---

## Nostr Protocol Implementation

<details>
<summary><strong>NIP Dependency Graph</strong></summary>

```mermaid
graph TB
    subgraph Core["Core Protocol"]
        NIP01["NIP-01<br/>Basic Protocol"]
        NIP02["NIP-02<br/>Contact List"]
        NIP11["NIP-11<br/>Relay Info"]
        NIP42["NIP-42<br/>Authentication"]
    end

    subgraph Messaging["Messaging & Chat"]
        NIP28["NIP-28<br/>Public Channels"]
        NIP17["NIP-17<br/>Private DMs"]
        NIP44["NIP-44<br/>Encryption"]
        NIP59["NIP-59<br/>Gift Wrap"]
        NIP25["NIP-25<br/>Reactions"]
    end

    subgraph Advanced["Advanced Features"]
        NIP52["NIP-52<br/>Calendar Events"]
        NIP09["NIP-09<br/>Deletion"]
        NIP16["NIP-16<br/>Ephemeral Events"]
        NIP98["NIP-98<br/>HTTP Auth"]
    end

    NIP01 --> NIP28
    NIP01 --> NIP52
    NIP42 --> NIP17
    NIP44 --> NIP59
    NIP59 --> NIP17
    NIP01 --> NIP25
    NIP01 --> NIP09
    NIP01 --> NIP16
    NIP42 --> NIP98

    style Core fill:#1e40af,color:#fff
    style Messaging fill:#7c2d12,color:#fff
    style Advanced fill:#064e3b,color:#fff
```

</details>

### Supported NIPs

| NIP | Name | Status | Description |
|-----|------|--------|-------------|
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Basic Protocol | ✅ | Core event format and relay communication |
| [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md) | Contact List | ✅ | Following list management |
| [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) | Event Deletion | ✅ | Message deletion support |
| [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) | Relay Information | ✅ | Relay metadata document |
| [NIP-16](https://github.com/nostr-protocol/nips/blob/master/16.md) | Ephemeral Events | ✅ | Temporary events (not persisted) |
| [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) | Private DMs | ✅ | Sealed rumors for private messaging |
| [NIP-25](https://github.com/nostr-protocol/nips/blob/master/25.md) | Reactions | ✅ | Message reactions (emoji) |
| [NIP-28](https://github.com/nostr-protocol/nips/blob/master/28.md) | Public Chat | ✅ | Group channels with moderation |
| [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) | Authentication | ✅ | Relay authentication challenges |
| [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) | Versioned Encryption | ✅ | Modern encryption for DMs |
| [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md) | Calendar Events | ✅ | Event scheduling with RSVP |
| [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Gift Wrap | ✅ | Metadata protection layer |
| [NIP-98](https://github.com/nostr-protocol/nips/blob/master/98.md) | HTTP Auth | ✅ | HTTP request authentication |

---

## SOLID/WebID Integration

Nostr BBS integrates with the SOLID ecosystem for true data sovereignty. Users can store personal data in their own pods while authenticating via Nostr keypairs.

<details>
<summary><strong>SOLID Architecture</strong></summary>

```mermaid
graph TB
    subgraph Identity["Decentralized Identity"]
        NostrKeys["Nostr Keypair<br/>(BIP-39)"]
        DID["DID:nostr<br/>Identifier"]
        WebID["WebID Profile"]
    end

    subgraph Storage["Personal Data Pods"]
        SolidServer["JavaScriptSolidServer"]
        Pod["User Pod"]
        ACL["Access Control<br/>(WAC)"]
    end

    subgraph App["Nostr BBS"]
        Auth["Authentication"]
        Client["SOLID Client"]
        Store["Local Cache"]
    end

    NostrKeys -->|Derives| DID
    DID -->|Links to| WebID
    WebID -->|Stored in| Pod

    Auth -->|NIP-98| SolidServer
    SolidServer -->|Manages| Pod
    Pod -->|Protected by| ACL
    Client <-->|SOLID Protocol| Pod
    Client -->|Caches| Store

    style Identity fill:#7c3aed,color:#fff
    style Storage fill:#059669,color:#fff
    style App fill:#1e40af,color:#fff
```

</details>

### Key Capabilities

- **Personal Data Pods** — Store messages, preferences, and media in your own pod
- **DID-Nostr Bridge** — Link decentralized identifiers to Nostr public keys
- **WebID Authentication** — Use Nostr signatures for SOLID authentication
- **Interoperability** — Access data from any SOLID-compatible application

---

## Cohort-Based Access Control

<details>
<summary><strong>Access Control Flow</strong></summary>

```mermaid
graph TB
    subgraph Admin["Admin Actions"]
        AdminPubkey["Admin Pubkey<br/>(VITE_ADMIN_PUBKEY)"]
        Whitelist["Whitelist Management"]
        CohortAssign["Cohort Assignment"]
    end

    subgraph Cohorts["User Cohorts"]
        Admin2["admin<br/>Full system access"]
        Business["business<br/>Business community"]
        Members["members<br/>Premium members"]
        Public["public<br/>Read-only access"]
    end

    subgraph Access["Channel Access (Kind 9022)"]
        Channel1["community-rooms<br/>cohorts: [admin, members]"]
        Channel2["business-network<br/>cohorts: [admin, business]"]
        Channel3["announcements<br/>cohorts: [public]"]
    end

    subgraph Auth["NIP-42 Authentication"]
        Challenge["AUTH Challenge"]
        Verify["Signature Verification"]
        CohortCheck["Cohort Membership Check"]
    end

    AdminPubkey -->|Manages| Whitelist
    Whitelist -->|Assigns| CohortAssign
    CohortAssign --> Admin2
    CohortAssign --> Business
    CohortAssign --> Members
    CohortAssign --> Public

    Admin2 -->|Full Access| Channel1
    Admin2 -->|Full Access| Channel2
    Admin2 -->|Full Access| Channel3
    Members -->|Access| Channel1
    Business -->|Access| Channel2
    Public -->|Read Only| Channel3

    Challenge --> Verify
    Verify --> CohortCheck
    CohortCheck -->|Grant/Deny| Access

    style Admin fill:#b91c1c,color:#fff
    style Cohorts fill:#7c2d12,color:#fff
    style Access fill:#065f46,color:#fff
    style Auth fill:#1e40af,color:#fff
```

</details>

---

## User Flows

<details>
<summary><strong>Complete User Journey</strong></summary>

```mermaid
graph TB
    Start([New User]) --> Signup[Create Account]
    Signup --> Keys[Generate Keys<br/>BIP-39 Mnemonic]
    Keys --> Backup[Backup Recovery Phrase]
    Backup --> Auth[Authenticate to Relay]

    Auth --> Dashboard{Main Dashboard}

    Dashboard --> Channels[Browse Channels]
    Dashboard --> DMs[Direct Messages]
    Dashboard --> Events[Calendar Events]
    Dashboard --> Profile[User Profile]

    Channels --> Join[Join Channel]
    Join --> Chat[Send Messages]
    Chat --> React[React to Messages]
    Chat --> Search[Search Messages]

    DMs --> NewDM[New Conversation]
    NewDM --> SendDM[Send Encrypted DM]
    SendDM --> Receive[Receive DMs]

    Events --> Browse[Browse Events]
    Events --> Create[Create Event]
    Create --> RSVP[RSVP to Events]

    Profile --> Settings[Edit Profile]
    Settings --> Export[Export Data]

    style Start fill:#065f46,color:#fff
    style Dashboard fill:#1e40af,color:#fff
```

</details>

<details>
<summary><strong>Authentication Flow</strong></summary>

```mermaid
sequenceDiagram
    participant User
    participant App as PWA
    participant Store as Local Storage
    participant Relay as Docker Relay

    User->>App: 1. Click "Create Account"
    App->>App: 2. Generate BIP-39 Mnemonic
    App->>User: 3. Display Recovery Phrase
    User->>App: 4. Confirm Backup

    App->>App: 5. Derive Keys from Mnemonic
    App->>Store: 6. Encrypt & Store Private Key

    App->>Relay: 7. Connect WebSocket
    Relay->>App: 8. AUTH Challenge (NIP-42)
    App->>App: 9. Sign Challenge (Kind 22242)
    App->>Relay: 10. Send Signed Event
    Relay->>App: 11. OK - Authenticated

    App->>User: 12. Show Dashboard

    Note over User,Relay: Keys never leave the device
    Note over Store: Private key encrypted with PIN
```

</details>

<details>
<summary><strong>Gift-Wrapped DM Flow (NIP-17/59)</strong></summary>

```mermaid
sequenceDiagram
    participant Alice
    participant App as PWA
    participant Relay as Docker Relay
    participant Bob

    Alice->>App: 1. Compose Private Message

    Note over App: 2. Create Rumor (Kind 14)<br/>Unsigned inner event
    Note over App: 3. Seal with NIP-44<br/>Encrypt with shared secret
    Note over App: 4. Generate Random Keypair<br/>For sender anonymity
    Note over App: 5. Gift Wrap (Kind 1059)<br/>Fuzz timestamp ±2 days

    App->>Relay: 6. Publish Gift Wrap

    Note over Relay: Relay sees:<br/>- Random pubkey (not Alice)<br/>- Fuzzed timestamp<br/>- Encrypted content<br/>- Only knows recipient

    Relay->>Bob: 7. Deliver to Recipient

    Note over Bob: 8. Unwrap Gift<br/>Decrypt outer layer
    Note over Bob: 9. Unseal<br/>Decrypt inner rumor
    Note over Bob: 10. Read Message<br/>See real sender & time

    Bob->>App: 11. Display Message

    rect rgb(200, 50, 50, 0.1)
        Note over Relay: Privacy guarantees:<br/>✅ Sender hidden<br/>✅ Time hidden<br/>✅ Content encrypted
    end
```

</details>

---

## Project Structure

```
nostr-BBS/
├── src/
│   ├── lib/
│   │   ├── components/         # Svelte components
│   │   │   ├── auth/           # Login, signup, profile
│   │   │   ├── chat/           # Channel list, messages
│   │   │   ├── dm/             # Direct messages
│   │   │   ├── calendar/       # Calendar, events, RSVP
│   │   │   ├── admin/          # Admin panel
│   │   │   └── ui/             # Reusable UI components
│   │   ├── nostr/              # Nostr protocol implementation
│   │   ├── solid/              # SOLID/WebID integration
│   │   │   ├── client.ts       # SOLID client
│   │   │   ├── pods.ts         # Pod management
│   │   │   ├── storage.ts      # Storage operations
│   │   │   └── types.ts        # Type definitions
│   │   ├── semantic/           # Vector search
│   │   ├── stores/             # Svelte stores
│   │   └── utils/              # Helper functions
│   ├── routes/                 # SvelteKit routes
│   └── service-worker.ts       # PWA service worker
├── services/
│   ├── embedding-api/          # Cloud Run embedding service
│   ├── link-preview-api/       # Link preview microservice
│   └── nostr-relay/            # Nostr relay with NIP extensions
├── JavaScriptSolidServer/      # SOLID server submodule
├── config/
│   └── sections.yaml           # BBS configuration
├── .github/workflows/          # CI/CD pipelines
├── docs/                       # Documentation
└── tests/                      # Test suites
```

---

## Configuration

### Environment Variables

```bash
# .env (local development)
VITE_RELAY_URL=wss://your-nostr-relay.com
VITE_ADMIN_PUBKEY=<hex-pubkey>              # Admin public key (64-char hex)
VITE_NDK_DEBUG=false                         # Enable NDK debug logging

# Semantic Search
VITE_GCS_EMBEDDINGS_URL=https://storage.googleapis.com/nostr-bbs-embeddings

# Cloud Run APIs
VITE_EMBEDDING_API_URL=https://embedding-api-*.run.app
VITE_LINK_PREVIEW_API_URL=https://link-preview-api-*.run.app

# SOLID Configuration
VITE_SOLID_SERVER_URL=https://your-solid-server.com

# GCP Configuration (deployment)
GCP_PROJECT_ID=<your-project-id>
GCP_REGION=us-central1
```

### GitHub Actions Secrets

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_SA_KEY` | Service account JSON key |
| `GCS_BUCKET_NAME` | Cloud Storage bucket name |

| Variable | Description |
|----------|-------------|
| `ADMIN_PUBKEY` | Admin public key (64-char hex) |

---

## Deployment

### GitHub Pages (Frontend)

Automatic deployment via GitHub Actions on push to `main`:

1. Configure repository Settings → Pages → Source: GitHub Actions
2. Push to main branch triggers build and deploy

### Google Cloud Run (Backend)

```bash
# Authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Deploy embedding API
cd services/embedding-api/
gcloud run deploy embedding-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated

# Deploy link preview API
cd ../link-preview-api/
gcloud run deploy link-preview-api \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

See [docs/deployment/DEPLOYMENT.md](docs/deployment/DEPLOYMENT.md) for complete guide.

---

## Testing

```bash
npm test              # Run all tests
npm run test:e2e      # E2E tests with Playwright
npm run check         # Type checking
npm run lint          # Linting
```

---

## Security

### Key Management
- Private keys stored encrypted in localStorage
- BIP-39 mnemonic backup for recovery
- Keys never transmitted to servers
- Optional PIN/passphrase protection

### Message Privacy
- NIP-44 encryption for all DMs
- Gift wrap hides sender from relay
- Timestamp fuzzing prevents timing analysis
- End-to-end encryption

### Infrastructure Security
- HTTPS everywhere (Google-managed certs)
- NIP-42 authentication required
- NIP-98 HTTP authentication for APIs
- Zero-trust serverless architecture

---

## Documentation

### Deployment & Operations
- [Deployment Guide](docs/deployment/DEPLOYMENT.md)
- [GCP Architecture](docs/deployment/gcp-architecture.md)
- [GitHub Workflows](docs/deployment/github-workflows.md)

### Security
- [Security Audit](docs/security/SECURITY_AUDIT.md)
- [Admin Key Rotation](docs/security/ADMIN_KEY_ROTATION.md)

### Features
- [Direct Messages](docs/features/dm-implementation.md)
- [Semantic Search](docs/architecture/06-semantic-search-spec.md)
- [PWA Implementation](docs/features/pwa-implementation.md)
- [SOLID Integration](docs/solid/README.md)

### Architecture (SPARC)
- [Specification](docs/architecture/01-specification.md)
- [Architecture](docs/architecture/02-architecture.md)
- [Pseudocode](docs/architecture/03-pseudocode.md)

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style
- Write tests for new features
- Update documentation as needed
- Use semantic commit messages

---

## License

MIT License - see [LICENSE](LICENSE) for details.

---

## Third Party Dependencies

### JavaScriptSolidServer

- **Repository**: https://github.com/JavaScriptSolidServer/JavaScriptSolidServer
- **Author**: Melvin Carvalho
- **License**: MIT
- **Usage**: SOLID pod server providing personal data storage with WebID authentication
- **Integration**: Enables users to store and control their own data while authenticating via Nostr keypairs

---

## Credits & Acknowledgements

### Major Contributors

<table>
<tr>
<td align="center" width="50%">
<a href="https://github.com/JavaScriptSolidServer/JavaScriptSolidServer">
<strong>JavaScriptSolidServer</strong>
</a>
<br/>
<sub>Melvin Carvalho's SOLID/WebID server enabling decentralized personal data storage</sub>
</td>
<td align="center" width="50%">
<a href="https://github.com/agenticalliance">
<strong>Agentic Alliance</strong>
</a>
<br/>
<sub>Major contributors to architecture, NIP implementations, and SOLID integration</sub>
</td>
</tr>
</table>

### Core Technologies

#### Nostr Ecosystem
- **[Nostr Protocol](https://github.com/nostr-protocol/nostr)** — Decentralized communication foundation
- **[NDK (Nostr Dev Kit)](https://github.com/nostr-dev-kit/ndk)** — Development toolkit by [@pablof7z](https://github.com/pablof7z)
- **[nostr-tools](https://github.com/nbd-wtf/nostr-tools)** — Essential utilities by fiatjaf

#### Frontend & UI
- **[SvelteKit](https://kit.svelte.dev)** — Application framework
- **[DaisyUI](https://daisyui.com)** — Component library
- **[TailwindCSS](https://tailwindcss.com)** — Utility-first CSS

#### Machine Learning & Search
- **[sentence-transformers](https://www.sbert.net/)** — Multilingual embeddings
- **[hnswlib](https://github.com/nmslib/hnswlib)** — Fast approximate nearest neighbor search
- **[hnswlib-wasm](https://github.com/yoshoku/hnswlib-wasm)** — Browser-based vector search

#### Infrastructure
- **[Google Cloud Run](https://cloud.google.com/run)** — Serverless containers
- **[GitHub Pages](https://pages.github.com)** — Static hosting
- **[GitHub Actions](https://github.com/features/actions)** — CI/CD automation

### Development Tools
- **[Claude Code](https://claude.ai/claude-code)** — AI-assisted development by Anthropic
- **[Claude Flow](https://github.com/ruvnet/claude-flow)** — Swarm coordination for parallel development

### Project Team
- **John O'Hare** ([@jjohare](https://github.com/jjohare)) — Project Lead
- **Claude Opus 4.5 / Claude Sonnet 4** — AI Development Assistance

---

## Support

- **Documentation**: [docs/](docs/)
- **Issues**: [GitHub Issues](https://github.com/jjohare/Nostr-BBS/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jjohare/Nostr-BBS/discussions)

---

<div align="center">

**Built with open protocols for a decentralized future**

[Nostr Protocol](https://nostr.com) • [SOLID Project](https://solidproject.org) • [SvelteKit](https://kit.svelte.dev)

</div>
