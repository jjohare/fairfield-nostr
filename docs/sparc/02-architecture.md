# Fairfield Nostr - SPARC Architecture

> **Phase:** Architecture Design
> **Version:** 0.1.0-draft
> **Date:** 2024-12-11

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    PWA (Progressive Web App)                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │   │
│  │  │ Auth Module  │  │ Chat Module  │  │ Admin Module          │  │   │
│  │  │ - Keygen     │  │ - Channels   │  │ - User management     │  │   │
│  │  │ - Mnemonic   │  │ - Messages   │  │ - Join approvals      │  │   │
│  │  │ - Storage    │  │ - DMs        │  │ - Moderation          │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────────────┘  │   │
│  │                           │                                       │   │
│  │              ┌────────────┴────────────┐                         │   │
│  │              │      Nostr SDK (NDK)     │                         │   │
│  │              │  - Event signing         │                         │   │
│  │              │  - NIP-44 encryption     │                         │   │
│  │              │  - Subscription mgmt     │                         │   │
│  │              └────────────┬────────────┘                         │   │
│  └───────────────────────────│─────────────────────────────────────┘   │
│                              │ WSS (WebSocket Secure)                   │
└──────────────────────────────│─────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RELAY LAYER                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                 strfry + relay29 (NIP-29 Groups)                  │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │   │
│  │  │ NIP-42 AUTH  │  │ Group Logic  │  │ Event Store (LMDB)    │  │   │
│  │  │ - Pubkey     │  │ - Membership │  │ - Messages            │  │   │
│  │  │   whitelist  │  │ - Roles      │  │ - Metadata            │  │   │
│  │  │ - Challenge  │  │ - Moderation │  │ - Deletion support    │  │   │
│  │  └──────────────┘  └──────────────┘  └───────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                              │                                          │
│              ┌───────────────┴───────────────┐                         │
│              │      Backup Service           │                         │
│              │  - Incremental LMDB snapshots │                         │
│              │  - Cloud storage sync         │                         │
│              └───────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Architecture

### 2.1 Frontend Components

```
src/
├── lib/
│   ├── nostr/
│   │   ├── keys.ts           # NIP-06 key generation, mnemonic
│   │   ├── encryption.ts     # NIP-44 E2E encryption
│   │   ├── events.ts         # Event creation, signing
│   │   └── relay.ts          # NDK relay connection
│   │
│   ├── stores/
│   │   ├── auth.ts           # User authentication state
│   │   ├── channels.ts       # Channel subscriptions
│   │   ├── messages.ts       # Message cache (IndexedDB)
│   │   └── cohort.ts         # User cohort state
│   │
│   └── utils/
│       ├── storage.ts        # localStorage/IndexedDB helpers
│       └── crypto.ts         # Mnemonic utils (bip39)
│
├── components/
│   ├── auth/
│   │   ├── Signup.svelte     # Mnemonic generation flow
│   │   ├── Login.svelte      # Key restoration
│   │   └── KeyBackup.svelte  # Copy mnemonic UI
│   │
│   ├── chat/
│   │   ├── ChannelList.svelte
│   │   ├── ChannelView.svelte
│   │   ├── MessageInput.svelte
│   │   ├── MessageList.svelte
│   │   └── DMList.svelte
│   │
│   └── admin/
│       ├── Dashboard.svelte
│       ├── JoinRequests.svelte
│       ├── UserManagement.svelte
│       └── ChannelAdmin.svelte
│
├── routes/
│   ├── +page.svelte          # Landing/login
│   ├── chat/+page.svelte     # Main chat interface
│   ├── admin/+page.svelte    # Admin portal
│   └── dm/[pubkey]/+page.svelte
│
└── service-worker.ts         # PWA offline support
```

### 2.2 Relay Configuration

