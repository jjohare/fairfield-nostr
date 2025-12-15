# Nosflare Nostr Relay - Architectural Analysis

## Executive Summary

Nosflare is a **serverless Nostr relay** implementation built entirely on Cloudflare's edge computing platform. It demonstrates advanced distributed systems architecture using Cloudflare Workers, Durable Objects, Queues, R2 storage, and edge caching to achieve global scale without traditional infrastructure.

**Current State**: Production-ready, version 8.9.26, supports 24 Nostr Implementation Possibilities (NIPs)

**Core Innovation**: Zero-server architecture achieving millisecond latencies globally through edge distribution

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         EDGE LAYER                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ relay-worker │  │    Cache     │  │  WebSocket   │         │
│  │  (router)    │──│   (global)   │  │  Handler     │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DURABLE OBJECTS LAYER                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐      │
│  │ ConnectionDO  │  │SessionManager │  │ EventShardDO  │      │
│  │ (per-client)  │  │   DO (50x)    │  │ (time-sharded)│      │
│  └───────────────┘  └───────────────┘  └───────────────┘      │
│  ┌───────────────┐                                              │
│  │  PaymentDO    │  Stateful, strongly consistent              │
│  │  (sharded)    │  Distributed across edge locations          │
│  └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       QUEUE LAYER                               │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐     │
│  │ Indexing Queue │  │ Broadcast Queue│  │ R2 Archive   │     │
│  │  (4 replicas)  │  │    (10 shards) │  │    Queue     │     │
│  │  (50 shards)   │  │                │  │              │     │
│  └────────────────┘  └────────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      STORAGE LAYER                              │
│  ┌───────────────┐  ┌───────────────┐                          │
│  │ DO Storage    │  │   R2 Bucket   │                          │
│  │  (per-DO)     │  │  (archive)    │                          │
│  └───────────────┘  └───────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Key Design Patterns

1. **Edge-First Architecture**: All logic runs at Cloudflare's edge locations (275+ worldwide)
2. **Durable Objects for State**: Strongly consistent, globally distributed state management
3. **Queue-Based Decoupling**: Asynchronous event processing with automatic retries
4. **Time-Sharded Storage**: Events partitioned by 24-hour windows for efficient querying
5. **Read Replica Strategy**: 4 replicas per time shard for high-availability reads

---

## 2. Cloudflare-Specific Components

### 2.1 Durable Objects (Core State Management)

#### **ConnectionDO** - WebSocket Connection Handler
- **Purpose**: One Durable Object per WebSocket connection (when sharding enabled)
- **Responsibilities**:
  - WebSocket lifecycle management
  - Session state (subscriptions, authentication, rate limiting)
  - Real-time event filtering and broadcasting
  - NIP-42 authentication (AUTH command)
  - Rate limiting (10 EVENT/min, 100 REQ/min)
- **State**:
  - Subscriptions map (subscription_id → filters)
  - Authenticated pubkeys (NIP-42)
  - Payment cache (10s TTL)
  - Rate limiter tokens
- **Scalability**: Configured via `CONNECTION_DO_SHARDING_ENABLED` (true = 1 DO per connection)

#### **SessionManagerDO** - Subscription Index (50 shards)
- **Purpose**: Centralized subscription matching and event broadcasting
- **Sharding**: Events distributed by `kind % 50` to balance load
- **Responsibilities**:
  - Maintain subscription registry (sessionId → filters)
  - Index subscriptions by kind, author, and tags
  - Match incoming events to active subscriptions
  - Fan-out events to ConnectionDO instances
- **State**:
  - kindIndex, authorIndex, tagIndex (in-memory for performance)
  - Session TTL: 30 minutes, cleanup every 5 minutes
- **Performance**: Batch broadcasts (900 connections per batch) to avoid subrequest limits

#### **EventShardDO** - Time-Sharded Event Storage
- **Purpose**: Store and query events within 24-hour time windows
- **Sharding Strategy**:
  - Base shard: `shard-${timestamp / 86400}`
  - 4 read replicas per shard: `shard-${window}-r0` to `shard-${window}-r3`
