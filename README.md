# Minimoonoir

A privacy-first community messaging platform built on the Nostr protocol. Features NIP-52 calendar events, NIP-28 public chat channels, NIP-17/59 encrypted direct messages, and cohort-based access control. Fully serverless architecture with SvelteKit PWA on GitHub Pages and Google Cloud Platform backend.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Nostr](https://img.shields.io/badge/Nostr-Protocol-purple.svg)](https://nostr.com)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-5.x-orange.svg)](https://kit.svelte.dev)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-Platform-blue.svg)](https://cloud.google.com)

## Features

- **Public Chat Channels** - NIP-28 group messaging with cohort-based access control
- **Calendar Events** - NIP-52 event scheduling with RSVP support
- **Encrypted DMs** - NIP-17/59 gift-wrapped private messages
- **Semantic Vector Search** - AI-powered similarity search with HNSW indexing (100k+ messages)
- **PWA Support** - Installable app with offline message queue
- **Serverless Architecture** - Zero infrastructure costs on free tier
- **Cohort-Based Access** - Business, moomaa-tribe, and admin roles

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- Google Cloud Platform account (free tier)
- GitHub account (for deployment)

### Local Development

```bash
# Clone the repository
git clone https://github.com/jjohare/minimoonoir.git
cd minimoonoir

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your relay URL and admin pubkey

# Start development server
npm run dev

# Access: http://localhost:5173
```

### Deploy to Production

**Frontend (GitHub Pages):**

```bash
# Build PWA for production
npm run build

# Deployment happens automatically via GitHub Actions on push to main
# Or deploy manually:
npm run deploy
```

**Backend (Google Cloud Run):**

The embedding service is deployed at: `https://embedding-api-617806532906.us-central1.run.app`

To deploy your own instance, see the [Deployment](#deployment) section below for Google Cloud Platform setup instructions.

## Architecture

### System Overview

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
        GCS["Cloud Storage<br/>(Vector Index)"]
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
    CloudRun -->|Vector Index| GCS
    IDB -.->|Sync| GCS

    style Internet fill:#064e3b,color:#fff
    style Docker fill:#2496ed,color:#fff
    style GCP fill:#4285f4,color:#fff
    style Frontend fill:#1e3a8a,color:#fff
```

### Deployment Architecture

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

### Free Tier Compatibility

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

## Semantic Vector Search

Minimoonoir includes AI-powered semantic search that understands meaning, not just keywords. Search for "schedule tomorrow's meeting" and find messages about "planning the session for Friday" - the system understands context and intent.

### Architecture Overview

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

### Key Features

| Feature | Implementation | Benefit |
|---------|----------------|---------|
| **Semantic Understanding** | sentence-transformers/all-MiniLM-L6-v2 | Find by meaning, not just keywords |
| **HNSW Index** | O(log n) approximate nearest neighbors | Sub-millisecond search on 100k+ vectors |
| **Int8 Quantization** | 75% storage reduction | 100k messages = ~15MB index |
| **WiFi-Only Sync** | Network Information API | Respects mobile data caps |
| **Offline Search** | IndexedDB + hnswlib-wasm | Works without connectivity |
| **Nightly Updates** | GitHub Actions cron | Always fresh index |

### Data Flow

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

### Technical Specifications

```yaml
Embedding Model:
  name: sentence-transformers/all-MiniLM-L6-v2
  dimensions: 384
  performance: ~30 sec per 1,000 messages
  quantization: int8 (75% size reduction)

HNSW Index:
  library: hnswlib (Python) + hnswlib-wasm (Browser)
  space: cosine similarity
  ef_construction: 200
  M: 16
  ef_search: 50

Storage:
  platform: Google Cloud Storage
  bucket: fairfield-nostr-embeddings
  structure:
    - latest/manifest.json
    - latest/index.bin
    - latest/index_mapping.json
  versioning: Incremental (v1, v2, ...)

Client Sync:
  trigger: WiFi or unmetered connection
  storage: IndexedDB (embeddings table)
  lazy_load: true (background, non-blocking)
```

### Free Tier Budget

| Resource | Limit | Usage (100k msgs) | Headroom |
|----------|-------|-------------------|----------|
| **Cloud Run** | 2M requests/month | ~10k/month | 99.5% free |
| **Cloud Storage** | 5 GB storage | ~20 MB | 99.6% free |
| **GCS Reads** | 50k Class B ops/month | ~10k/month | 80% free |
| **GCS Egress** | 1 GB/month (free tier) | ~500 MB | 50% free |
| **Firestore** | 50k reads/day | ~1k/day | 98% free |

### Usage

```typescript
import { SemanticSearch } from '$lib/semantic';

// In your Svelte component
<SemanticSearch
  onSelect={(noteId) => navigateToMessage(noteId)}
  placeholder="Search by meaning..."
/>
```

```typescript
// Programmatic API
import { searchSimilar, syncEmbeddings, isSearchAvailable } from '$lib/semantic';

// Sync index (automatic on WiFi)
await syncEmbeddings();

// Search for similar messages
const results = await searchSimilar('meeting tomorrow', 10, 0.5);
// Returns: [{ noteId: 'abc123', score: 0.89, distance: 0.11 }, ...]
```

### Privacy Considerations

- **No Content Storage**: Only embeddings stored, not message text
- **Encrypted Messages Excluded**: NIP-17/59 DMs not indexed (v1)
- **Local Processing**: Search runs entirely in browser via WASM
- **User Control**: Manual sync button, no automatic uploads

## Nostr Implementation

### Supported NIPs

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

    subgraph Features["Advanced Features"]
        NIP52["NIP-52<br/>Calendar Events"]
        NIP09["NIP-09<br/>Deletion"]
    end

    NIP01 --> NIP28
    NIP01 --> NIP52
    NIP42 --> NIP17
    NIP44 --> NIP59
    NIP59 --> NIP17
    NIP01 --> NIP25
    NIP01 --> NIP09

    style Core fill:#1e40af,color:#fff
    style Messaging fill:#7c2d12,color:#fff
    style Features fill:#064e3b,color:#fff
```

### NIP Implementation Table

| NIP | Name | Status | Description |
|-----|------|--------|-------------|
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Basic Protocol | ✅ Complete | Core event format and relay communication |
| [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md) | Contact List | ✅ Complete | Following list management |
| [NIP-09](https://github.com/nostr-protocol/nips/blob/master/09.md) | Event Deletion | ✅ Complete | Message deletion support |
| [NIP-11](https://github.com/nostr-protocol/nips/blob/master/11.md) | Relay Information | ✅ Complete | Relay metadata document |
| [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) | Private DMs | ✅ Complete | Sealed rumors for private messaging |
| [NIP-25](https://github.com/nostr-protocol/nips/blob/master/25.md) | Reactions | ✅ Complete | Message reactions (emoji) |
| [NIP-28](https://github.com/nostr-protocol/nips/blob/master/28.md) | Public Chat | ✅ Complete | Group channels with moderation |
| [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) | Authentication | ✅ Complete | Relay authentication challenges |
| [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) | Versioned Encryption | ✅ Complete | Modern encryption for DMs |
| [NIP-52](https://github.com/nostr-protocol/nips/blob/master/52.md) | Calendar Events | ✅ Complete | Event scheduling with RSVP |
| [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Gift Wrap | ✅ Complete | Metadata protection layer |

### Event Kinds

| Kind | NIP | Purpose | Documentation |
|------|-----|---------|---------------|
| 0 | 01 | User Profile | Metadata (name, avatar, bio) |
| 1 | 01 | Text Note | Channel messages |
| 4 | 04 | Encrypted DM | Legacy DMs (read-only) |
| 5 | 09 | Deletion | Delete own messages |
| 7 | 25 | Reaction | Emoji reactions |
| 40 | 28 | Channel Creation | Create channel |
| 41 | 28 | Channel Metadata | Update channel |
| 42 | 28 | Channel Message | Post to channel |
| 1059 | 59 | Gift Wrap | Wrapped DMs |
| 31923 | 52 | Calendar Event | Date-based events |
| 31925 | 52 | Calendar RSVP | Event responses |
| 9022 | Custom | Section Access | Cohort-based channel access control |
| 9023 | Custom | Calendar-Channel Link | Event-chatroom integration |

### Cohort-Based Access Control

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
        MoomaaTribe["moomaa-tribe<br/>Premium members"]
        Public["public<br/>Read-only access"]
    end

    subgraph Access["Channel Access (Kind 9022)"]
        Channel1["meditation-circle<br/>cohorts: [admin, moomaa-tribe]"]
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
    CohortAssign --> MoomaaTribe
    CohortAssign --> Public

    Admin2 -->|Full Access| Channel1
    Admin2 -->|Full Access| Channel2
    Admin2 -->|Full Access| Channel3
    MoomaaTribe -->|Access| Channel1
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

### Calendar Events with Channel Integration (NIP-52)

```mermaid
sequenceDiagram
    participant Admin
    participant App as PWA
    participant Relay as Nostr Relay
    participant Members as Channel Members

    Note over Admin,Members: Create Calendar Event with Channel Link

    Admin->>App: 1. Create Calendar Event
    App->>App: 2. Build Kind 31923 Event
    Note over App: Tags: d (identifier)<br/>title, start, end, location<br/>p (cohorts allowed)

    Admin->>App: 3. Link to Channel (optional)
    App->>App: 4. Create Kind 9023 Event
    Note over App: Links calendar event<br/>to chatroom channel

    App->>Relay: 5. Publish Kind 31923 + 9023
    Relay->>Relay: 6. Verify admin signature
    Relay->>Members: 7. Broadcast to cohort members

    Note over Admin,Members: Member RSVP Flow

    Members->>App: 8. View Event Details
    App->>Relay: 9. Fetch linked channel
    Relay-->>App: 10. Return channel info

    Members->>App: 11. Click "RSVP - Going"
    App->>App: 12. Build Kind 31925 Event
    Note over App: Tags: a (event ref)<br/>status (accepted/declined)
    App->>Relay: 13. Publish RSVP

    Relay->>Admin: 14. Notify organizer
    Members->>App: 15. Join event chatroom
    App->>Relay: 16. Subscribe to channel

    Note over App,Relay: Event chatroom inherits<br/>calendar event cohort access
```

### Admin Workflow

```mermaid
graph LR
    subgraph AdminPanel["Admin Panel"]
        Login["Login with Mnemonic<br/>(BIP-39)"]
        Dashboard["Admin Dashboard"]
    end

    subgraph Management["User Management"]
        Pending["Pending Requests"]
        Approve["Approve Users"]
        AssignCohort["Assign Cohorts"]
        Revoke["Revoke Access"]
    end

    subgraph Content["Content Management"]
        CreateChannel["Create Channels"]
        SetAccess["Set Channel Access"]
        CreateEvent["Create Calendar Events"]
        LinkEvent["Link Events to Channels"]
        Moderate["Moderate Messages"]
    end

    subgraph Monitoring["Monitoring"]
        ViewStats["Channel Statistics"]
        ActiveUsers["Active Users"]
        RSVPList["Event RSVPs"]
    end

    Login -->|NIP-06 Key Derivation| Dashboard
    Dashboard --> Management
    Dashboard --> Content
    Dashboard --> Monitoring

    Pending -->|Review| Approve
    Approve -->|Select| AssignCohort
    AssignCohort -->|Kind 9022| SetAccess

    CreateChannel -->|Kind 40| SetAccess
    SetAccess -->|Cohort Tags| CreateEvent
    CreateEvent -->|Kind 31923| LinkEvent
    LinkEvent -->|Kind 9023| Moderate

    style AdminPanel fill:#b91c1c,color:#fff
    style Management fill:#1e40af,color:#fff
    style Content fill:#065f46,color:#fff
    style Monitoring fill:#6b21a8,color:#fff
```

## User Flows

### Complete User Journey

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
    Chat --> Bookmark[Bookmark Messages]

    DMs --> NewDM[New Conversation]
    NewDM --> SendDM[Send Encrypted DM]
    SendDM --> Receive[Receive DMs]

    Events --> Browse[Browse Events]
    Events --> Create[Create Event]
    Create --> RSVP[RSVP to Events]

    Profile --> Settings[Edit Profile]
    Settings --> Export[Export Data]
    Settings --> Mute[Manage Blocked Users]

    style Start fill:#065f46,color:#fff
    style Dashboard fill:#1e40af,color:#fff
    style Channels fill:#7c2d12,color:#fff
    style DMs fill:#6b21a8,color:#fff
    style Events fill:#b45309,color:#fff
```

### Authentication Flow

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

### Channel Messaging Flow

```mermaid
sequenceDiagram
    participant User
    participant App as PWA
    participant Cache as IndexedDB
    participant Relay as Docker Relay
    participant DB as SQLite
    participant Others as Other Users

    User->>App: 1. Join Channel
    App->>Relay: 2. Subscribe (Kind 40-42)
    Relay->>DB: 3. Query Channel Events
    DB->>Relay: 4. Return Matching Events
    Relay->>App: 5. Stream Existing Messages
    App->>Cache: 6. Cache Messages Locally
    App->>User: 7. Display Channel

    User->>App: 8. Type Message
    App->>App: 9. Create Kind 42 Event
    App->>App: 10. Sign with Private Key
    App->>Relay: 11. Publish Event

    Relay->>Relay: 12. Validate Signature
    Relay->>DB: 13. Store Event
    Relay->>Others: 14. Broadcast to Subscribers
    Relay->>App: 15. Confirm Receipt

    App->>Cache: 16. Update Local Cache
    Others->>Others: 17. Display Message

    Note over Cache: Offline support via IndexedDB
    Note over Relay: NIP-42 auth + cohort check
```

### Gift-Wrapped DM Flow (NIP-17/59)

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
        Note over Relay: Privacy guarantees:<br/>✅ Sender hidden (random key)<br/>✅ Time hidden (fuzzed)<br/>✅ Content encrypted<br/>❌ Recipient visible (p tag)
    end
```

### Offline Message Queue Flow

```mermaid
sequenceDiagram
    participant User
    participant App as PWA
    participant SW as Service Worker
    participant Queue as IndexedDB Queue
    participant Relay as Docker Relay

    Note over App: User goes offline

    User->>App: 1. Send Message
    App->>App: 2. Detect Offline
    App->>Queue: 3. Queue Message
    App->>User: 4. Show "Queued" Status

    Note over User,Relay: Network restored

    SW->>SW: 5. Detect Online
    SW->>Queue: 6. Get Queued Messages
    Queue->>SW: 7. Return Messages

    loop For each queued message
        SW->>Relay: 8. Publish Event
        Relay->>SW: 9. Confirm Receipt
        SW->>Queue: 10. Remove from Queue
    end

    SW->>App: 11. Sync Complete Notification
    App->>User: 12. Update UI

    Note over Queue: Background Sync API<br/>Auto-syncs when online
```

## Project Structure

```
fairfield-nostr/
├── src/
│   ├── lib/
│   │   ├── components/      # Svelte components
│   │   │   ├── auth/        # Login, signup, profile
│   │   │   ├── chat/        # Channel list, messages
│   │   │   ├── dm/          # Direct messages
│   │   │   ├── events/      # Calendar, booking
│   │   │   ├── admin/       # Admin panel
│   │   │   ├── forum/       # Forum-style features
│   │   │   └── ui/          # Reusable UI components
│   │   ├── nostr/           # Nostr protocol implementation
│   │   │   ├── keys.ts      # BIP-39 key generation
│   │   │   ├── encryption.ts # NIP-44 encryption
│   │   │   ├── dm.ts        # NIP-17/59 DM functions
│   │   │   ├── channels.ts  # NIP-28 channels
│   │   │   ├── reactions.ts # NIP-25 reactions
│   │   │   ├── calendar.ts  # NIP-52 events
│   │   │   └── relay.ts     # NDK relay manager
│   │   ├── semantic/        # Semantic vector search
│   │   │   ├── embeddings-sync.ts  # WiFi-only GCS sync
│   │   │   ├── hnsw-search.ts      # WASM vector search
│   │   │   ├── SemanticSearch.svelte # Search UI component
│   │   │   └── index.ts            # Module exports
│   │   ├── stores/          # Svelte stores
│   │   │   ├── auth.ts      # Authentication state
│   │   │   ├── channels.ts  # Channel subscriptions
│   │   │   ├── messages.ts  # Message cache
│   │   │   ├── dm.ts        # DM conversations
│   │   │   ├── pwa.ts       # PWA state
│   │   │   ├── bookmarks.ts # Bookmarked messages
│   │   │   ├── drafts.ts    # Message drafts
│   │   │   └── mute.ts      # Blocked users
│   │   └── utils/           # Helper functions
│   │       ├── storage.ts   # IndexedDB operations
│   │       ├── crypto.ts    # Cryptographic utilities
│   │       ├── search.ts    # Message search
│   │       └── export.ts    # Data export
│   ├── routes/              # SvelteKit routes
│   │   ├── +page.svelte     # Landing page
│   │   ├── chat/            # Chat interface
│   │   ├── dm/              # Direct messages
│   │   ├── events/          # Calendar events
│   │   ├── admin/           # Admin dashboard
│   │   └── settings/        # User settings
│   └── service-worker.ts    # PWA service worker
├── embedding-service/       # Google Cloud Run service
│   ├── src/
│   │   ├── main.py          # FastAPI application
│   │   ├── embeddings.py    # Embedding generation
│   │   ├── hnsw_index.py    # HNSW index builder
│   │   ├── gcs_client.py    # Cloud Storage client
│   │   └── firestore_client.py  # Firestore client
│   ├── Dockerfile           # Container definition
│   ├── requirements.txt     # Python dependencies
│   ├── cloudbuild.yaml      # Cloud Build config
│   └── .gcloudignore        # GCP ignore patterns
├── .github/
│   └── workflows/
│       ├── deploy-pages.yml  # Frontend deployment to GitHub Pages
│       └── deploy-backend.yml  # Backend deployment to Cloud Run
├── static/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   └── icon-*.png           # PWA icons
├── tests/                   # Test suites
│   ├── unit/                # Unit tests
│   └── e2e/                 # E2E tests
├── docs/                    # Documentation
├── svelte.config.js         # SvelteKit config (adapter-static)
└── package.json             # Node dependencies
```

## Configuration

### Environment Variables

```bash
# .env (local development)
VITE_RELAY_URL=wss://your-nostr-relay.com
VITE_ADMIN_PUBKEY=<hex-pubkey>              # Admin public key (64-char hex)
VITE_NDK_DEBUG=false                         # Enable NDK debug logging

# Semantic Search (Cloud Storage public URL)
VITE_GCS_EMBEDDINGS_URL=https://storage.googleapis.com/fairfield-nostr-embeddings

# Cloud Run API
VITE_EMBEDDING_API_URL=https://embedding-api-617806532906.us-central1.run.app

# GCP Configuration (for deployment)
GCP_PROJECT_ID=<your-project-id>
GCP_REGION=us-central1
GCS_BUCKET_NAME=fairfield-nostr-embeddings
```

### GitHub Configuration (for CI/CD)

**Repository Variables** (Settings → Secrets and variables → Actions → Variables):

| Variable | Description |
|----------|-------------|
| `ADMIN_PUBKEY` | Admin public key (64-char hex format) |

**Repository Secrets** (Settings → Secrets and variables → Actions → Secrets):

| Secret | Description |
|--------|-------------|
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_SA_KEY` | Service account JSON key (for Cloud Build) |
| `GCS_BUCKET_NAME` | Cloud Storage bucket name |

The deploy workflow uses `${{ vars.ADMIN_PUBKEY }}` to inject the admin key at build time.

### Cloud Run API Configuration

The embedding service runs on Google Cloud Run. Key configuration:

- **API URL:** `https://embedding-api-617806532906.us-central1.run.app`
- **Region:** `us-central1`
- **Concurrency:** 80 requests per instance
- **Memory:** 2 GB
- **CPU:** 2 vCPU
- **Auto-scaling:** 0 to 10 instances

### PWA Configuration

PWA settings in `static/manifest.json`:

```json
{
  "name": "Minimoonoir",
  "short_name": "Minimoonoir",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a1a1a",
  "theme_color": "#3b82f6",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

## Google Cloud Platform Free Tier

This application is designed to run entirely on GCP's free tier:

### Free Tier Limits

**Cloud Run:**
- 2 million requests per month
- 360,000 GB-seconds of memory
- 180,000 vCPU-seconds of compute
- Scale to zero (no charges when idle)

**Cloud Storage:**
- 5 GB storage
- 5,000 Class A operations (writes) per month
- 50,000 Class B operations (reads) per month
- 1 GB network egress per month

**Firestore:**
- 1 GiB storage
- 50,000 reads per day
- 20,000 writes per day
- 20,000 deletes per day

**Expected Usage (100k messages):**
- Cloud Run: ~10k requests/month (0.5% of limit)
- Storage: ~20 MB (0.4% of limit)
- Reads: ~1k/day (2% of daily limit)
- Egress: ~500 MB/month (50% of monthly limit)

**Cost Estimate:** $0/month on free tier for typical usage

## Deployment

### GitHub Pages (Frontend)

The frontend is automatically deployed via GitHub Actions on every push to `main`:

1. **Setup GitHub Pages:**
   - Go to repository Settings > Pages
   - Source: GitHub Actions
   - Branch: main

2. **GitHub Actions workflow** (`.github/workflows/deploy.yml`):
   ```yaml
   name: Deploy to GitHub Pages
   on:
     push:
       branches: [main]
   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 18
         - run: npm ci
         - run: npm run build
         - uses: actions/upload-pages-artifact@v2
           with:
             path: build
         - uses: actions/deploy-pages@v2
   ```

3. **Manual deployment:**
   ```bash
   npm run build
   npm run deploy
   ```

### Google Cloud Run (Backend)

The embedding API is deployed at `https://embedding-api-617806532906.us-central1.run.app`.

For custom deployments:

**Prerequisites:**
- Google Cloud SDK installed
- GCP project created
- Billing enabled (free tier available)

**Deployment Steps:**

```bash
# Authenticate with GCP
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Create Cloud Storage bucket (first time only)
gsutil mb -l us-central1 gs://fairfield-nostr-embeddings
gsutil iam ch allUsers:objectViewer gs://fairfield-nostr-embeddings

# Build and deploy to Cloud Run
cd embedding-service/
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/embedding-api
gcloud run deploy embedding-api \
  --image gcr.io/YOUR_PROJECT_ID/embedding-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 10
```

**Environment Configuration:**

```bash
# Set environment variables for Cloud Run
gcloud run services update embedding-api \
  --region us-central1 \
  --set-env-vars GCS_BUCKET_NAME=fairfield-nostr-embeddings
```

See also:
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) - Full deployment guide
- [Google Cloud Run Documentation](https://cloud.google.com/run/docs)

### API Endpoints

The Cloud Run service provides the following REST endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |
| `/api/embeddings/generate` | POST | Generate embeddings for messages |
| `/api/embeddings/index` | POST | Build and upload HNSW index |
| `/api/embeddings/manifest` | GET | Get current index version |
| `/api/embeddings/sync` | POST | Trigger full sync pipeline |

## Testing

```bash
# Run all tests
npm test

# Run unit tests
npm test -- unit

# Run E2E tests with Playwright
npm run test:e2e

# Test specific file
npm test src/lib/nostr/dm.test.ts

# Run tests in watch mode
npm test -- --watch
```

## Security Considerations

### Key Management
- Private keys stored encrypted in localStorage
- BIP-39 mnemonic backup for key recovery
- Keys never transmitted to server or relay
- Optional PIN/passphrase protection

### Message Privacy
- NIP-44 encryption for all DMs
- Gift wrap hides sender identity from relay
- Timestamp fuzzing prevents timing analysis
- Content encrypted end-to-end

### Relay Security
- NIP-42 authentication required for writes
- Cohort-based whitelist (business, moomaa-tribe, admin)
- Event validation and signature verification
- NIP-09 deletion support

### Network Security
- HTTPS for GitHub Pages (automatic)
- HTTPS for Cloud Run (Google-managed certificates)
- Content Security Policy headers
- CORS configuration
- Google Cloud Armor protection (available)

### Serverless Security Benefits
- No server to compromise
- Cloud Run provides isolated container execution
- Automatic HTTPS with Google-managed certificates
- Google Cloud's DDoS protection
- IAM-based access control
- Zero-trust architecture

## GitHub Labels

Our project uses a comprehensive labeling system for issue and PR management:

### Priority Labels
- `priority: critical` - Security issues, data loss bugs, service outages
- `priority: high` - Major features, significant bugs affecting many users
- `priority: medium` - Regular features, moderate bugs
- `priority: low` - Nice-to-have features, minor improvements

### Type Labels
- `type: bug` - Something isn't working
- `type: feature` - New feature request
- `type: enhancement` - Improvement to existing feature
- `type: documentation` - Documentation improvements
- `type: refactor` - Code refactoring
- `type: test` - Test-related changes
- `type: security` - Security-related issues

### Area Labels
- `area: api` - Cloud Run API, backend services
- `area: pwa` - Progressive Web App, service worker
- `area: ui/ux` - User interface and experience
- `area: encryption` - NIP-44, NIP-17/59 encryption
- `area: channels` - NIP-28 public channels
- `area: dm` - Direct messaging (NIP-17/59)
- `area: calendar` - NIP-52 calendar events
- `area: admin` - Admin panel and moderation
- `area: deployment` - GitHub Pages, Google Cloud Platform
- `area: embeddings` - Semantic search, vector embeddings

### Status Labels
- `status: needs triage` - Needs review and classification
- `status: blocked` - Blocked by dependencies
- `status: in progress` - Currently being worked on
- `status: needs review` - Awaiting code review
- `status: ready to merge` - Approved and ready

### Special Labels
- `good first issue` - Good for newcomers
- `help wanted` - Extra attention needed
- `breaking change` - Breaking API changes
- `dependencies` - Dependency updates

## API Reference

### Relay Manager

```typescript
import { connectRelay, publishEvent, subscribe } from '$lib/nostr';

// Connect to relay (local development)
await connectRelay('ws://localhost:8080', privateKey);

// Publish event
const event = new NDKEvent();
event.kind = 1;
event.content = 'Hello Nostr!';
await publishEvent(event);

// Subscribe to events
const sub = subscribe({ kinds: [1], limit: 10 });
sub.on('event', (event) => console.log(event));
```

### Direct Messages

```typescript
import { sendDM, receiveDM, createDMFilter } from '$lib/nostr/dm';

// Send encrypted DM
await sendDM('Hello!', recipientPubkey, senderPrivkey, relay);

// Receive and decrypt
const dm = receiveDM(giftWrapEvent, myPrivkey);
console.log(dm.content, dm.senderPubkey);

// Subscribe to DMs
const filter = createDMFilter(myPubkey);
```

### Channel Operations

```typescript
import { createChannel, sendChannelMessage } from '$lib/nostr/channels';

// Create channel (admin only)
await createChannel({
  name: 'General',
  about: 'General discussion',
  picture: 'https://example.com/icon.png'
});

// Send message
await sendChannelMessage(channelId, 'Hello channel!');
```

## Documentation

### Deployment & Operations
- [Deployment Guide](docs/deployment/DEPLOYMENT.md) - Serverless deployment and configuration
- [GCP Architecture](docs/deployment/gcp-architecture.md) - Google Cloud Platform setup
- [GCP Deployment](docs/deployment/GCP_DEPLOYMENT.md) - Cloud Run deployment guide
- [GitHub Workflows](docs/deployment/github-workflows.md) - CI/CD pipeline configuration

### Security
- [Security Audit](docs/security/SECURITY_AUDIT.md) - Security analysis and recommendations
- [Audit Report](docs/security/SECURITY_AUDIT_REPORT.md) - Detailed security findings
- [Admin Key Rotation](docs/security/ADMIN_KEY_ROTATION.md) - Key management procedures
- [SQL Injection Fix](docs/security/security-fix-sql-injection.md) - Database security hardening

### Feature Documentation
- [Direct Messages](docs/features/dm-implementation.md) - NIP-17/59 encrypted messaging
- [Message Threading](docs/features/threading-implementation.md) - Threaded conversations
- [Reactions](docs/features/nip-25-reactions-implementation.md) - NIP-25 emoji reactions
- [Search](docs/features/search-implementation.md) - Semantic & keyword search
- [Mute & Block](docs/features/mute-implementation-summary.md) - User blocking system
- [Pinned Messages](docs/features/pinned-messages-implementation.md) - Pin important messages
- [Link Previews](docs/features/link-preview-implementation.md) - URL preview generation
- [Drafts](docs/features/drafts-implementation.md) - Message draft persistence
- [Export](docs/features/export-implementation.md) - Data export functionality
- [PWA Implementation](docs/features/pwa-implementation.md) - Offline support and installation
- [Notifications](docs/features/notification-system-phase1.md) - Push notification system
- [Accessibility](docs/features/accessibility-improvements.md) - WCAG compliance

### Architecture (SPARC Methodology)
- [Specification](docs/architecture/01-specification.md) - Requirements and specs
- [System Architecture](docs/architecture/02-architecture.md) - System design details
- [Pseudocode](docs/architecture/03-pseudocode.md) - Algorithm design
- [Refinement](docs/architecture/04-refinement.md) - Implementation refinement
- [Completion](docs/architecture/05-completion.md) - Integration and deployment
- [Semantic Search Spec](docs/architecture/06-semantic-search-spec.md) - Vector search requirements
- [Search Architecture](docs/architecture/07-semantic-search-architecture.md) - Embedding pipeline design
- [Search Algorithms](docs/architecture/08-semantic-search-pseudocode.md) - HNSW implementation
- [Risk Assessment](docs/architecture/09-semantic-search-risks.md) - Integration risks

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style
- Write tests for new features
- Update documentation as needed
- Use semantic commit messages
- Ensure all tests pass before submitting PR

## License

MIT License - see [LICENSE](LICENSE) for details.

## Acknowledgments

### Core Technologies

- [Nostr Protocol](https://nostr.com) - Decentralized social protocol specification
- [NDK](https://github.com/nostr-dev-kit/ndk) - Nostr Development Kit by @pablof7z
- [SvelteKit](https://kit.svelte.dev) - Web application framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework

### Infrastructure

- [Google Cloud Run](https://cloud.google.com/run) - Serverless container platform
- [Google Cloud Storage](https://cloud.google.com/storage) - Object storage for vector embeddings
- [Google Firestore](https://cloud.google.com/firestore) - NoSQL metadata database
- [Google Cloud Build](https://cloud.google.com/build) - CI/CD pipeline
- [GitHub Pages](https://pages.github.com) - Static site hosting
- [GitHub Actions](https://github.com/features/actions) - Frontend deployment automation

### Machine Learning

- [sentence-transformers](https://www.sbert.net/) - Multilingual sentence embeddings
- [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) - Compact 384d embedding model
- [hnswlib](https://github.com/nmslib/hnswlib) - Fast approximate nearest neighbor search
- [hnswlib-wasm](https://github.com/nicholascannon/hnswlib-wasm) - Browser-native HNSW via WebAssembly

### Development Tools

- [Agentic QE Fleet](https://github.com/proffesor-for-testing/agentic-qe) - AI-powered quality engineering agents (31 QE agents, 53 QE skills)
- [Claude Code](https://claude.ai/claude-code) - AI-assisted development by Anthropic
- [Claude Flow](https://github.com/ruvnet/claude-flow) - Swarm coordination for parallel development
- [ruv-swarm](https://github.com/ruv/ruv-swarm) - Multi-agent orchestration

### NIPs Implemented

Special thanks to the Nostr community for the NIP specifications:
- NIP-01, NIP-02, NIP-09, NIP-11, NIP-17, NIP-25, NIP-28, NIP-42, NIP-44, NIP-52, NIP-59

### Contributors

- John O'Hare ([@jjohare](https://github.com/jjohare)) - Project lead
- Claude Opus 4.5 / Claude Sonnet 4.5 - AI development assistance

## Support

- Documentation: See [docs/](docs/) directory
- Issues: [GitHub Issues](https://github.com/jjohare/minimoonoir/issues)
- Discussions: [GitHub Discussions](https://github.com/jjohare/minimoonoir/discussions)
