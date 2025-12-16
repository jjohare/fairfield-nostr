[← Back to Main README](../../README.md)

# Minimoonoir - SPARC Architecture

> **Phase:** Architecture Design
> **Version:** 0.1.0-draft
> **Date:** 2024-12-11
> **[Back to Main README](../../README.md)**

---

## 1. System Overview

```mermaid
graph TB
    subgraph ClientLayer["CLIENT LAYER"]
        subgraph PWA["PWA (Progressive Web App)"]
            Auth["Auth Module<br/>- Keygen<br/>- Mnemonic<br/>- Storage"]
            Chat["Chat Module<br/>- Channels<br/>- Messages<br/>- DMs"]
            Admin["Admin Module<br/>- User management<br/>- Join approvals<br/>- Moderation"]
        end
        subgraph NDK["Nostr SDK (NDK)"]
            Signing["Event signing"]
            Encryption["NIP-44 encryption"]
            Subs["Subscription mgmt"]
        end
    end

    subgraph RelayLayer["RELAY LAYER (Cloudflare Workers)"]
        subgraph Relay["Cloudflare Workers Relay"]
            NIP42["NIP-42 AUTH<br/>- Pubkey whitelist<br/>- Challenge"]
            Groups["Group Logic<br/>- Membership<br/>- Roles<br/>- Moderation"]
            Store["Event Store (Durable Objects)<br/>- Messages<br/>- Metadata<br/>- Deletion support"]
        end
        Backup["Backup Service<br/>- Durable Objects snapshots<br/>- R2 storage sync"]
    end

    Auth --> NDK
    Chat --> NDK
    Admin --> NDK
    NDK -->|"WSS (WebSocket Secure)"| Relay
    Relay --> Backup
```

---

## 2. Component Architecture

### 2.1 Frontend Components

```mermaid
graph TB
    subgraph SRC["src/"]
        subgraph LIB["lib/"]
            subgraph NOSTR["nostr/"]
                keys["keys.ts - NIP-06 key generation"]
                encryption["encryption.ts - NIP-44 E2E"]
                events["events.ts - Event creation/signing"]
                relay["relay.ts - NDK connection"]
                ndk["ndk.ts - NDK singleton"]
                dm["dm.ts - NIP-17/59 DM handling"]
                channels["channels.ts - Channel operations"]
                groups["groups.ts - NIP-29 groups"]
                reactions["reactions.ts - NIP-25 reactions"]
                calendar["calendar.ts - NIP-52 events"]
            end
            subgraph STORES["stores/"]
                authStore["auth.ts - Authentication state"]
                channelsStore["channels.ts - Channel subscriptions"]
                messagesStore["messages.ts - Message cache"]
                dmStore["dm.ts - DM state"]
                muteStore["mute.ts - Mute/block lists"]
                bookmarksStore["bookmarks.ts - User bookmarks"]
                draftsStore["drafts.ts - Message drafts"]
                reactionsStore["reactions.ts - Reaction state"]
                notificationsStore["notifications.ts - Notifications"]
                pinnedStore["pinnedMessages.ts - Pinned msgs"]
                prefsStore["preferences.ts - User prefs"]
            end
            subgraph UTILS["utils/"]
                storage["storage.ts - localStorage/IndexedDB"]
                crypto["crypto.ts - BIP39 utils"]
                search["search.ts - Message search"]
                export["export.ts - Data export"]
                mentions["mentions.ts - @mentions"]
                linkPreview["linkPreview.ts - URL previews"]
            end
        end
        subgraph COMPONENTS["lib/components/"]
            subgraph AUTH["auth/"]
                Signup["Signup.svelte"]
                Login["Login.svelte"]
                KeyBackup["KeyBackup.svelte"]
                AuthFlow["AuthFlow.svelte"]
                MnemonicDisplay["MnemonicDisplay.svelte"]
            end
            subgraph CHAT["chat/"]
                ChannelList["ChannelList.svelte"]
                MessageList["MessageList.svelte"]
                MessageInput["MessageInput.svelte"]
                MessageItem["MessageItem.svelte"]
                ChannelHeader["ChannelHeader.svelte"]
                ReactionBar["ReactionBar.svelte"]
                ReactionPicker["ReactionPicker.svelte"]
                GlobalSearch["GlobalSearch.svelte"]
                BookmarksModal["BookmarksModal.svelte"]
                PinnedMessages["PinnedMessages.svelte"]
                MuteButton["MuteButton.svelte"]
                LinkPreview["LinkPreview.svelte"]
                ExportModal["ExportModal.svelte"]
            end
            subgraph DM["dm/"]
                DMView["DMView.svelte"]
                ConversationList["ConversationList.svelte"]
                NewDMDialog["NewDMDialog.svelte"]
            end
            subgraph ADMIN["admin/"]
                Dashboard["Dashboard.svelte"]
                ChannelManager["ChannelManager.svelte"]
                PendingRequests["PendingRequests.svelte"]
                UserList["UserList.svelte"]
                AdminExport["AdminExport.svelte"]
            end
            subgraph EVENTS["events/"]
                EventCalendar["EventCalendar.svelte"]
                EventCard["EventCard.svelte"]
                UpcomingEvents["UpcomingEvents.svelte"]
                CreateEventModal["CreateEventModal.svelte"]
            end
            subgraph FORUM["forum/"]
                ChannelCard["ChannelCard.svelte"]
                ChannelStats["ChannelStats.svelte"]
                BoardStats["BoardStats.svelte"]
                ActivityGraph["ActivityGraph.svelte"]
            end
            subgraph UI["ui/"]
                Modal["Modal.svelte"]
                Button["Button.svelte"]
                Avatar["Avatar.svelte"]
                Toast["Toast.svelte"]
                NotificationBell["NotificationBell.svelte"]
            end
        end
        subgraph ROUTES["routes/"]
            homePage["+page.svelte - Landing"]
            chatPage["chat/+page.svelte - Channels"]
            channelDetail["chat/[channelId]/+page.svelte"]
            adminPage["admin/+page.svelte - Admin"]
            adminStats["admin/stats/+page.svelte"]
            adminCalendar["admin/calendar/+page.svelte"]
            dmPage["dm/+page.svelte - DM List"]
            dmConvo["dm/[pubkey]/+page.svelte"]
            eventsPage["events/+page.svelte"]
            signupPage["signup/+page.svelte"]
            setupPage["setup/+page.svelte"]
            settingsMuted["settings/muted/+page.svelte"]
        end
    end
```