- **Responsibilities**:
  - Event persistence (MessagePack serialization)
  - Multi-dimensional indexing (kind, author, tags, pubkey+kind, tag+kind, timestamp)
  - Replaceable event handling (NIP-16: kinds 0, 3, 10000-19999)
  - Addressable event handling (NIP-33: kinds 30000-39999)
  - Event expiration (NIP-40: expiration tag)
  - Full-text search (kind 1 content tokenization)
- **Storage Limits**:
  - 500,000 events per shard
  - 50,000 entries per index (200,000 for created_at index)
  - Index trimming with storage fallback
- **State**:
  - Event data (MessagePack in DO storage)
  - Sorted indices (binary search for O(log n) lookups)
  - Deletion tracking (for kind 5 deletion events)
  - Expiration index (hourly cleanup via alarms)

#### **PaymentDO** - Payment Tracking (Sharded)
- **Purpose**: Track paid pubkeys for pay-to-relay feature
- **Sharding**: By first 4 characters of pubkey (when `PAYMENT_DO_SHARDING_ENABLED = true`)
- **Responsibilities**:
  - Check payment status (with expiration)
  - Record new payments
  - Remove expired payments
- **State**: Map of pubkey → PaymentRecord (with expiresAt timestamp)

### 2.2 Cloudflare Queues (Async Processing)

#### **Indexing Queues** (200 total: 4 replicas × 50 shards)
- **Purpose**: Decouple event ingestion from indexing
- **Replicas**: PRIMARY, REPLICA_ENAM, REPLICA_WEUR, REPLICA_APAC
- **Sharding**: Events distributed by `abs(hash(event.id)) % 50`
- **Flow**:
  ```
  relay-worker → queueEvent() → INDEXING_QUEUE_${REPLICA}_${shard}
    → processIndexingQueue() → insertEventsIntoShard() → EventShardDO
  ```
- **Features**:
  - Automatic retries on failure
  - Backpressure detection (500ms average latency threshold)
  - Ephemeral event filtering (kinds 20000-29999 not persisted)

#### **Broadcast Queues** (10 shards: BROADCAST_QUEUE_0 to BROADCAST_QUEUE_9)
- **Purpose**: Distribute new events to active subscriptions
- **Sharding**: By `kind % SESSION_MANAGER_SHARD_COUNT` (default 50 → 10 queues)
- **Flow**:
  ```
  relay-worker → queueEvent() → BROADCAST_QUEUE_${shardNum}
    → broadcast-consumer → SessionManagerDO → ConnectionDO
  ```
- **Features**:
  - Event deduplication (by event.id)
  - Pre-serialization for performance
  - Batch processing

#### **R2 Archive Queue** (1 queue)
- **Purpose**: Archive events to R2 for long-term storage
- **Flow**:
  ```
  indexEventsInCFNDB() → R2_ARCHIVE_QUEUE → r2-archive-consumer
    → NOSTR_ARCHIVE.put(events/raw/${eventId}.json)
  ```
- **Format**: JSON files at `events/raw/${eventId}.json`

### 2.3 Cloudflare R2 Storage (NOSTR_ARCHIVE)

- **Purpose**: Cold storage for all events (except ephemeral kinds 20000-29999)
- **Structure**:
  ```
  events/raw/${eventId}.json  (raw Nostr event JSON)
  ```
- **Usage**:
  - Event archival via R2_ARCHIVE_QUEUE
  - Deletion validation (verify ownership before deleting)
  - Fallback storage (if DO storage fails)

### 2.4 Cloudflare Cache API

- **Event Deduplication Cache** (1 hour TTL)
  - Key: `https://event-cache/${event.id}`
  - Prevents duplicate event processing
- **Query Result Cache** (5 minutes TTL)
  - Key: `https://query-cache/${normalizedFilters}`
  - Normalized by rounding timestamps to 60-second buckets
  - Reduces duplicate queries

---

## 3. Core Functionality

### 3.1 Event Ingestion Pipeline