```yaml
# strfry.conf
relay:
  info:
    name: "Fairfield Private Relay"
    description: "Closed relay for Fairfield community"
    supported_nips: [1, 2, 9, 11, 29, 42, 44, 59]

  # NIP-42 Authentication Required
  auth:
    enabled: true
    challenge_timeout: 60

  # Write Policy
  writePolicy:
    # Only authenticated users can write
    require_auth: true
    # Whitelist managed by admin
    pubkey_whitelist: "/etc/strfry/whitelist.json"

  # No federation
  upstream: []

  # Local storage
  storage:
    path: "/var/lib/strfry/data"
    max_size: 1073741824  # 1GB
```

---

## 3. Data Models

### 3.1 Nostr Event Kinds Used

| Kind | NIP | Purpose |
|------|-----|---------|
| 0 | 01 | User metadata (profile) |
| 1 | 01 | Short text note (channel messages) |
| 4 | 04 | Encrypted DM (legacy, read-only) |
| 5 | 09 | Deletion request |
| 9 | 29 | Group chat message |
| 10 | 29 | Group metadata |
| 11 | 29 | Group admin list |
| 12 | 29 | Group members |
| 1059 | 59 | Gift-wrapped event (DMs) |
| 9000 | 29 | Group add user |
| 9001 | 29 | Group remove user |
| 9005 | 29 | Group delete event |

### 3.2 Custom Tags

```typescript
// Cohort tag for channel filtering
interface CohortTag {
  tag: "cohort";
  values: ["business" | "moomaa-tribe" | "both"];
}

// Join request status
interface JoinRequestTag {
  tag: "join-request";
  values: [channelId: string, status: "pending" | "approved" | "rejected"];
}

// Channel visibility
interface VisibilityTag {
  tag: "visibility";
  values: ["listed" | "unlisted" | "preview"];
}
```

### 3.3 IndexedDB Schema (Client-side Cache)

```typescript
interface FairfieldDB {
  // Cached messages for offline access
  messages: {
    id: string;           // Event ID
    channelId: string;
    pubkey: string;
    content: string;      // Decrypted content
    created_at: number;
    deleted: boolean;
  };

  // Channel metadata
  channels: {
    id: string;
    name: string;
    description: string;
    cohort: "business" | "moomaa-tribe" | "both";
    visibility: "listed" | "unlisted" | "preview";
    memberCount: number;
    isMember: boolean;
    isEncrypted: boolean;
  };

  // Pending requests
  joinRequests: {
    id: string;
    channelId: string;
    requestedAt: number;
    status: "pending" | "approved" | "rejected";
  };

  // User's key material (encrypted)
  keys: {
    pubkey: string;
    encryptedPrivkey: string;  // Encrypted with PIN/passphrase
  };
}
```

---

## 4. Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │     │  PWA     │     │  Relay   │     │  Admin   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                │                │
     │  1. Signup     │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │  2. Generate   │                │                │
     │     mnemonic   │                │                │
     │<───────────────│                │                │
     │                │                │                │
     │  3. Copy &     │                │                │
     │     confirm    │                │                │
     │───────────────>│                │                │
     │                │                │                │
     │                │  4. Connect    │                │
     │                │     WSS        │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │  5. AUTH       │                │
     │                │     challenge  │                │
     │                │<───────────────│                │
     │                │                │                │
     │                │  6. Sign &     │                │
     │                │     respond    │                │
     │                │───────────────>│                │
     │                │                │                │
     │                │  7. Pubkey not │                │
     │                │     whitelisted│                │
     │                │<───────────────│                │
     │                │                │                │
     │                │  8. Request    │                │
     │                │     system     │                │
     │                │     access     │───────────────>│
     │                │                │                │
     │                │                │  9. Admin      │
     │                │                │     approves   │
     │                │                │<───────────────│
     │                │                │                │
     │                │  10. Add to    │                │
     │                │      whitelist │                │
     │                │<───────────────│                │
     │                │                │                │
     │  11. Access    │                │                │
     │      granted   │                │                │
     │<───────────────│                │                │
     │                │                │                │