**Key Directories:**

| Directory | Purpose |
|-----------|---------|
| `src/lib/nostr/` | Nostr protocol implementation (NIPs 01, 06, 09, 17, 25, 28, 29, 42, 44, 52, 59) |
| `src/lib/stores/` | Svelte stores for reactive state management |
| `src/lib/utils/` | Helper utilities for storage, crypto, search, export |
| `src/lib/components/` | Reusable Svelte 5 components organized by feature |
| `src/routes/` | SvelteKit file-based routing |
| `static/` | PWA assets (manifest, icons, service worker) |

### 2.2 Relay Configuration (Cloudflare Workers)

```typescript
// relay/workers/config.ts
export const relayConfig = {
  info: {
    name: "Minimoonoir Private Relay",
    description: "Private relay for Minimoonoir community",
    supported_nips: [1, 2, 9, 11, 29, 42, 44, 59],
  },

  // NIP-42 Authentication Required
  auth: {
    enabled: true,
    challenge_timeout: 60,
  },

  // Write Policy
  writePolicy: {
    // Only authenticated users can write
    require_auth: true,
    // Whitelist managed by admin
    use_pubkey_whitelist: true,
  },

  // No federation
  upstream: [],

  // Storage via Durable Objects
  storage: {
    use_durable_objects: true,
    max_size: 1073741824,  // 1GB
  },
};
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
interface MinimoonoirDB {
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

```mermaid
sequenceDiagram
    participant User
    participant PWA
    participant Relay
    participant Admin

    User->>PWA: 1. Signup
    PWA->>User: 2. Generate mnemonic
    User->>PWA: 3. Copy & confirm
    PWA->>Relay: 4. Connect WSS
    Relay->>PWA: 5. AUTH challenge
    PWA->>Relay: 6. Sign & respond
    Relay->>PWA: 7. Pubkey not whitelisted
    PWA->>Admin: 8. Request system access
    Admin->>Relay: 9. Admin approves
    Relay->>PWA: 10. Add to whitelist
    PWA->>User: 11. Access granted