```
1. WebSocket EVENT message → ConnectionDO.handleEvent()
   ├─ Signature verification (Schnorr with @noble/curves)
   ├─ Rate limiting (10 EVENT/min per pubkey)
   ├─ Payment check (if PAY_TO_RELAY_ENABLED)
   ├─ NIP-05 validation (optional)
   ├─ Content filtering (blocked pubkeys, kinds, phrases)
   └─ Timestamp validation (946684800 to 2147483647)

2. ConnectionDO → relay-worker.processEvent()
   ├─ NIP-42 AUTH check (if AUTH_REQUIRED)
   ├─ NIP-40 expiration check
   └─ Kind 5 deletion handling

3. relay-worker → queueEvent()
   ├─ Deduplication (Cache API, 1h TTL)
   ├─ Shard selection (abs(hash(event.id)) % 50)
   ├─ Replica selection (4 replicas: PRIMARY, ENAM, WEUR, APAC)
   └─ Queue dispatch (4 messages to indexing queues)

4. Indexing Queue Consumer → indexEventsInCFNDB()
   ├─ Filter ephemeral events (kinds 20000-29999)
   ├─ Batch events by shard (getEventShardId by created_at)
   └─ Parallel writes to all 4 replicas per shard

5. EventShardDO.handleInsert()
   ├─ Batched insertion (max 20 events, 50ms delay)
   ├─ Replaceable/Addressable logic (replace older events)
   ├─ Multi-index updates (kind, author, tags, pubkey+kind, etc.)
   ├─ Content indexing (full-text search for kind 1)
   └─ Expiration tracking (NIP-40)

6. Broadcast to Subscribers
   ├─ relay-worker → BROADCAST_QUEUE_${kind % 50}
   ├─ broadcast-consumer → SessionManagerDO.processEvents()
   ├─ Match events to subscriptions (kind/author/tag indices)
   └─ Fan-out to ConnectionDO instances (batch 900 at a time)
```

### 3.2 Query/Subscription Pipeline

```
1. WebSocket REQ message → ConnectionDO.handleReq()
   ├─ Rate limiting (100 REQ/min)
   ├─ Filter validation (kinds required, max 5000 ids/authors/tags)
   ├─ Store subscription (sessionId → filters)
   └─ Register with SessionManagerDO shards (by kinds)

2. ConnectionDO → relay-worker.queryEvents()
   ├─ Time range calculation (default: 30 days, max: 30 days)
   ├─ Shard selection (getShardsForFilter: 1 shard per day)
   └─ Query result caching (5min TTL)

3. relay-worker → shard-router.queryShards()
   ├─ Parallel queries to all relevant shards (reverse chronological)
   ├─ Read replica selection (hash(subscriptionId) % 4)
   ├─ Lazy backfill (if replica empty, query r0, backfill in background)
   └─ Result merging (deduplication, limit to 10,000 max)

4. EventShardDO.handleQuery()
   ├─ Filter optimization (composite indices: pubkey+kind, tag+kind)
   ├─ Binary search on sorted indices
   ├─ Full-text search (for 'search' parameter)
   ├─ Event retrieval (MessagePack deserialization)
   └─ Storage fallback (if index trimmed, load full index from DO storage)

5. Result streaming → ConnectionDO
   ├─ Filter events (expiration, privacy for kind 1059)
   ├─ Send EVENT messages (one per matching event)
   └─ Send EOSE (End of Stored Events)

6. Real-time updates (after EOSE)
   ├─ New events → broadcast-consumer → SessionManagerDO
   ├─ Match against stored subscriptions
   └─ Push to ConnectionDO → send EVENT to WebSocket
```

### 3.3 Supported NIPs (Nostr Implementation Possibilities)