```

---

## 5. Channel Access Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Channel Access Decision Tree                  │
└─────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │ User requests   │
                    │ channel list    │
                    └────────┬────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Filter by user's│
                    │ cohort tag      │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌──────────┐   ┌──────────┐   ┌──────────┐
       │ Listed   │   │ Preview  │   │ Unlisted │
       │ channels │   │ channels │   │ channels │
       └────┬─────┘   └────┬─────┘   └────┬─────┘
            │              │              │
            ▼              ▼              │
     ┌────────────┐  ┌────────────┐       │
     │ Is member? │  │ Show name  │       │
     └─────┬──────┘  │ + desc     │       │
           │         │ + "Request │       │
     ┌─────┴─────┐   │    Join"   │       │
     │           │   └────────────┘       │
     ▼           ▼                        ▼
┌─────────┐ ┌─────────┐            ┌─────────────┐
│ Show    │ │ Show    │            │ Hidden from │
│ channel │ │ preview │            │ discovery   │
│ + msgs  │ │ + join  │            │ (invite     │
└─────────┘ │ button  │            │  only)      │
            └─────────┘            └─────────────┘
```

---

## 6. Encryption Architecture

### 6.1 Channel Messages (NIP-29 Groups)

```
┌────────────────────────────────────────────────────────────┐
│                 NON-ENCRYPTED CHANNELS                      │
│  (Common Rooms, Event Channels)                             │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Client ──[plaintext msg]──> Relay ──[plaintext]──> Members │
│                                                             │
│  - Relay can read content                                   │
│  - Admin implicitly has access (relay owner)                │
│  - Simple, performant                                       │
│  - NIP-29 membership enforcement                            │
│                                                             │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│                 E2E ENCRYPTED CHANNELS                      │
│  (Private Course Rooms)                                     │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │ Sender  │    │   Relay     │    │   Recipients        │ │
│  │         │    │             │    │                     │ │
│  │ 1. Get  │    │             │    │                     │ │
│  │    group│    │             │    │                     │ │
│  │    keys │    │             │    │                     │ │
│  │         │    │             │    │                     │ │
│  │ 2. NIP44│    │             │    │                     │ │
│  │  encrypt├───>│ 3. Store    │    │                     │ │
│  │  for    │    │    encrypted├───>│ 4. Decrypt with     │ │
│  │  each   │    │    blob     │    │    own key          │ │
│  │  member │    │             │    │                     │ │
│  └─────────┘    └─────────────┘    └─────────────────────┘ │
│                                                             │
│  - Relay sees encrypted blob only                          │
│  - Admin in room = admin has key = can decrypt             │
│  - O(n) encryption per message for n members               │
│  - Suitable for <100 member groups                         │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

### 6.2 Direct Messages (NIP-17 + NIP-59)

```
┌────────────────────────────────────────────────────────────┐
│                 GIFT-WRAPPED DMs                            │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐                              ┌─────────────┐  │
│  │ Sender  │                              │  Recipient  │  │
│  │         │                              │             │  │
│  │ 1. Create sealed rumor (kind 14)       │             │  │
│  │    - Encrypt content with NIP-44       │             │  │
│  │    - Real timestamp                    │             │  │
│  │                                        │             │  │
│  │ 2. Wrap with gift-wrap (kind 1059)     │             │  │
│  │    - Random sender key                 │             │  │
│  │    - Fuzzed timestamp                  │             │  │
│  │    - Encrypt sealed rumor              │             │  │
│  │         │                              │             │  │
│  │         ▼                              │             │  │
│  │    ┌─────────┐                         │             │  │
│  │    │  Relay  │  (sees only gift-wrap)  │             │  │
│  │    │         │  - Random pubkey        │             │  │
│  │    │         │  - Fuzzed time          │             │  │
│  │    │         │  - Encrypted blob       │             │  │
│  │    └────┬────┘                         │             │  │
│  │         │                              │             │  │
│  │         └─────────────────────────────>│ 3. Unwrap   │  │
│  │                                        │    gift     │  │
│  │                                        │             │  │
│  │                                        │ 4. Decrypt  │  │
│  │                                        │    rumor    │  │
│  └────────────────────────────────────────┴─────────────┘  │
│                                                             │
│  Admin CANNOT read DMs (no access to recipient's privkey)  │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## 7. Deletion Strategy

### 7.1 Local Relay Deletion (Supported)

```typescript
// User deletes their own message
async function deleteMessage(eventId: string, privkey: string) {
  // Create NIP-09 deletion event
  const deletionEvent = {
    kind: 5,
    pubkey: getPublicKey(privkey),
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ["e", eventId],  // Event to delete
    ],
    content: "Deleted by user",
  };

  // Sign and publish
  const signed = await signEvent(deletionEvent, privkey);
  await relay.publish(signed);

  // Local relay WILL honor deletion
  // (configured to respect NIP-09 from event author)
}

// Admin force-delete (NIP-29 kind 9005)
async function adminDeleteMessage(eventId: string, channelId: string) {
  const deletionEvent = {
    kind: 9005,
    tags: [
      ["h", channelId],
      ["e", eventId],
    ],
    content: "Removed by admin",
  };
  // ... sign with admin key
}
```

### 7.2 Why Local-Only Enables True Deletion

```
┌─────────────────────────────────────────────────────────────┐
│              PUBLIC NOSTR (Federation)                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User ──[msg]──> Relay A ──> Relay B ──> Relay C            │
│                     │           │           │                │
│  User ──[delete]──> Relay A    ???         ???              │
│                                                              │
│  Problem: No guarantee other relays honor deletion           │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              FAIRFIELD (Closed Relay)                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User ──[msg]──> Fairfield Relay (ONLY)                     │
│                        │                                     │
│  User ──[delete]──> Fairfield Relay                         │
│                        │                                     │
│                        ▼                                     │
│                  [Event removed from LMDB]                   │
│                                                              │
│  Guarantee: We control the only relay, deletion is real     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Technology Stack

### 8.1 Frontend

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Framework | SvelteKit | Lightweight, PWA-friendly, good DX |
| Nostr SDK | NDK (@nostr-dev-kit/ndk) | High-level, well-maintained |
| Styling | Tailwind CSS | Rapid UI development |
| Storage | IndexedDB (Dexie) | Offline message cache |
| Build | Vite | Fast HMR, PWA plugin |

### 8.2 Relay

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Core Relay | strfry | High-performance, LMDB storage |
| Group Logic | relay29 | NIP-29 implementation |
| Container | Docker | Easy deployment, backup |
| Reverse Proxy | Caddy | Auto-HTTPS, WebSocket |

### 8.3 Infrastructure

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Hosting | Self-hosted (VPS/local) | Data sovereignty |
| Backup | Restic + B2/S3 | Incremental, encrypted |
| Monitoring | Prometheus + Grafana | Relay metrics |

---

## 9. Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Machine / VPS                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Docker Compose                      │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │   Caddy     │  │   strfry    │  │   PWA       │  │   │
│  │  │   :443      │  │   :7777     │  │   (static)  │  │   │
│  │  │             │  │             │  │   :3000     │  │   │
│  │  │  HTTPS      │  │  WebSocket  │  │             │  │   │
│  │  │  + reverse  │──│  relay      │  │             │  │   │
│  │  │    proxy    │  │             │  │             │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  │         │                │                           │   │
│  │         │                │                           │   │
│  │         ▼                ▼                           │   │
│  │  ┌─────────────────────────────────────────────┐    │   │
│  │  │           Persistent Volumes                 │    │   │
│  │  │  /data/strfry (LMDB)  │  /data/backup       │    │   │
│  │  └─────────────────────────────────────────────┘    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Backup Service (cron)                   │   │
│  │  - Daily: LMDB snapshot                              │   │
│  │  - Sync to cloud (B2/S3)                             │   │
│  │  - 30-day retention                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

*Next Phase: Pseudocode & Data Flow (03-pseudocode.md)*
