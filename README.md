# Minimoonoir

A privacy-first community messaging platform built on the Nostr protocol. Features NIP-52 calendar events, NIP-28 public chat channels, NIP-17/59 encrypted direct messages, and cohort-based access control.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Nostr](https://img.shields.io/badge/Nostr-Protocol-purple.svg)](https://nostr.com)
[![SvelteKit](https://img.shields.io/badge/SvelteKit-5.x-orange.svg)](https://kit.svelte.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange.svg)](https://workers.cloudflare.com)

> **Note:** This branch contains the legacy Docker-based architecture.
>
> **For the current serverless implementation, see the [`cloudflare-serverless`](https://github.com/jjohare/minimoonoir/tree/cloudflare-serverless) branch.**
>
> The serverless architecture uses:
> - **GitHub Pages** for PWA hosting (free)
> - **Cloudflare Workers** with nosflare relay
> - **D1 Database** for whitelist/cohort access control
> - **Durable Objects** for event storage
> - **Zero infrastructure costs** on free tier

## Features

- **Public Chat Channels** - NIP-28 group messaging with cohort-based access control
- **Calendar Events** - NIP-52 event scheduling with RSVP support
- **Encrypted DMs** - NIP-17/59 gift-wrapped private messages
- **PWA Support** - Installable app with offline message queue
- **Serverless Architecture** - Zero infrastructure costs on free tier
- **Cohort-Based Access** - Business, moomaa-tribe, and admin roles

## Quick Start

**Recommended: Use the [`cloudflare-serverless`](https://github.com/jjohare/minimoonoir/tree/cloudflare-serverless) branch for the latest implementation.**

```bash
# Clone and switch to serverless branch
git clone https://github.com/jjohare/minimoonoir.git
cd minimoonoir
git checkout cloudflare-serverless

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your relay URL and admin pubkey

# Start development server
npm run dev

# Access: http://localhost:5173
```

### Legacy Docker Deployment (This Branch)

```bash
# Build the PWA
npm install
npm run build

# Start services with Docker Compose
docker-compose up -d

# Access the application
# Website: http://localhost:8080
# Relay:   ws://localhost:8080/relay
```

## Architecture

### System Overview

```mermaid
graph TB
    subgraph Internet["Internet Access"]
        User["Web Browser"]
        Tunnel["Cloudflare Tunnel<br/>(Optional HTTPS)"]
    end

    subgraph Docker["Docker Container :8080"]
        subgraph Nginx["nginx :80"]
            Static["Static Files<br/>/var/www/html"]
            WSProxy["WebSocket Proxy<br/>/relay → :7777"]
        end

        subgraph Strfry["strfry :7777"]
            LMDB[(LMDB Database)]
            Auth["NIP-42 Auth Plugin"]
            Groups["NIP-29 Groups"]
        end

        Supervisor["supervisord<br/>(Process Manager)"]
    end

    User -->|HTTPS| Tunnel
    Tunnel -->|HTTP :80| Nginx
    User -.->|HTTP<br/>(local)| Nginx

    Static -->|SvelteKit SPA| User
    WSProxy <-->|WebSocket| Strfry
    Strfry --> LMDB
    Strfry --> Auth
    Strfry --> Groups

    Supervisor -->|manages| Nginx
    Supervisor -->|manages| Strfry

    style Docker fill:#1e3a8a,color:#fff
    style Internet fill:#064e3b,color:#fff
```

### Deployment Options

```mermaid
graph LR
    subgraph Option1["Option 1: Direct Access"]
        Browser1["Browser"] -->|HTTP :8080| Docker1["Docker Container"]
    end

    subgraph Option2["Option 2: Cloudflare Tunnel"]
        Browser2["Browser"] -->|HTTPS| CF["Cloudflare Edge"]
        CF -->|Tunnel| Docker2["Docker Container :80"]
    end

    subgraph Option3["Option 3: Reverse Proxy"]
        Browser3["Browser"] -->|HTTPS :443| Proxy["nginx/Caddy"]
        Proxy -->|HTTP :8080| Docker3["Docker Container"]
    end

    style Option1 fill:#065f46,color:#fff
    style Option2 fill:#1e40af,color:#fff
    style Option3 fill:#6b21a8,color:#fff
```

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
        NIP29["NIP-29<br/>Groups"]
    end

    NIP01 --> NIP28
    NIP01 --> NIP52
    NIP42 --> NIP17
    NIP44 --> NIP59
    NIP59 --> NIP17
    NIP01 --> NIP25
    NIP01 --> NIP09
    NIP01 --> NIP29

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
| [NIP-29](https://github.com/nostr-protocol/nips/blob/master/29.md) | Groups | ✅ Complete | Relay-based groups with moderation |
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
| 9 | 29 | Group Chat | Group messages |
| 10 | 29 | Group Metadata | Group info |
| 11 | 29 | Group Admins | Admin list |
| 12 | 29 | Group Members | Member list |
| 40 | 28 | Channel Creation | Create channel |
| 41 | 28 | Channel Metadata | Update channel |
| 42 | 28 | Channel Message | Post to channel |
| 1059 | 59 | Gift Wrap | Wrapped DMs |
| 31923 | 52 | Calendar Event | Date-based events |
| 31925 | 52 | Calendar RSVP | Event responses |

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
    participant Relay as Nostr Relay

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
    participant Relay as Nostr Relay
    participant Others as Other Users

    User->>App: 1. Join Channel
    App->>Relay: 2. Subscribe (Kind 40-42)
    Relay->>App: 3. Stream Existing Messages
    App->>Cache: 4. Cache Messages Locally
    App->>User: 5. Display Channel

    User->>App: 6. Type Message
    App->>App: 7. Create Kind 42 Event
    App->>App: 8. Sign with Private Key
    App->>Relay: 9. Publish Event

    Relay->>Relay: 10. Validate Signature
    Relay->>Relay: 11. Store in LMDB
    Relay->>Others: 12. Broadcast to Subscribers
    Relay->>App: 13. Confirm Receipt

    App->>Cache: 14. Update Local Cache
    Others->>Others: 15. Display Message

    Note over Cache: Offline support via IndexedDB
    Note over Relay: NIP-42 auth required for writes
```

### Gift-Wrapped DM Flow (NIP-17/59)

```mermaid
sequenceDiagram
    participant Alice
    participant App as PWA
    participant Relay as Nostr Relay
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
    participant Relay as Nostr Relay

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
minimoonoir/
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
│   │   │   ├── groups.ts    # NIP-29 groups
│   │   │   ├── reactions.ts # NIP-25 reactions
│   │   │   ├── calendar.ts  # NIP-52 events
│   │   │   └── relay.ts     # NDK relay manager
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
├── relay/
│   ├── strfry.conf          # Relay configuration
│   ├── strfry-dev.conf      # Development config
│   └── whitelist.json       # Authorized pubkeys
├── static/                  # Static assets
│   ├── manifest.json        # PWA manifest
│   └── icon-*.png           # PWA icons
├── tests/                   # Test suites
│   ├── unit/                # Unit tests
│   └── e2e/                 # E2E tests
├── docs/                    # Documentation
│   ├── DEPLOYMENT.md        # Deployment guide
│   ├── SECURITY_AUDIT.md    # Security documentation
│   ├── dm-implementation.md # DM implementation
│   ├── pwa-implementation.md # PWA guide
│   └── sparc/               # SPARC methodology docs
├── Dockerfile               # Multi-stage Docker build
├── docker-compose.yml       # Deployment config
├── nginx.conf               # Web server config
└── package.json             # Node dependencies
```

## Configuration

### Environment Variables

```bash
# .env
VITE_RELAY_URL=ws://localhost:8080/relay    # Relay WebSocket URL
VITE_ADMIN_PUBKEY=<hex-pubkey>              # Admin public key (hex)
VITE_NDK_DEBUG=false                         # Enable NDK debug logging
```

### Relay Configuration

The strfry relay is configured in `relay/strfry.conf`:

```conf
relay {
    name = "Minimoonoir Private Relay"
    bind = "127.0.0.1"
    port = 7777
    noTLS = true
}

events {
    maxEventSize = 65536
    maxNumTags = 2000
}

negentropy {
    enabled = true
    maxSyncEvents = 1000000
}
```

## Docker Deployment

### Using Docker Compose

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Rebuild after code changes
npm run build && docker-compose restart

# Access
# Website: http://localhost:8080
# Relay:   ws://localhost:8080/relay
```

### Endpoints

| Path | Service | Description |
|------|---------|-------------|
| `/` | nginx | PWA static files |
| `/relay` | strfry | Nostr WebSocket |
| `/relay/` | strfry | NIP-11 relay info (HTTP GET) |
| `/health` | nginx | Health check endpoint |

### With Cloudflare Tunnel

```bash
# Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# Create tunnel
cloudflared tunnel login
cloudflared tunnel create minimoonoir
cloudflared tunnel route dns minimoonoir chat.yourdomain.com

# Configure (~/.cloudflared/config.yml)
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: chat.yourdomain.com
    service: http://localhost:8080
  - service: http_status:404

# Run tunnel
cloudflared tunnel run minimoonoir
```

### With Reverse Proxy

```bash
# Caddy example
chat.example.com {
    reverse_proxy localhost:8080
}

# nginx example
server {
    listen 443 ssl http2;
    server_name chat.example.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /relay {
        proxy_pass http://localhost:8080/relay;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

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
- Optional whitelist for private communities
- Rate limiting and event validation
- NIP-09 deletion support

### Network Security
- HTTPS required in production (via Cloudflare Tunnel or reverse proxy)
- WebSocket Secure (WSS) for relay connections
- Content Security Policy headers
- CORS configuration

## GitHub Labels

Our project uses a comprehensive labeling system for issue and PR management:

### Priority Labels
- `priority: critical` 🔴 - Security issues, data loss bugs, service outages
- `priority: high` 🟠 - Major features, significant bugs affecting many users
- `priority: medium` 🟡 - Regular features, moderate bugs
- `priority: low` 🟢 - Nice-to-have features, minor improvements

### Type Labels
- `type: bug` 🐛 - Something isn't working
- `type: feature` ✨ - New feature request
- `type: enhancement` 🚀 - Improvement to existing feature
- `type: documentation` 📚 - Documentation improvements
- `type: refactor` 🔧 - Code refactoring
- `type: test` 🧪 - Test-related changes
- `type: security` 🔒 - Security-related issues

### Area Labels
- `area: relay` 📡 - Strfry relay, NIP implementation
- `area: pwa` 📱 - Progressive Web App, service worker
- `area: ui/ux` 🎨 - User interface and experience
- `area: encryption` 🔐 - NIP-44, NIP-17/59 encryption
- `area: channels` 💬 - NIP-28 public channels
- `area: dm` 📨 - Direct messaging (NIP-17/59)
- `area: calendar` 📅 - NIP-52 calendar events
- `area: admin` 👑 - Admin panel and moderation
- `area: deployment` 🚢 - Docker, deployment, infrastructure

### Status Labels
- `status: needs triage` 🏷️ - Needs review and classification
- `status: blocked` 🚫 - Blocked by dependencies
- `status: in progress` 🔄 - Currently being worked on
- `status: needs review` 👀 - Awaiting code review
- `status: ready to merge` ✅ - Approved and ready

### Special Labels
- `good first issue` 🌱 - Good for newcomers
- `help wanted` 🆘 - Extra attention needed
- `breaking change` ⚠️ - Breaking API changes
- `dependencies` 📦 - Dependency updates

## API Reference

### Relay Manager

```typescript
import { connectRelay, publishEvent, subscribe } from '$lib/nostr';

// Connect to relay
await connectRelay('ws://localhost:8080/relay', privateKey);

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

### User Guides
- [Deployment Guide](docs/DEPLOYMENT.md) - Docker deployment and configuration
- [Security Audit](docs/SECURITY_AUDIT.md) - Security analysis and recommendations
- [PWA Implementation](docs/pwa-implementation.md) - Offline support and installation
- [DM Implementation](docs/dm-implementation.md) - NIP-17/59 encrypted messaging

### Feature Documentation
- [Calendar Events](docs/events-module-example.md) - NIP-52 calendar implementation
- [Message Threading](docs/threading-implementation.md) - Threaded conversations
- [Reactions](docs/nip-25-reactions-implementation.md) - NIP-25 emoji reactions
- [Search](docs/search-implementation.md) - Global message search
- [Mute & Block](docs/mute-implementation-summary.md) - User blocking system
- [Pinned Messages](docs/pinned-messages-implementation.md) - Pin important messages
- [Link Previews](docs/link-preview-implementation.md) - URL preview generation
- [Drafts](docs/drafts-implementation.md) - Message draft persistence
- [Export](docs/export-implementation.md) - Data export functionality

### Architecture Documentation
- [System Architecture](docs/sparc/02-architecture.md) - System design details
- [Specification](docs/sparc/01-specification.md) - Requirements and specs
- [Pseudocode](docs/sparc/03-pseudocode.md) - Algorithm design
- [Refinement](docs/sparc/04-refinement.md) - Implementation refinement
- [Completion](docs/sparc/05-completion.md) - Integration and deployment

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

- [Nostr Protocol](https://nostr.com) - The protocol specification
- [NDK](https://github.com/nostr-dev-kit/ndk) - Nostr Development Kit
- [strfry](https://github.com/hoytech/strfry) - High-performance Nostr relay
- [SvelteKit](https://kit.svelte.dev) - Web application framework
- [Tailwind CSS](https://tailwindcss.com) - Utility-first CSS framework

## Support

- Documentation: See [docs/](docs/) directory
- Issues: [GitHub Issues](https://github.com/your-username/minimoonoir/issues)
- Discussions: [GitHub Discussions](https://github.com/your-username/minimoonoir/discussions)