- **NIP-01**: Basic protocol flow (EVENT, REQ, CLOSE, OK, NOTICE)
- **NIP-02**: Contact lists and petnames (kind 3)
- **NIP-04**: Encrypted direct messages (kind 4)
- **NIP-05**: Mapping Nostr keys to DNS-based internet identifiers
- **NIP-09**: Event deletion (kind 5)
- **NIP-11**: Relay information document (application/nostr+json)
- **NIP-12**: Generic tag queries (#e, #p, #a, #t, #d, #h)
- **NIP-15**: Marketplace listings (kinds 30017, 30018)
- **NIP-16**: Event treatment (replaceable events: 0, 3, 10000-19999)
- **NIP-17**: Private direct messages (kind 14, 1059 gift wrap)
- **NIP-20**: Command results (OK message with status)
- **NIP-22**: Event created_at limits
- **NIP-23**: Long-form content (kind 30023)
- **NIP-33**: Parameterized replaceable events (30000-39999 with d-tag)
- **NIP-40**: Expiration timestamp (expiration tag)
- **NIP-42**: Authentication of clients to relays (AUTH command)
- **NIP-50**: Search capability (search parameter in REQ)
- **NIP-51**: Lists (kinds 30000-30003)
- **NIP-58**: Badges (kinds 30008, 30009, 8)
- **NIP-65**: Relay list metadata (kind 10002)
- **NIP-71**: Video events (kinds 34235, 34236)
- **NIP-78**: App-specific data (kinds 30078)
- **NIP-89**: Recommended application handlers (kinds 31989, 31990)
- **NIP-94**: File metadata (kind 1063)

---

## 4. Migration Strategy: Cloudflare → Docker + PostgreSQL

### 4.1 Architectural Comparison

| Component | Cloudflare Architecture | Docker + PostgreSQL Architecture |
|-----------|------------------------|----------------------------------|
| **Runtime** | Workers (V8 isolates, edge) | Node.js containers (single/cluster) |
| **State** | Durable Objects (globally distributed) | PostgreSQL database (centralized/replicated) |
| **WebSocket** | Durable Objects (per-connection) | ws library + in-memory Map |
| **Event Storage** | DO storage + R2 (time-sharded) | PostgreSQL tables (indexed by timestamp) |
| **Async Processing** | Cloudflare Queues | BullMQ/Faktory + Redis |
| **Caching** | Cloudflare Cache API (edge) | Redis + in-memory LRU |
| **Scaling** | Automatic (edge locations) | Horizontal (load balancer + multiple containers) |
| **Consistency** | Strong (per-DO) | ACID (PostgreSQL transactions) |
| **Latency** | ~5-50ms (edge proximity) | ~50-200ms (datacenter round-trip) |

### 4.2 Component Mapping

#### **ConnectionDO → WebSocket Server + Session Store**
```typescript
// Cloudflare: Durable Object with built-in persistence
class ConnectionDO {
  private sessions: Map<string, SessionState>;
  // State persists across WebSocket disconnects
}

// Docker: Node.js WebSocket server + Redis/PostgreSQL
class WebSocketServer {
  private connections = new Map<string, WebSocket>();
  private redis = new RedisClient(); // Session state

  async handleConnection(ws: WebSocket) {
    const sessionId = uuid();
    const session = await this.redis.get(`session:${sessionId}`) || createSession();
    this.connections.set(sessionId, ws);
  }
}
```

#### **EventShardDO → PostgreSQL Tables**
```sql
-- Time-sharded events table
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  kind INTEGER NOT NULL,
  tags JSONB NOT NULL,
  content TEXT,
  sig TEXT NOT NULL
);

-- Indices (replaces DO in-memory indices)
CREATE INDEX idx_events_created_at ON events (created_at DESC);
CREATE INDEX idx_events_kind ON events (kind, created_at DESC);
CREATE INDEX idx_events_pubkey ON events (pubkey, created_at DESC);
CREATE INDEX idx_events_pubkey_kind ON events (pubkey, kind, created_at DESC);
CREATE INDEX idx_events_tags ON events USING GIN (tags); -- for tag queries
CREATE INDEX idx_events_content ON events USING GIN (to_tsvector('english', content)); -- full-text

-- Replaceable events (NIP-16)
CREATE UNIQUE INDEX idx_replaceable ON events (kind, pubkey)
  WHERE kind IN (0, 3, 40) OR (kind >= 10000 AND kind < 20000);

-- Addressable events (NIP-33)
CREATE UNIQUE INDEX idx_addressable ON events (kind, pubkey, (tags->>'d'))
  WHERE kind >= 30000 AND kind < 40000;

-- Deletions (NIP-09)
CREATE TABLE deletions (
  deleted_event_id TEXT PRIMARY KEY,
  deleted_by_pubkey TEXT NOT NULL,
  deleted_at INTEGER NOT NULL
);
```

#### **Cloudflare Queues → BullMQ + Redis**
```typescript
// Cloudflare: Built-in queue system
await env.INDEXING_QUEUE_PRIMARY_0.send({ event, timestamp });

// Docker: BullMQ with Redis
import { Queue } from 'bullmq';
const indexingQueue = new Queue('indexing', { connection: redis });
await indexingQueue.add('index-event', { event, timestamp });

// Worker process
const worker = new Worker('indexing', async (job) => {
  const { event } = job.data;
  await indexEventInPostgres(event);
}, { connection: redis });
```

#### **SessionManagerDO → Redis Pub/Sub + In-Memory Index**
```typescript
// Cloudflare: Durable Object with subscription registry
class SessionManagerDO {
  private sessions: Map<string, SessionData>;
  async processEvents(events: NostrEvent[]) {
    // Match events to subscriptions, broadcast to ConnectionDOs
  }
}

// Docker: Redis Pub/Sub for event distribution
class SubscriptionManager {
  private redis = new RedisClient();
  private kindIndex = new Map<number, Set<string>>(); // in-memory

  async registerSubscription(sessionId: string, filters: NostrFilter[]) {
    await this.redis.sadd(`subs:${sessionId}`, JSON.stringify(filters));
    // Update in-memory index
    filters.forEach(f => f.kinds?.forEach(k =>
      this.kindIndex.get(k)?.add(sessionId)
    ));
  }

  async broadcastEvent(event: NostrEvent) {
    // Match event to subscriptions using index
    const sessions = this.kindIndex.get(event.kind) || new Set();
    for (const sessionId of sessions) {
      await this.redis.publish(`session:${sessionId}`, JSON.stringify(event));
    }
  }
}
```

### 4.3 Migration Challenges & Solutions

#### **Challenge 1: Global Distribution → Single/Multi-Region Deployment**
- **Cloudflare**: Automatic edge deployment (275+ locations)
- **Docker**: Manual multi-region setup with geo-routing
- **Solution**:
  - Single region for MVP (accept higher latency)
  - Multi-region with read replicas (PostgreSQL streaming replication)
  - GeoDNS routing (AWS Route 53, Cloudflare DNS)

#### **Challenge 2: Strong Consistency (Durable Objects) → Eventual Consistency**
- **Cloudflare**: Per-DO strong consistency (single-threaded)
- **Docker**: PostgreSQL ACID for writes, Redis for caching (eventual consistency)
- **Solution**:
  - PostgreSQL transactions for critical operations (payment, deletions)
  - Redis cache with TTL (accept stale reads for performance)
  - Event sourcing pattern for audit trail

#### **Challenge 3: Automatic Scaling → Manual Scaling**
- **Cloudflare**: Infinite scale (Workers auto-scale)
- **Docker**: Fixed capacity (container count)
- **Solution**:
  - Kubernetes with HPA (Horizontal Pod Autoscaler)
  - Metrics-based scaling (CPU, memory, connection count)
  - Load balancer with health checks

#### **Challenge 4: Time-Sharded Storage → Partitioned Tables**
- **Cloudflare**: EventShardDO per 24-hour window (automatic sharding)
- **Docker**: PostgreSQL table partitioning
- **Solution**:
  ```sql
  -- Range partitioning by created_at (monthly partitions)
  CREATE TABLE events (
    id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    -- ... other columns
  ) PARTITION BY RANGE (created_at);

  -- Create partitions (automated with pg_partman)
  CREATE TABLE events_2024_01 PARTITION OF events
    FOR VALUES FROM (1704067200) TO (1706745599); -- Jan 2024
  ```

#### **Challenge 5: Queue-Based Architecture → Job Queue + Workers**
- **Cloudflare**: Queues with automatic retries, backpressure
- **Docker**: BullMQ + Redis with manual worker management
- **Solution**:
  - Separate worker containers for indexing, broadcast, archival
  - BullMQ priority queues (high priority for real-time broadcast)
  - Dead-letter queues for failed jobs
  - Prometheus metrics for queue depth monitoring

#### **Challenge 6: Payment Sharding → Centralized Payment Table**
- **Cloudflare**: PaymentDO sharded by pubkey prefix
- **Docker**: Single payments table with index
- **Solution**:
  ```sql
  CREATE TABLE payments (
    pubkey TEXT PRIMARY KEY,
    paid_at TIMESTAMP NOT NULL,
    amount_sats INTEGER NOT NULL,
    expires_at TIMESTAMP
  );
  CREATE INDEX idx_payments_expires_at ON payments (expires_at);
  ```

### 4.4 Recommended Migration Path

#### **Phase 1: MVP Docker Deployment (Single Region)**
1. PostgreSQL database with partitioning (by month)
2. Node.js WebSocket server (ws library)
3. Redis for session state, caching, pub/sub
4. BullMQ for async job processing
5. Nginx for load balancing
6. S3/MinIO for event archival (replace R2)

**Architecture**:
```
┌─────────────┐
│   Nginx     │ (Load Balancer + SSL)
└──────┬──────┘
       │
   ┌───┴────┐
   │        │
┌──▼──┐  ┌──▼──┐
│ WS1 │  │ WS2 │ (WebSocket Servers)
└──┬──┘  └──┬──┘
   │        │
   └────┬───┘
        │
┌───────▼────────┐     ┌────────────┐
│  PostgreSQL    │◄────│   Redis    │
│   (Primary)    │     │ (Cache/Pub)│
└────────────────┘     └────────────┘
        │
        │
┌───────▼────────┐
│  MinIO/S3      │ (Archival)
└────────────────┘
```

#### **Phase 2: Multi-Region Deployment**
1. PostgreSQL streaming replication (primary → read replicas)
2. GeoDNS routing (route to nearest region)
3. Redis Cluster (for global session state)
4. S3 cross-region replication

#### **Phase 3: Horizontal Scaling**
1. Kubernetes deployment (HPA for WebSocket pods)
2. PostgreSQL connection pooling (PgBouncer)
3. Redis Cluster (sharding for high throughput)
4. Prometheus + Grafana monitoring

### 4.5 Cost Comparison

| Resource | Cloudflare (Estimated) | Docker + AWS (Estimated) |
|----------|------------------------|---------------------------|
| Compute (Workers) | $5/million requests | N/A |
| Durable Objects | $0.15/million requests + $0.20/GB-month storage | N/A |
| Queues | $0.40/million operations | N/A |
| R2 Storage | $0.015/GB-month, $0.36/million Class B ops | $0.023/GB-month (S3 Standard) |
| **Total (1M events/day)** | **~$50-200/month** | **~$200-500/month** (EC2 t3.medium × 2, RDS db.t3.medium, ElastiCache) |

**Note**: Cloudflare has higher upfront complexity but lower operational cost at scale. Docker requires more DevOps overhead but offers full control.

---

## 5. Key Technical Decisions

### 5.1 Why Durable Objects for ConnectionDO?

**Rationale**:
- Strong consistency: Each WebSocket connection has isolated state
- Automatic persistence: Session state survives Worker restarts
- Built-in WebSocket handling: No external WebSocket server needed
- Edge proximity: Connection runs closest to client (low latency)

**Trade-off**: Higher cost per connection (~$0.15/million requests) vs. centralized WebSocket server

### 5.2 Why Time-Sharded EventShardDO?

**Rationale**:
- Query efficiency: Most queries are recent (temporal locality)
- Bounded growth: Each shard has max 500k events (predictable performance)
- Parallel queries: Multiple shards queried concurrently (faster results)
- Horizontal scaling: New shards created automatically (24-hour windows)

**Trade-off**: Complex shard routing logic vs. simpler single-table approach

### 5.3 Why 4 Read Replicas per Shard?

**Rationale**:
- High availability: If one replica fails, others serve requests
- Load distribution: Subscriptions pinned to specific replica (consistent hashing)
- Lazy backfill: New replicas pull data from replica-0 on first query

**Trade-off**: 4× write amplification (every event written to 4 replicas)

### 5.4 Why Queue-Based Architecture?

**Rationale**:
- Decoupling: Event ingestion fast-path (WebSocket) decoupled from indexing (slow)
- Retry logic: Automatic retries on indexing failures
- Backpressure: Queues buffer spikes in event volume

**Trade-off**: Eventual consistency (events not immediately queryable)

### 5.5 Why SessionManagerDO Sharding by Kind?

**Rationale**:
- Load balancing: Popular kinds (kind 1 notes) distributed across shards
- Index locality: Subscriptions for kind 1 isolated from kind 3 (contacts)
- Horizontal scaling: More shards = more throughput

**Trade-off**: 50 SessionManagerDO instances vs. single centralized instance

---

## 6. Performance Characteristics

### 6.1 Latency Analysis

| Operation | Cloudflare Latency | Docker Latency (Single Region) |
|-----------|-------------------|--------------------------------|
| Event publish (WebSocket → OK) | 10-50ms | 50-150ms |
| Query (REQ → EOSE) | 50-200ms | 100-500ms |
| Real-time broadcast (new event → subscribers) | 20-100ms | 100-300ms |
| Event indexing (queue → DO/DB) | 100-500ms (async) | 200-1000ms (async) |

**Factors**:
- Cloudflare: Edge proximity (5-20ms to nearest edge location)
- Docker: Datacenter round-trip (50-150ms regional, 200-500ms intercontinental)

### 6.2 Scalability Limits

| Resource | Cloudflare Limit | Docker Limit (Single Instance) |
|----------|------------------|--------------------------------|
| WebSocket connections | ~10,000 per ConnectionDO (infinite with sharding) | ~10,000 per container (CPU/memory bound) |
| Events/second (writes) | ~1,000/sec per shard (50 shards = 50k/sec) | ~1,000/sec (PostgreSQL bottleneck) |
| Events/second (reads) | ~10,000/sec (4 replicas × 50 shards = 200k/sec) | ~5,000/sec (PostgreSQL read replicas) |
| Storage | Unlimited (R2 + DO storage) | Limited by disk (EBS volumes, grow on-demand) |
| Subrequests | 1,000 per Worker invocation (hard limit) | N/A |

**Bottlenecks**:
- Cloudflare: Subrequest limit (1,000) caps query fan-out (30 days × 50 shards = 1,500 subrequests)
- Docker: PostgreSQL write throughput (single primary), connection pooling

### 6.3 Cost Scaling

**Cloudflare** (Pay-per-use):
- Small relay (100 events/day): ~$5/month
- Medium relay (10k events/day): ~$50/month
- Large relay (1M events/day): ~$500/month

**Docker** (Fixed cost + scaling):
- Small relay: $100/month (t3.small instances)
- Medium relay: $300/month (t3.medium + RDS)
- Large relay: $1,000+/month (multi-region, read replicas, Redis Cluster)

**Break-even**: ~10k events/day (Cloudflare becomes cheaper at higher scale)

---

## 7. Recommended Approach

### 7.1 Stay with Cloudflare if:
✅ Targeting global audience (low-latency worldwide)
✅ Unpredictable traffic (auto-scaling without capacity planning)
✅ Minimal DevOps (serverless, no server management)
✅ High availability requirements (edge redundancy built-in)
✅ Budget scales with usage (pay-per-request model)

### 7.2 Migrate to Docker if:
✅ Self-hosted requirement (data sovereignty, private infrastructure)
✅ Cost predictability (fixed monthly cost, not usage-based)
✅ Full control over stack (custom PostgreSQL tuning, extensions)
✅ Existing infrastructure (Kubernetes cluster, PostgreSQL knowledge)
✅ Airgapped deployment (no external dependencies)

### 7.3 Hybrid Approach:
Consider **dual deployment**:
1. **Cloudflare**: Public relay (global edge, public users)
2. **Docker**: Private relay (internal users, cohort-based access control)

**Benefits**:
- Leverage Cloudflare scale for public traffic
- Maintain private infrastructure for sensitive data
- Gradual migration path (test Docker deployment before full cutover)

---

## 8. Migration Implementation Checklist

### Phase 1: Foundation (Week 1-2)
- [ ] Set up PostgreSQL with partitioned events table
- [ ] Implement Node.js WebSocket server (ws library)
- [ ] Configure Redis for session state + caching
- [ ] Create BullMQ queues (indexing, broadcast, archival)
- [ ] Port event validation logic (signature verification, rate limiting)

### Phase 2: Core Relay Logic (Week 3-4)
- [ ] Implement REQ filter parsing + query optimization
- [ ] Port replaceable/addressable event logic (NIP-16, NIP-33)
- [ ] Implement subscription matching (kind/author/tag indices)
- [ ] Add Redis pub/sub for real-time broadcast
- [ ] Port NIP-42 authentication (AUTH command)

### Phase 3: Advanced Features (Week 5-6)
- [ ] Implement NIP-40 event expiration (cron job + index)
- [ ] Add NIP-50 full-text search (PostgreSQL `to_tsvector`)
- [ ] Port payment system (if using pay-to-relay)
- [ ] Implement event archival to S3/MinIO
- [ ] Add Prometheus metrics + Grafana dashboards

### Phase 4: Testing & Optimization (Week 7-8)
- [ ] Load testing (locust, k6)
- [ ] Query optimization (EXPLAIN ANALYZE, add indices)
- [ ] Tune PostgreSQL (shared_buffers, work_mem, max_connections)
- [ ] Implement connection pooling (PgBouncer)
- [ ] Set up monitoring (Prometheus, Grafana, alerting)

### Phase 5: Deployment (Week 9)
- [ ] Dockerize application (multi-stage build)
- [ ] Create docker-compose for local testing
- [ ] Deploy to production (Kubernetes or Docker Swarm)
- [ ] Set up backups (PostgreSQL pg_dump, Redis AOF)
- [ ] Configure SSL (Let's Encrypt, nginx)

### Phase 6: Data Migration (Week 10)
- [ ] Export events from Cloudflare (R2 → S3)
- [ ] Import events to PostgreSQL (batch insert)
- [ ] Validate data integrity (event count, signature verification)
- [ ] Run parallel deployment (Cloudflare + Docker)
- [ ] Gradual cutover (DNS switch or dual-write)

---

## 9. Conclusion

**Nosflare** represents state-of-the-art serverless Nostr relay architecture, leveraging Cloudflare's edge computing platform for global scale. The migration to Docker + PostgreSQL is **feasible but requires significant engineering effort**:

**Complexity**: High (8-10 weeks for full migration)
**Risk**: Medium (data migration, production cutover)
**Reward**: Full control, cost predictability, private deployment

**Recommendation**:
- **Continue with Cloudflare** for production public relay (proven, scalable)
- **Build Docker version** as internal/private relay (cohort-based access control)
- **Evaluate costs** after 6 months (if traffic exceeds 100k events/day, consider full Docker migration)

---

## Appendix A: File Structure

```
nosflare/
├── src/
│   ├── index.ts              # Entry point (exports DOs + relay-worker)
│   ├── relay-worker.ts       # Main relay logic (WebSocket handling, EVENT/REQ)
│   ├── connection-do.ts      # ConnectionDO (per-connection state)
│   ├── session-manager-do.ts # SessionManagerDO (subscription registry)
│   ├── event-shard-do.ts     # EventShardDO (time-sharded event storage)
│   ├── payment-do.ts         # PaymentDO (payment tracking)
│   ├── shard-router.ts       # Shard routing logic (time windows, replicas)
│   ├── broadcast-consumer.ts # Queue consumer (broadcast events)
│   ├── r2-archive-consumer.ts # Queue consumer (archive to R2)
│   ├── payment-router.ts     # Payment routing logic
│   ├── config.ts             # Configuration (relay info, rate limits)
│   └── types.ts              # TypeScript types
├── package.json
├── tsconfig.json
└── wrangler.toml             # Cloudflare Workers config (deprecated)
```

---

## Appendix B: Key Metrics

| Metric | Value |
|--------|-------|
| Version | 8.9.26 |
| Supported NIPs | 24 |
| Durable Object Types | 4 (ConnectionDO, SessionManagerDO, EventShardDO, PaymentDO) |
| Queue Count | 211 (200 indexing + 10 broadcast + 1 R2 archive) |
| Time Shard Window | 24 hours (86,400 seconds) |
| Read Replicas | 4 per shard |
| Max Events/Shard | 500,000 |
| Max Index Size | 50,000 entries (200,000 for created_at) |
| Max Query Time Range | 30 days (configurable) |
| Max Query Shards | 900 (Cloudflare subrequest limit) |
| Rate Limits | 10 EVENT/min, 100 REQ/min |
| Session TTL | 30 minutes |
| Cache TTL | Event dedup: 1h, Query results: 5min |

---

**Document Version**: 1.0
**Last Updated**: 2025-12-15
**Author**: System Architecture Analysis
**Status**: Complete