```

---

## 5. Channel Access Flow

```mermaid
flowchart TD
    A["User requests channel list"] --> B["Filter by user's cohort tag"]
    B --> C["Listed channels"]
    B --> D["Preview channels"]
    B --> E["Unlisted channels"]

    C --> F{"Is member?"}
    F -->|Yes| G["Show channel + msgs"]
    F -->|No| H["Show preview + join button"]

    D --> I["Show name + desc + 'Request Join'"]

    E --> J["Hidden from discovery<br/>(invite only)"]
```

---

## 6. Encryption Architecture

### 6.1 Channel Messages (NIP-29 Groups)

**Non-Encrypted Channels** (Common Rooms, Event Channels)

```mermaid
flowchart LR
    Client -->|"plaintext msg"| Relay
    Relay -->|"plaintext"| Members
```

- Relay can read content
- Admin implicitly has access (relay owner)
- Simple, performant
- NIP-29 membership enforcement

**E2E Encrypted Channels** (Private Course Rooms)

```mermaid
flowchart LR
    subgraph Sender
        S1["1. Get group keys"]
        S2["2. NIP44 encrypt for each member"]
    end
    subgraph Relay
        R1["3. Store encrypted blob"]
    end
    subgraph Recipients
        T1["4. Decrypt with own key"]
    end

    S1 --> S2
    S2 --> R1
    R1 --> T1
```

- Relay sees encrypted blob only
- Admin in room = admin has key = can decrypt
- O(n) encryption per message for n members
- Suitable for <100 member groups

### 6.2 Direct Messages (NIP-17 + NIP-59)

```mermaid
sequenceDiagram
    participant Sender
    participant Relay
    participant Recipient

    Note over Sender: 1. Create sealed rumor (kind 14)<br/>- Encrypt content with NIP-44<br/>- Real timestamp
    Note over Sender: 2. Wrap with gift-wrap (kind 1059)<br/>- Random sender key<br/>- Fuzzed timestamp<br/>- Encrypt sealed rumor
    Sender->>Relay: Publish gift-wrap
    Note over Relay: Sees only gift-wrap<br/>- Random pubkey<br/>- Fuzzed time<br/>- Encrypted blob
    Relay->>Recipient: Deliver gift-wrap
    Note over Recipient: 3. Unwrap gift
    Note over Recipient: 4. Decrypt rumor
```

**Admin CANNOT read DMs** (no access to recipient's privkey)

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

**Public Nostr (Federation)**

```mermaid
flowchart LR
    User -->|msg| RelayA["Relay A"]
    RelayA --> RelayB["Relay B"]
    RelayB --> RelayC["Relay C"]
    User -->|delete| RelayA
    RelayA -.->|"???"| RelayB
    RelayB -.->|"???"| RelayC
```

*Problem: No guarantee other relays honor deletion*

**Minimoonoir (Closed Relay)**

```mermaid
flowchart TB
    User -->|msg| MinimoonoirRelay["Minimoonoir Relay (ONLY)"]
    User -->|delete| MinimoonoirRelay
    MinimoonoirRelay -->|"Event removed"| LMDB[(LMDB)]
```

*Guarantee: We control the only relay, deletion is real*

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
| Core Relay | Cloudflare Workers | Edge deployment, global distribution |
| Storage | Durable Objects | Consistent state, WebSocket support |
| Group Logic | Custom NIP-29 impl | Full control over group features |
| CDN/Proxy | Cloudflare | Auto-HTTPS, WebSocket, DDoS protection |

### 8.3 Infrastructure

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Hosting | Cloudflare Workers + Pages | Serverless, global edge |
| Storage | Durable Objects + R2 | Persistent state, backup storage |
| Monitoring | Cloudflare Analytics | Built-in metrics and logging |

---

## 9. Deployment Architecture

```mermaid
graph TB
    subgraph Cloudflare["Cloudflare Edge"]
        subgraph Pages["Cloudflare Pages"]
            PWA["PWA (static SPA)<br/>Global CDN"]
        end

        subgraph Workers["Cloudflare Workers"]
            Relay["Relay Worker<br/>WebSocket endpoint"]
        end

        subgraph DO["Durable Objects"]
            State["Relay State<br/>Event storage"]
        end

        subgraph Storage["R2 Storage"]
            Backup["Event Backups<br/>Snapshots"]
        end

        PWA -->|"WSS"| Relay
        Relay --> State
        State -->|"periodic"| Backup
    end
```

---

*Next Phase: Pseudocode & Data Flow (03-pseudocode.md)*
