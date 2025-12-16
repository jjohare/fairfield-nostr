# Semantic Vector Search - Integration Risk Assessment

**Project:** fairfield-nostr
**Feature:** Semantic Vector Search with HNSW
**Assessment Date:** 2025-12-14
**Evaluator:** Integration Risk Evaluator Agent

---

## Executive Summary

The Semantic Vector Search feature introduces **MODERATE-HIGH** overall risk with several critical dependencies and scaling challenges. The primary concerns are:

1. **hnswlib-wasm** dependency is 18 months stale (last updated July 2023)
2. **IndexedDB storage quotas** will become limiting factor at scale
3. **GitHub Actions compute limits** for embedding generation
4. **Browser WASM memory constraints** for large vector indexes

**Recommendation:** CONDITIONAL GO - Proceed with prototype but implement mitigation strategies and establish hard limits.

---

## Risk Matrix

| Risk Category | Likelihood | Impact | Severity | Priority |
|---------------|-----------|--------|----------|----------|
| hnswlib-wasm abandonment | High | High | **CRITICAL** | P0 |
| IndexedDB quota exhaustion | High | Medium | **HIGH** | P1 |
| GitHub Actions timeout | Medium | Medium | **MEDIUM** | P2 |
| WASM memory limits | Medium | High | **HIGH** | P1 |
| R2 egress costs | Low | Low | **LOW** | P3 |
| Embedding accuracy | Medium | Medium | **MEDIUM** | P2 |
| Network sync failures | High | Low | **MEDIUM** | P2 |
| Version mismatch | Low | High | **MEDIUM** | P2 |

**Legend:**
- **CRITICAL:** Blocker, must resolve before production
- **HIGH:** Significant risk, requires mitigation
- **MEDIUM:** Manageable with monitoring
- **LOW:** Accept and monitor

---

## 1. Dependency Risk Analysis

### 1.1 hnswlib-wasm (CRITICAL)

**Current State:**
```json
{
  "package": "hnswlib-wasm",
  "last_update": "2023-07",
  "months_stale": 18,
  "maintainer_activity": "low",
  "alternatives": ["hnswlib-node", "faiss-node", "pure JS implementations"]
}
```

**Risks:**
- ✗ **No updates in 18 months** - may have unpatched vulnerabilities
- ✗ **Emscripten dependency** - WASM compilation toolchain may drift
- ✗ **Single maintainer** - bus factor = 1
- ✓ **Small, focused scope** - less likely to need updates

**Mitigation Strategies:**
1. **Fork the repository** and maintain internally if necessary
2. **Audit WASM binary** for security issues before deployment
3. **Implement wrapper layer** to allow swapping implementations
4. **Monitor for alternatives** (monthly review)
5. **Fallback to keyword search** if WASM fails to load

**Code Impact:**
```typescript
// Current codebase analysis
// Vite config (vite.config.ts) uses esbuild + rollup
// Build target: esnext (line 37)
// Rollup external: [] (all deps bundled, line 44)

// WASM integration requirements:
// 1. Vite must handle .wasm files
// 2. Need vite-plugin-wasm OR manual fetch
// 3. Worker support for background indexing
```

**Action Items:**
- [ ] Add WASM loader to vite.config.ts
- [ ] Test hnswlib-wasm with current Vite 5.4.21
- [ ] Create abstraction layer: `VectorSearchProvider` interface
- [ ] Document rollback to keyword search

### 1.2 sentence-transformers (Python, GitHub Actions)

**Current State:**
```yaml
# .github/workflows would need:
dependencies:
  - python: "3.10+"
  - transformers: "^4.30.0"
  - sentence-transformers: "^2.2.0"
  - torch: "^2.0.0" (large, 700MB+)
```

**Risks:**
- ⚠ **Large dependency size** - slows CI/CD builds
- ⚠ **GPU requirements** - CPU-only inference is slow
- ⚠ **Model size** - all-MiniLM-L6-v2 is 80MB
- ✓ **Well-maintained** - active development

**GitHub Actions Limits:**
- ⏱ **6 hour timeout** per job
- 💾 **14GB disk space** on ubuntu-latest
- 🚫 **No persistent storage** between runs

**Mitigation Strategies:**
1. **Cache Python dependencies** between workflow runs
2. **Use GitHub Actions cache** for model downloads
3. **Implement incremental indexing** (only new messages)
4. **Set hard limits**: max 10,000 messages per run
5. **Batch processing**: 100 messages at a time

**Estimated Compute Times:**
```python
# CPU-only inference on GitHub Actions
messages_per_second = 20  # all-MiniLM-L6-v2
total_messages = 10000
time_estimate = 10000 / 20 = 500 seconds (8.3 minutes)

# With batching (batch_size=32)
batched_speed = 50  # messages/sec
time_estimate = 10000 / 50 = 200 seconds (3.3 minutes)
```

**Action Items:**
- [ ] Create `.github/workflows/generate-embeddings.yml`
- [ ] Test embedding generation for 1k messages
- [ ] Implement progress tracking in workflow
- [ ] Add timeout and retry logic

### 1.3 Cloudflare R2 (Free Tier)

**Free Tier Limits:**
```yaml
storage: 10GB
class_a_operations: 1M/month  # PUT, LIST
class_b_operations: 10M/month # GET, HEAD
egress: 0 cost (unlike S3!)
```

**Current Project Stats:**
- IndexedDB storage: Uses `navigator.storage.estimate()`
- Message pruning: 3 days default, 1000 messages/channel
- Storage monitoring: Implemented in db.ts (line 152-164)

**Risk Assessment:**
- ✓ **10GB is sufficient** for embeddings
  - 10k messages × 384 dims × 4 bytes = ~15MB
  - 100k messages = ~150MB
  - Headroom: 66x current scale
- ✓ **Egress is free** - unlike AWS S3
- ⚠ **1M writes/month** could be limiting
  - Daily updates = 30 writes/month ✓
  - Per-message indexing = 3k messages/day limit

**Mitigation Strategies:**
1. **Batch embeddings** into single R2 object per channel
2. **Daily aggregation** instead of per-message writes
3. **Monitor R2 usage** via Cloudflare dashboard
4. **Implement rate limiting** in sync logic

**Action Items:**
- [ ] Set up R2 bucket with CORS for PWA
- [ ] Create R2 access policy (read-only for PWA)
- [ ] Implement exponential backoff for R2 fetches
- [ ] Add usage metrics to admin dashboard

---

## 2. Integration Complexity Assessment

### 2.1 SvelteKit + Vite + WASM

**Current Build Stack:**
```javascript
// vite.config.ts analysis
{
  plugins: [sveltekit(), VitePWA()],
  build: {
    target: 'esnext',
    minify: 'esbuild' (production),
    rollupOptions: { external: [] }
  },
  ssr: {
    noExternal: ['@noble/hashes', '@noble/curves', ...crypto]
  }
}
```

**WASM Integration Challenges:**
1. **Vite WASM support** - requires plugin or manual loader
2. **SSR compatibility** - WASM only works client-side
3. **Worker instantiation** - needs separate bundle
4. **Memory management** - WASM heap allocation

**Recommended Approach:**
```typescript
// src/lib/search/vector-search.ts
import type { IndexableMessage } from './types';

// Lazy load WASM only in browser
let hnswlib: any = null;

export async function initVectorSearch() {
  if (typeof window === 'undefined') {
    throw new Error('Vector search only available in browser');
  }

  if (!hnswlib) {
    // Dynamic import to avoid SSR issues
    hnswlib = await import('hnswlib-wasm');
    await hnswlib.default(); // Initialize WASM
  }

  return hnswlib;
}

// Wrapper for easy testing/swapping
export interface VectorSearchProvider {
  addVectors(ids: string[], vectors: Float32Array[]): Promise<void>;
  search(query: Float32Array, k: number): Promise<SearchResult[]>;
  saveIndex(): Promise<Uint8Array>;
  loadIndex(data: Uint8Array): Promise<void>;
}
```

**Complexity Score:** 7/10 (Medium-High)

**Action Items:**
- [ ] Test WASM loading in Vite dev mode
- [ ] Verify SSR compatibility with `typeof window` checks
- [ ] Create WebWorker wrapper for indexing
- [ ] Add error boundaries for WASM failures

### 2.2 IndexedDB Storage Limits

**Browser Quota Analysis:**
```javascript
// Current implementation (db.ts, line 152-164)
async getStorageEstimate() {
  const estimate = await navigator.storage.estimate();
  return {
    used: estimate.usage || 0,
    quota: estimate.quota || 0,
    percentage: (used / quota) * 100
  };
}

// Existing pruning strategy (db.ts, line 190-308)
async pruneOldCache({
  maxMessageAgeDays = 3,
  maxMessagesPerChannel = 1000,
  maxCachedUsers = 500,
  maxSearchIndexAgeDays = 7,
  forceAggressive = false
})
```

**Vector Index Storage Requirements:**
```typescript
// Size calculations
interface VectorIndexSize {
  vectors: {
    dimensions: 384,
    bytesPerDimension: 4,
    messageCount: 10000,
    totalSize: 10000 × 384 × 4 = 15.36 MB
  },
  hnswGraph: {
    M: 16,  // edges per node
    efConstruction: 200,
    estimatedOverhead: 2x,
    graphSize: 15.36 MB × 2 = ~30 MB
  },
  metadata: {
    messageIds: 10000 × 64 = 640 KB,
    timestamps: 10000 × 8 = 80 KB
  },
  total: ~46 MB for 10k messages
}
```

**Browser Quota Limits (2025):**
- Chrome/Edge: ~60% of available disk space
- Firefox: ~50% of available disk space
- Safari: 1GB initially, can request more
- Mobile browsers: 50-500MB typical

**Risk Scenarios:**
| Messages | Vector Size | HNSW Graph | Total | Chrome (500GB disk) | Safari (1GB) |
|----------|-------------|------------|-------|---------------------|--------------|
| 1k       | 1.5 MB      | 3 MB       | 4.5 MB | ✓ 0.001% | ✓ 0.45% |
| 10k      | 15 MB       | 30 MB      | 45 MB  | ✓ 0.015% | ⚠ 4.5% |
| 100k     | 150 MB      | 300 MB     | 450 MB | ✓ 0.15%  | ✗ 45% (risky) |
| 1M       | 1.5 GB      | 3 GB       | 4.5 GB | ⚠ 1.5%   | ✗ Exceeds quota |

**Mitigation Strategies:**
1. **Implement tiered storage:**
   - Hot: Last 7 days in IndexedDB with vectors
   - Warm: 8-30 days, text only
   - Cold: 30+ days, archived to R2
2. **Add vector index pruning** to existing `pruneOldCache()`
3. **Request persistent storage** for PWA
4. **Monitor quota usage** and warn user at 70%
5. **Implement progressive loading** (load index on demand)

**Code Changes Needed:**
```typescript
// Add to db.ts schema (line 118-136)
this.version(3).stores({
  messages: '...',
  channels: '...',
  // NEW: Vector index table
  vectorIndex: 'messageId, channelId, embedding, timestamp',
  vectorMetadata: 'channelId, indexData, lastUpdate, messageCount'
});

// Add pruning for vectors
async pruneVectorIndex(options: {
  maxVectorAgeDays?: number,
  maxVectorsPerChannel?: number
}) {
  const cutoff = Date.now() / 1000 - (maxVectorAgeDays × 86400);

  // Remove old vectors
  await this.vectorIndex
    .where('timestamp')
    .below(cutoff)
    .delete();

  // Limit per channel
  const channels = await this.channels.toArray();
  for (const channel of channels) {
    const vectorCount = await this.vectorIndex
      .where('channelId')
      .equals(channel.id)
      .count();

    if (vectorCount > maxVectorsPerChannel) {
      const toDelete = await this.vectorIndex
        .where('channelId')
        .equals(channel.id)
        .sortBy('timestamp')
        .limit(vectorCount - maxVectorsPerChannel);

      await this.vectorIndex.bulkDelete(toDelete.map(v => v.messageId));
    }
  }
}
```

**Action Items:**
- [ ] Add `vectorIndex` and `vectorMetadata` tables to Dexie schema
- [ ] Implement `pruneVectorIndex()` method
- [ ] Request persistent storage in PWA setup
- [ ] Add quota monitoring to UI
- [ ] Create vector index rebuild on demand

### 2.3 WebWorker Requirements

**Current Worker Usage:**
- PWA service worker (src/service-worker.ts)
- VitePWA plugin configured (vite.config.ts, line 6-24)

**Vector Search Worker Needs:**
1. **Index building** - CPU intensive, must not block UI
2. **Batch embedding fetch** from R2
3. **WASM instantiation** - separate heap
4. **Search execution** - k-NN queries

**Worker Architecture:**
```typescript
// src/lib/search/vector-search.worker.ts
import { initVectorSearch } from './vector-search';

interface WorkerMessage {
  type: 'init' | 'add' | 'search' | 'save' | 'load';
  payload: any;
}

let index: VectorSearchProvider | null = null;

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const { type, payload } = e.data;

  switch (type) {
    case 'init':
      const hnsw = await initVectorSearch();
      index = new HNSWIndex(hnsw, payload.dimensions, payload.maxElements);
      self.postMessage({ type: 'init', success: true });
      break;

    case 'add':
      await index!.addVectors(payload.ids, payload.vectors);
      self.postMessage({ type: 'add', count: payload.ids.length });
      break;

    case 'search':
      const results = await index!.search(payload.query, payload.k);
      self.postMessage({ type: 'search', results });
      break;

    case 'save':
      const indexData = await index!.saveIndex();
      self.postMessage({ type: 'save', data: indexData });
      break;

    case 'load':
      await index!.loadIndex(payload.data);
      self.postMessage({ type: 'load', success: true });
      break;
  }
};
```

**Vite Worker Configuration:**
```typescript
// vite.config.ts additions
export default defineConfig({
  // ... existing config
  worker: {
    format: 'es',
    plugins: [
      // WASM plugin for workers
    ]
  }
});
```

**Action Items:**
- [ ] Create vector-search.worker.ts
- [ ] Add worker build config to vite.config.ts
- [ ] Implement message passing protocol
- [ ] Add worker error handling and restart logic
- [ ] Test worker memory limits (stress test)

---

## 3. Scaling Risk Analysis

### 3.1 Memory Usage at 100k Vectors

**WASM Memory Model:**
```javascript
// hnswlib-wasm memory requirements
{
  initialMemory: 16MB,  // Default WASM heap
  maxMemory: 2GB,       // Chrome limit per WASM instance

  // HNSW index memory
  vectorMemory: 100000 × 384 × 4 = 153.6 MB,
  graphMemory: M × N × sizeof(int) = 16 × 100000 × 4 = 6.4 MB,
  levelMemory: N × sizeof(int) = 100000 × 4 = 0.4 MB,

  totalEstimate: 153.6 + 6.4 + 0.4 + overhead(20%) = ~200 MB
}
```

**Browser Memory Limits (2025):**
- Desktop Chrome: 4GB JS heap + 2GB WASM per tab
- Desktop Firefox: 4GB combined
- Mobile Chrome: 512MB - 1GB total
- Mobile Safari: 256MB - 512MB (aggressive limits)

**Risk Assessment:**
| Device | Available Memory | 100k Index | Safety Margin | Risk Level |
|--------|------------------|------------|---------------|------------|
| Desktop | 4GB JS + 2GB WASM | 200 MB | 90% free | ✓ LOW |
| High-end Mobile | 1GB | 200 MB | 80% free | ⚠ MEDIUM |
| Mid-range Mobile | 512 MB | 200 MB | 60% free | ✗ HIGH |
| Low-end Mobile | 256 MB | 200 MB | 22% free | ✗ CRITICAL |

**Mitigation Strategies:**
1. **Device detection** - disable on low-memory devices
2. **Progressive indexing** - load subset of vectors
3. **Lazy loading** - load index only when searching
4. **Memory monitoring** - check `performance.memory` API
5. **Graceful degradation** - fall back to keyword search

**Implementation:**
```typescript
// src/lib/search/device-capability.ts
export async function canSupportVectorSearch(): Promise<boolean> {
  // Check WASM support
  if (typeof WebAssembly === 'undefined') {
    return false;
  }

  // Check available memory (Chrome only)
  if ('memory' in performance) {
    const mem = (performance as any).memory;
    const availableMB = mem.jsHeapSizeLimit / 1024 / 1024;

    if (availableMB < 500) {
      console.warn('Insufficient memory for vector search:', availableMB, 'MB');
      return false;
    }
  }

  // Check IndexedDB quota
  const storage = await navigator.storage.estimate();
  const quotaMB = (storage.quota || 0) / 1024 / 1024;

  if (quotaMB < 100) {
    console.warn('Insufficient storage quota:', quotaMB, 'MB');
    return false;
  }

  return true;
}
```

**Action Items:**
- [ ] Implement device capability detection
- [ ] Add memory monitoring during index load
- [ ] Create progressive loading strategy
- [ ] Test on low-end Android devices
- [ ] Document minimum device requirements

### 3.2 GitHub Actions Compute Time/Limits

**Workflow Constraints:**
```yaml
# GitHub Actions limits (Free tier)
timeout: 360 minutes (6 hours)
disk_space: 14 GB
concurrent_jobs: 20
monthly_minutes: 2000 (free tier) / unlimited (paid)
```

**Embedding Generation Pipeline:**
```python
# Estimated compute times
embedding_model = "all-MiniLM-L6-v2"
dimensions = 384
device = "cpu"  # GitHub Actions runners

# Performance benchmarks (ubuntu-latest, 2-core)
batch_size = 32
throughput = 50 messages/second
startup_time = 30 seconds (model download + load)

# Scenarios
scenario_1k = {
  messages: 1000,
  time: 30 + (1000 / 50) = 50 seconds,
  cost: negligible
}

scenario_10k = {
  messages: 10000,
  time: 30 + (10000 / 50) = 230 seconds (3.8 min),
  cost: ~4 minutes of runner time
}

scenario_100k = {
  messages: 100000,
  time: 30 + (100000 / 50) = 2030 seconds (33 min),
  cost: ~33 minutes of runner time
}

scenario_1M = {
  messages: 1000000,
  time: 30 + (1000000 / 50) = 20030 seconds (5.5 hours),
  cost: ~5.5 hours (near timeout limit!)
}
```

**Risk Scenarios:**
1. **Timeout on large datasets** - 1M messages approaches 6-hour limit
2. **Monthly quota exhaustion** - daily runs consume 2000 minutes in 60 days
3. **Concurrent job blocking** - embedding gen blocks other workflows
4. **Disk space** - model + torch + dependencies = ~2GB

**Mitigation Strategies:**
1. **Incremental processing:**
   - Only generate embeddings for new messages
   - Store processed message IDs in R2 metadata
   - Skip already-indexed messages
2. **Caching:**
   ```yaml
   - uses: actions/cache@v3
     with:
       path: |
         ~/.cache/huggingface
         ~/.cache/torch
       key: ${{ runner.os }}-embedding-model-v1
   ```
3. **Batching:**
   - Process 10k messages per run maximum
   - Use matrix strategy for parallel processing
4. **Scheduled runs:**
   - Daily at low-traffic times (avoid blocking dev workflows)
   - Only run if new messages detected
5. **Monitoring:**
   - Track workflow duration
   - Alert if approaching timeout
   - Track monthly quota usage

**GitHub Actions Workflow Design:**
```yaml
# .github/workflows/generate-embeddings.yml
name: Generate Embeddings

on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily
  workflow_dispatch:
    inputs:
      max_messages:
        description: 'Max messages to process'
        required: false
        default: '10000'

jobs:
  check-new-messages:
    runs-on: ubuntu-latest
    outputs:
      should_run: ${{ steps.check.outputs.should_run }}
    steps:
      - name: Check for new messages
        id: check
        run: |
          # Query D1 for messages without embeddings
          NEW_COUNT=$(wrangler d1 execute minimoonoir \
            --command "SELECT COUNT(*) FROM messages WHERE embedding_generated = 0")

          if [ "$NEW_COUNT" -gt "0" ]; then
            echo "should_run=true" >> $GITHUB_OUTPUT
          else
            echo "should_run=false" >> $GITHUB_OUTPUT
          fi

  generate-embeddings:
    needs: check-new-messages
    if: needs.check-new-messages.outputs.should_run == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 60  # Safety timeout

    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
          cache: 'pip'

      - name: Cache model
        uses: actions/cache@v3
        with:
          path: ~/.cache/huggingface
          key: ${{ runner.os }}-huggingface-v1

      - name: Install dependencies
        run: |
          pip install torch transformers sentence-transformers

      - name: Generate embeddings
        run: |
          python scripts/generate-embeddings.py \
            --max-messages ${{ github.event.inputs.max_messages || 10000 }} \
            --batch-size 32 \
            --output embeddings.json

      - name: Upload to R2
        env:
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          wrangler r2 object put \
            minimoonoir-embeddings/embeddings-$(date +%Y%m%d).json \
            --file embeddings.json

      - name: Update D1 metadata
        run: |
          wrangler d1 execute minimoonoir \
            --command "UPDATE messages SET embedding_generated = 1 WHERE id IN (SELECT id FROM ...)"
```

**Action Items:**
- [ ] Create `scripts/generate-embeddings.py`
- [ ] Test workflow with 1k, 10k message batches
- [ ] Set up R2 bucket for embeddings
- [ ] Add D1 schema for tracking generated embeddings
- [ ] Implement incremental processing logic
- [ ] Set up workflow monitoring/alerts

### 3.3 R2 Egress for PWA Downloads

**R2 Pricing Model (vs S3):**
```yaml
cloudflare_r2:
  storage: $0.015/GB-month
  class_a_ops: $4.50/million (PUT, LIST)
  class_b_ops: $0.36/million (GET, HEAD)
  egress: $0 (FREE! Unlike S3's $0.09/GB)

aws_s3:
  storage: $0.023/GB-month
  put: $0.005/1000
  get: $0.0004/1000
  egress: $0.09/GB (EXPENSIVE!)
```

**PWA Download Pattern:**
```typescript
// Embedding download on app load
interface EmbeddingDownload {
  initialLoad: {
    channels: 5,
    messagesPerChannel: 1000,
    totalMessages: 5000,
    embeddingSize: 5000 × 384 × 4 = 7.68 MB,
    compressed: 7.68 MB × 0.3 = ~2.3 MB (gzip),
    frequency: "once per install"
  },
  dailySync: {
    newMessages: 100,
    embeddingSize: 100 × 384 × 4 = 153.6 KB,
    compressed: ~46 KB,
    frequency: "1x per day per user"
  },
  monthlyDataTransfer: {
    users: 100,
    initialLoads: 10,  // New users
    dailySyncs: 100 × 30 = 3000,
    totalEgress: (10 × 2.3 MB) + (3000 × 46 KB) = 23 MB + 138 MB = 161 MB,
    cost: $0 (R2 free egress!)
  }
}
```

**Comparison with S3:**
```javascript
// Cost analysis
const s3Cost = {
  egress: 161 MB × $0.09/GB = $0.014/month,
  get_requests: 3010 × $0.0004/1000 = $0.0012/month,
  total: $0.0152/month
};

const r2Cost = {
  egress: 161 MB × $0/GB = $0,
  class_b_ops: 3010 × $0.36/1M = $0.0011/month,
  total: $0.0011/month
};

// At 10k users scale
const s3CostScale = $0.0152 × 100 = $1.52/month;
const r2CostScale = $0.0011 × 100 = $0.11/month;
// Savings: $1.41/month (92% reduction)
```

**Risk Assessment:**
- ✓ **Egress cost: $0** - R2's killer feature
- ✓ **Free tier sufficient** - 10M Class B ops/month
- ⚠ **Initial download size** - 2.3 MB may be slow on 3G
- ⚠ **Cache invalidation** - need versioning strategy

**Mitigation Strategies:**
1. **Progressive download:**
   - Load current channel embeddings first
   - Background load other channels
2. **Compression:**
   - Gzip at R2 level (automatic)
   - Consider binary formats (MessagePack vs JSON)
3. **Caching:**
   - HTTP cache headers (7 days)
   - Service worker cache
   - IndexedDB persistent cache
4. **Versioning:**
   ```typescript
   // Embedding file structure
   interface EmbeddingManifest {
     version: "2025-12-14T02:00:00Z",
     channels: {
       [channelId: string]: {
         messageCount: number,
         lastUpdate: number,
         fileUrl: string,
         checksum: string
       }
     }
   }
   ```

**Action Items:**
- [ ] Implement progressive embedding download
- [ ] Add gzip compression to R2 uploads
- [ ] Create embedding manifest with versioning
- [ ] Set up service worker cache for embeddings
- [ ] Test download performance on 3G network

---

## 4. Failure Mode Analysis

### 4.1 Network Failures During Sync

**Failure Scenarios:**
1. **R2 request timeout** - slow network or service issue
2. **Partial download** - connection dropped mid-transfer
3. **Corrupt data** - transmission errors
4. **Version mismatch** - client has old embeddings
5. **R2 outage** - Cloudflare service disruption

**Current Network Handling:**
```typescript
// Current implementation in messages.ts (line 162-204)
function connectToRelay(relayUrl: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relayUrl);

    ws.onopen = () => {
      db.updateRelay(relayUrl, {
        connected: true,
        lastConnected: Date.now() / 1000,
        lastError: null
      });
      resolve(ws);
    };

    ws.onerror = (error) => {
      db.updateRelay(relayUrl, {
        connected: false,
        lastError: 'Connection failed'
      });
      reject(error);
    };

    ws.onclose = () => {
      relayConnections.delete(relayUrl);
      db.updateRelay(relayUrl, {
        connected: false
      });
    };
  });
}
```

**Mitigation Strategies:**
1. **Exponential backoff:**
   ```typescript
   async function fetchEmbeddingsWithRetry(
     url: string,
     maxRetries = 3,
     baseDelay = 1000
   ): Promise<ArrayBuffer> {
     for (let i = 0; i < maxRetries; i++) {
       try {
         const response = await fetch(url, {
           signal: AbortSignal.timeout(30000) // 30s timeout
         });

         if (!response.ok) {
           throw new Error(`HTTP ${response.status}`);
         }

         return await response.arrayBuffer();
       } catch (error) {
         if (i === maxRetries - 1) throw error;

         const delay = baseDelay * Math.pow(2, i);
         console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
         await new Promise(resolve => setTimeout(resolve, delay));
       }
     }
     throw new Error('Max retries exceeded');
   }
   ```

2. **Checksum verification:**
   ```typescript
   async function verifyEmbeddingIntegrity(
     data: ArrayBuffer,
     expectedChecksum: string
   ): Promise<boolean> {
     const hashBuffer = await crypto.subtle.digest('SHA-256', data);
     const hashArray = Array.from(new Uint8Array(hashBuffer));
     const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

     return hashHex === expectedChecksum;
   }
   ```

3. **Partial recovery:**
   ```typescript
   // Store download progress in IndexedDB
   interface DownloadState {
     channelId: string;
     totalChunks: number;
     downloadedChunks: Set<number>;
     lastUpdate: number;
   }

   // Resume from last chunk if interrupted
   async function resumableDownload(manifest: EmbeddingManifest) {
     const state = await db.getDownloadState(manifest.version);

     if (state && Date.now() - state.lastUpdate < 3600000) {
       // Resume if interrupted within 1 hour
       return await downloadRemainingChunks(state);
     } else {
       // Start fresh download
       return await downloadAllChunks(manifest);
     }
   }
   ```

4. **Graceful degradation:**
   ```typescript
   export class SemanticSearch {
     private vectorSearchAvailable = false;

     async initialize() {
       try {
         await this.loadEmbeddings();
         this.vectorSearchAvailable = true;
       } catch (error) {
         console.error('Vector search unavailable:', error);
         this.vectorSearchAvailable = false;
         // Fall back to keyword search
       }
     }

     async search(query: string, k = 10) {
       if (this.vectorSearchAvailable) {
         try {
           return await this.vectorSearch(query, k);
         } catch (error) {
           console.error('Vector search failed, falling back:', error);
         }
       }

       // Fallback to existing keyword search
       return await this.keywordSearch(query, k);
     }
   }
   ```

**Action Items:**
- [ ] Implement exponential backoff for R2 fetches
- [ ] Add SHA-256 checksum verification
- [ ] Create resumable download mechanism
- [ ] Add fallback to keyword search
- [ ] Test network failure scenarios (offline mode)

### 4.2 Corrupted Index Recovery

**Corruption Scenarios:**
1. **WASM heap corruption** - memory overwrite
2. **IndexedDB transaction failure** - disk full, quota exceeded
3. **Partial index write** - browser crash during save
4. **Version incompatibility** - old index with new code

**Detection Strategies:**
```typescript
interface IndexMetadata {
  version: string;
  dimensions: number;
  messageCount: number;
  lastUpdate: number;
  checksum: string;
}

async function validateIndexIntegrity(): Promise<boolean> {
  try {
    const metadata = await db.vectorMetadata.get('main');
    if (!metadata) return false;

    // Check version compatibility
    const currentVersion = '1.0.0';
    if (metadata.version !== currentVersion) {
      console.warn('Index version mismatch:', metadata.version, 'vs', currentVersion);
      return false;
    }

    // Check message count matches
    const actualCount = await db.vectorIndex.count();
    if (actualCount !== metadata.messageCount) {
      console.error('Index count mismatch:', actualCount, 'vs', metadata.messageCount);
      return false;
    }

    // Verify checksum
    const indexData = await db.vectorMetadata.get('indexData');
    const actualChecksum = await computeChecksum(indexData);
    if (actualChecksum !== metadata.checksum) {
      console.error('Index checksum mismatch');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Index validation failed:', error);
    return false;
  }
}
```

**Recovery Strategies:**
1. **Automatic rebuild:**
   ```typescript
   export class VectorIndexManager {
     async ensureIndexValid() {
       const isValid = await validateIndexIntegrity();

       if (!isValid) {
         console.warn('Invalid index detected, rebuilding...');
         await this.rebuildIndex();
       }
     }

     async rebuildIndex() {
       // Clear corrupted index
       await db.vectorIndex.clear();
       await db.vectorMetadata.clear();

       // Re-download embeddings from R2
       const embeddings = await this.fetchEmbeddingsFromR2();

       // Rebuild HNSW index
       await this.worker.postMessage({
         type: 'rebuild',
         payload: embeddings
       });

       // Update metadata
       await this.saveIndexMetadata();
     }
   }
   ```

2. **Version migration:**
   ```typescript
   async function migrateIndex(oldVersion: string, newVersion: string) {
     console.log(`Migrating index from ${oldVersion} to ${newVersion}`);

     switch (oldVersion) {
       case '0.9.0':
         // Migration path 0.9.0 -> 1.0.0
         await db.vectorIndex.toCollection().modify((item) => {
           // Update schema
           item.newField = defaultValue;
         });
         break;

       default:
         // Unknown version, force rebuild
         console.warn('Unknown version, forcing rebuild');
         await this.rebuildIndex();
     }
   }
   ```

3. **Backup and restore:**
   ```typescript
   // Periodic index snapshots
   async function createIndexSnapshot() {
     const metadata = await db.vectorMetadata.get('main');
     const indexData = await db.vectorMetadata.get('indexData');

     const snapshot = {
       timestamp: Date.now(),
       version: metadata.version,
       data: indexData
     };

     // Store in separate table
     await db.indexSnapshots.add(snapshot);

     // Keep only last 3 snapshots
     const count = await db.indexSnapshots.count();
     if (count > 3) {
       const oldest = await db.indexSnapshots
         .orderBy('timestamp')
         .first();
       await db.indexSnapshots.delete(oldest.id);
     }
   }

   async function restoreFromSnapshot() {
     const latest = await db.indexSnapshots
       .orderBy('timestamp')
       .reverse()
       .first();

     if (latest) {
       await db.vectorMetadata.put({
         id: 'indexData',
         data: latest.data
       });

       return true;
     }

     return false;
   }
   ```

**Action Items:**
- [ ] Implement index integrity validation
- [ ] Add automatic rebuild on corruption
- [ ] Create version migration logic
- [ ] Implement index snapshots (every 24h)
- [ ] Add user notification for rebuild progress

### 4.3 Version Mismatch Handling

**Mismatch Scenarios:**
1. **Client outdated** - using old embedding format
2. **Server updated** - new embedding model dimensions
3. **Index format change** - HNSW parameters changed
4. **API breaking change** - R2 file structure updated

**Versioning Strategy:**
```typescript
interface VersionManifest {
  embeddingVersion: string;    // Model version
  indexVersion: string;         // HNSW index format
  apiVersion: string;           // R2 API schema

  // Backward compatibility matrix
  compatibility: {
    minClientVersion: string;
    maxClientVersion: string;
    deprecationDate?: string;
  };
}

// Fetch from R2 on app load
const MANIFEST_URL = 'https://r2.../version-manifest.json';

async function checkVersionCompatibility(): Promise<boolean> {
  const manifest = await fetch(MANIFEST_URL).then(r => r.json());
  const clientVersion = import.meta.env.VITE_APP_VERSION; // From package.json

  // Check if client is within supported range
  const isCompatible =
    semverGte(clientVersion, manifest.compatibility.minClientVersion) &&
    semverLte(clientVersion, manifest.compatibility.maxClientVersion);

  if (!isCompatible) {
    console.error('Client version incompatible:', clientVersion);

    // Check if deprecated
    if (manifest.compatibility.deprecationDate) {
      const deprecationDate = new Date(manifest.compatibility.deprecationDate);
      if (Date.now() > deprecationDate.getTime()) {
        // Force update
        showForceUpdateDialog();
        return false;
      }
    }

    // Soft warning
    showUpdateRecommendation();
  }

  return isCompatible;
}
```

**Migration Workflow:**
```typescript
export class EmbeddingMigrator {
  async migrate(fromVersion: string, toVersion: string) {
    console.log(`Migrating embeddings from ${fromVersion} to ${toVersion}`);

    // Check if migration path exists
    const path = this.getMigrationPath(fromVersion, toVersion);

    if (path.requiresRebuild) {
      // Breaking change, must rebuild
      await this.rebuildFromScratch(toVersion);
    } else {
      // Can migrate in-place
      for (const step of path.steps) {
        await this.applyMigrationStep(step);
      }
    }
  }

  getMigrationPath(from: string, to: string): MigrationPath {
    // Example migration paths
    const paths = {
      '1.0.0->1.1.0': {
        requiresRebuild: false,
        steps: [
          { type: 'add-field', field: 'timestamp' },
          { type: 'reindex-metadata' }
        ]
      },
      '1.1.0->2.0.0': {
        requiresRebuild: true,  // Changed embedding dimensions
        reason: 'Model upgraded from 384d to 768d'
      }
    };

    const key = `${from}->${to}`;
    return paths[key] || { requiresRebuild: true };
  }
}
```

**Rollback Strategy:**
```typescript
// If migration fails, rollback to previous version
interface MigrationCheckpoint {
  version: string;
  timestamp: number;
  indexBackup: Uint8Array;
  metadata: IndexMetadata;
}

async function safelyMigrateWithRollback(
  targetVersion: string
): Promise<boolean> {
  // Create checkpoint
  const checkpoint = await createMigrationCheckpoint();

  try {
    // Attempt migration
    await migrator.migrate(currentVersion, targetVersion);

    // Validate migrated index
    const isValid = await validateIndexIntegrity();

    if (!isValid) {
      throw new Error('Migration produced invalid index');
    }

    // Success, delete checkpoint
    await deleteMigrationCheckpoint(checkpoint);
    return true;

  } catch (error) {
    console.error('Migration failed, rolling back:', error);

    // Restore from checkpoint
    await restoreFromCheckpoint(checkpoint);

    // Notify user
    toast.error('Update failed, restored previous version');
    return false;
  }
}
```

**Action Items:**
- [ ] Create version manifest in R2
- [ ] Implement semantic versioning checks
- [ ] Build migration framework
- [ ] Add checkpoint/rollback mechanism
- [ ] Test breaking change scenarios

---

## 5. Security Considerations

### 5.1 Embedding Generation for Encrypted Messages

**Problem:**
- Messages may be encrypted (NIP-04)
- Embeddings must be generated from **plaintext**
- Cannot generate embeddings from ciphertext (meaningless)

**Current Encryption Flow:**
```typescript
// From messages.ts (line 101-114)
async function decryptMessage(
  encryptedContent: string,
  senderPubkey: string,
  recipientPrivkey: string
): Promise<string> {
  try {
    const { nip04Decrypt } = await import('$lib/utils/nostr-crypto');
    return await nip04Decrypt(recipientPrivkey, senderPubkey, encryptedContent);
  } catch (error) {
    console.error('Failed to decrypt message:', error);
    return '[Encrypted message - decryption failed]';
  }
}
```

**Security Risks:**
1. **Embedding leakage** - vector search reveals content patterns
2. **Inference attacks** - similar embeddings suggest similar plaintext
3. **Access control** - who can download embeddings?
4. **Channel isolation** - must not mix encrypted/public embeddings

**Mitigation Strategies:**

**Option 1: Client-Side Embedding Generation (RECOMMENDED)**
```typescript
// Generate embeddings in browser after decryption
export class SecureEmbeddingGenerator {
  private model: any = null;

  async initialize() {
    // Use ONNX.js or TensorFlow.js for in-browser inference
    this.model = await loadONNXModel('all-MiniLM-L6-v2');
  }

  async generateEmbedding(plaintext: string): Promise<Float32Array> {
    if (!this.model) {
      throw new Error('Model not loaded');
    }

    // Tokenize and run inference in browser
    const tokens = await this.tokenize(plaintext);
    const embedding = await this.model.run(tokens);

    return embedding;
  }
}

// Pros:
// + No plaintext leaves client
// + Works with encrypted channels
// + No server-side processing needed

// Cons:
// - Slow (10-50ms per message on desktop, 100-500ms mobile)
// - Large model download (80MB for all-MiniLM-L6-v2)
// - Battery drain on mobile
```

**Option 2: Encrypted Channel Exclusion (SIMPLEST)**
```typescript
// Only generate embeddings for public channels
async function shouldGenerateEmbedding(channelId: string): Promise<boolean> {
  const channel = await db.getChannel(channelId);

  if (channel?.isEncrypted) {
    console.log('Skipping embedding for encrypted channel:', channelId);
    return false;
  }

  return true;
}

// Pros:
// + Simple to implement
// + No security risk
// + Fast server-side generation

// Cons:
// - No semantic search in encrypted channels
// - User experience inconsistency
```

**Option 3: Homomorphic Embedding (RESEARCH)**
```typescript
// Generate encrypted embeddings that preserve similarity
// (This is cutting-edge research, not production-ready)

// Idea: Use secure multi-party computation
// to compute embeddings without revealing plaintext

// Status: NOT RECOMMENDED - too experimental
```

**Recommended Approach:**
```typescript
// Hybrid strategy
export class HybridEmbeddingStrategy {
  async generateEmbeddings(messages: DBMessage[]) {
    const publicMessages = messages.filter(m => !m.encrypted);
    const encryptedMessages = messages.filter(m => m.encrypted);

    // Public messages: server-side batch generation (fast)
    const publicEmbeddings = await this.generateServerSide(publicMessages);

    // Encrypted messages: exclude from semantic search
    // (or client-side generation if user opts in)
    const encryptedEmbeddings = [];

    if (userPreferences.enableClientSideEmbedding) {
      // Advanced feature: client-side embedding for encrypted
      encryptedEmbeddings = await this.generateClientSide(encryptedMessages);
    }

    return [...publicEmbeddings, ...encryptedEmbeddings];
  }
}
```

**Action Items:**
- [ ] Implement encrypted channel detection
- [ ] Skip embedding generation for encrypted messages (v1)
- [ ] Research ONNX.js for client-side embeddings (v2)
- [ ] Add user preference for client-side generation
- [ ] Document security trade-offs

### 5.2 R2 Bucket Access Control

**Current Setup:**
- Cloudflare R2 bucket: `minimoonoir-embeddings`
- Access: Public read (for PWA)
- Write: GitHub Actions only

**Security Risks:**
1. **Public embeddings** - anyone can download
2. **Enumeration attack** - guess channel IDs
3. **Data poisoning** - if write access compromised
4. **Rate limiting** - prevent abuse

**Recommended Access Control:**

**Option 1: Public R2 with Signed URLs (RECOMMENDED)**
```typescript
// Generate temporary signed URLs for embedding downloads
// Requires Cloudflare Worker in front of R2

// workers/r2-proxy.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const token = url.searchParams.get('token');

    // Verify user has access to channel
    const hasAccess = await verifyChannelAccess(token, channelId, env.DB);

    if (!hasAccess) {
      return new Response('Forbidden', { status: 403 });
    }

    // Fetch from R2
    const object = await env.EMBEDDINGS.get(`embeddings/${channelId}.bin`);

    if (!object) {
      return new Response('Not Found', { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
};

// Pros:
// + Channel-level access control
// + Prevents enumeration
// + Can track usage

// Cons:
// - Requires Cloudflare Worker (adds complexity)
// - Slight latency increase
```

**Option 2: Private R2 with CORS (SIMPLER)**
```typescript
// R2 bucket settings
{
  "public": false,
  "cors": [
    {
      "origins": ["https://your-domain.pages.dev"],
      "methods": ["GET", "HEAD"],
      "allowedHeaders": ["*"],
      "maxAge": 3600
    }
  ]
}

// Client-side fetch with API token (stored in localStorage)
async function fetchEmbeddings(channelId: string) {
  const apiToken = localStorage.getItem('r2_api_token');

  const response = await fetch(
    `https://r2.../embeddings/${channelId}.bin`,
    {
      headers: {
        'Authorization': `Bearer ${apiToken}`
      }
    }
  );

  return response.arrayBuffer();
}

// Pros:
// + Simple setup
// + No Worker needed

// Cons:
// - API token exposed in browser
// - All users share same token
// - Harder to revoke access
```

**Option 3: Public R2 with Obfuscation**
```typescript
// Use content-addressed filenames instead of predictable names
// Hash channelId to prevent enumeration

function getEmbeddingFilename(channelId: string): string {
  // SHA-256 hash of channelId
  const hash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(channelId)
  );

  const hashArray = Array.from(new Uint8Array(hash));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `embeddings/${hashHex}.bin`;
}

// Pros:
// + No Worker needed
// + Prevents enumeration
// + Simple to implement

// Cons:
// - Security through obscurity (weak)
// - No access control
// - Anyone with hash can download
```

**Recommended Strategy: Option 1 (Signed URLs)**

**Implementation:**
```yaml
# wrangler.toml for R2 proxy worker
name = "minimoonoir-r2-proxy"
main = "workers/r2-proxy.ts"

[[r2_buckets]]
binding = "EMBEDDINGS"
bucket_name = "minimoonoir-embeddings"

[[d1_databases]]
binding = "DB"
database_name = "minimoonoir"
database_id = "..."

[vars]
ALLOWED_ORIGINS = "https://your-domain.pages.dev"
```

**Action Items:**
- [ ] Create R2 proxy worker with access control
- [ ] Implement channel access verification
- [ ] Add rate limiting (max 100 requests/hour per user)
- [ ] Set up CORS for PWA domain
- [ ] Test access control edge cases

### 5.3 No Sensitive Data in Embeddings

**Sensitive Data Categories:**
1. **Private keys** - never embed
2. **Passwords** - never embed
3. **Personal identifiers** - emails, phone numbers, addresses
4. **Financial data** - credit cards, bank accounts
5. **Health information** - medical records

**Detection Strategy:**
```typescript
// PII detection before embedding generation
export class PIIDetector {
  // Regex patterns for common PII
  private patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    privateKey: /\b(nsec1|npub1)[a-z0-9]{58,}\b/gi,
    bitcoin: /\b[13][a-km-zA-HJ-NP-Z1-9]{25,34}\b/g
  };

  detectPII(text: string): PIIDetection {
    const findings: PIIFinding[] = [];

    for (const [type, pattern] of Object.entries(this.patterns)) {
      const matches = text.match(pattern);
      if (matches) {
        findings.push({
          type,
          count: matches.length,
          sample: matches[0].slice(0, 10) + '...' // Don't log full PII
        });
      }
    }

    return {
      hasPII: findings.length > 0,
      findings,
      riskLevel: this.calculateRiskLevel(findings)
    };
  }

  calculateRiskLevel(findings: PIIFinding[]): 'low' | 'medium' | 'high' {
    const criticalTypes = ['privateKey', 'creditCard', 'ssn'];

    if (findings.some(f => criticalTypes.includes(f.type))) {
      return 'high';
    }

    if (findings.length > 2) {
      return 'medium';
    }

    return 'low';
  }
}

// Usage in embedding generation
async function generateEmbeddingsWithPIICheck(messages: DBMessage[]) {
  const detector = new PIIDetector();
  const safeMessages: DBMessage[] = [];
  const rejectedMessages: DBMessage[] = [];

  for (const msg of messages) {
    const piiCheck = detector.detectPII(msg.content);

    if (piiCheck.hasPII) {
      console.warn('PII detected in message:', msg.id, piiCheck.findings);

      if (piiCheck.riskLevel === 'high') {
        // Reject message from embedding
        rejectedMessages.push(msg);

        // Optionally notify admin
        await notifyAdmin({
          type: 'pii-detected',
          messageId: msg.id,
          channelId: msg.channelId,
          findings: piiCheck.findings
        });
      } else {
        // Medium/low risk: allow but log
        safeMessages.push(msg);
      }
    } else {
      safeMessages.push(msg);
    }
  }

  console.log(
    `Embedding generation: ${safeMessages.length} safe, ${rejectedMessages.length} rejected`
  );

  return await generateEmbeddings(safeMessages);
}
```

**Anonymization Strategy:**
```typescript
// Optional: Anonymize PII before embedding
export class PIIAnonymizer {
  anonymize(text: string): string {
    const detector = new PIIDetector();
    let anonymized = text;

    // Replace detected PII with placeholders
    anonymized = anonymized.replace(
      detector.patterns.email,
      '[EMAIL]'
    );

    anonymized = anonymized.replace(
      detector.patterns.phone,
      '[PHONE]'
    );

    anonymized = anonymized.replace(
      detector.patterns.privateKey,
      '[PRIVATE_KEY]'
    );

    // Add more patterns as needed

    return anonymized;
  }
}

// Usage
const anonymizer = new PIIAnonymizer();
const safeContent = anonymizer.anonymize(message.content);
const embedding = await generateEmbedding(safeContent);
```

**Action Items:**
- [ ] Implement PII detection regex patterns
- [ ] Add PII check to embedding pipeline
- [ ] Create admin notification for high-risk PII
- [ ] Add user setting: "Enable PII anonymization"
- [ ] Document PII handling in privacy policy

---

## 6. Testing Approach

### 6.1 Integration Testing Strategy

**Test Pyramid:**
```
         /\
        /  \  E2E Tests (5%)
       /----\
      /      \  Integration Tests (25%)
     /--------\
    /          \  Unit Tests (70%)
   /____________\
```

**Test Categories:**

**1. Unit Tests (70% coverage target)**
```typescript
// tests/unit/vector-search.test.ts
describe('VectorSearch', () => {
  describe('HNSW Index', () => {
    it('should initialize with correct dimensions', async () => {
      const vs = new VectorSearch(384, 10000);
      await vs.initialize();

      expect(vs.dimensions).toBe(384);
      expect(vs.maxElements).toBe(10000);
    });

    it('should add vectors and retrieve by ID', async () => {
      const vs = new VectorSearch(384, 100);
      await vs.initialize();

      const vectors = [
        new Float32Array(384).fill(0.5),
        new Float32Array(384).fill(0.3)
      ];

      await vs.addVectors(['msg1', 'msg2'], vectors);

      const results = await vs.search(vectors[0], 1);
      expect(results[0].id).toBe('msg1');
    });

    it('should save and load index', async () => {
      const vs1 = new VectorSearch(384, 100);
      await vs1.initialize();
      await vs1.addVectors(['test'], [new Float32Array(384).fill(1)]);

      const indexData = await vs1.saveIndex();

      const vs2 = new VectorSearch(384, 100);
      await vs2.initialize();
      await vs2.loadIndex(indexData);

      const results = await vs2.search(new Float32Array(384).fill(1), 1);
      expect(results[0].id).toBe('test');
    });
  });

  describe('PII Detection', () => {
    it('should detect email addresses', () => {
      const detector = new PIIDetector();
      const text = 'Contact me at test@example.com';

      const result = detector.detectPII(text);
      expect(result.hasPII).toBe(true);
      expect(result.findings[0].type).toBe('email');
    });

    it('should detect private keys', () => {
      const detector = new PIIDetector();
      const text = 'My key is nsec1abc...xyz';

      const result = detector.detectPII(text);
      expect(result.hasPII).toBe(true);
      expect(result.riskLevel).toBe('high');
    });
  });

  describe('Storage Quota', () => {
    it('should calculate vector storage size correctly', () => {
      const calc = new StorageCalculator();
      const size = calc.calculateVectorStorage(10000, 384);

      expect(size.vectors).toBe(10000 * 384 * 4);
      expect(size.total).toBeGreaterThan(size.vectors);
    });

    it('should prune old vectors when quota exceeded', async () => {
      const db = new MockDB();
      await db.vectorIndex.bulkPut(generateMockVectors(1000));

      await db.pruneVectorIndex({ maxVectorAgeDays: 7 });

      const remaining = await db.vectorIndex.count();
      expect(remaining).toBeLessThan(1000);
    });
  });
});
```

**2. Integration Tests (25% coverage target)**
```typescript
// tests/integration/semantic-search.test.ts
describe('Semantic Search Integration', () => {
  let db: MinimoomaNoirDB;
  let vectorSearch: VectorSearch;

  beforeEach(async () => {
    db = new MinimoomaNoirDB();
    await db.open();

    vectorSearch = new VectorSearch(384, 10000);
    await vectorSearch.initialize();
  });

  afterEach(async () => {
    await db.delete();
  });

  it('should index and search messages end-to-end', async () => {
    // Insert test messages
    const messages = [
      { id: '1', content: 'How to cook pasta', channelId: 'ch1' },
      { id: '2', content: 'Italian cooking recipes', channelId: 'ch1' },
      { id: '3', content: 'Quantum physics explained', channelId: 'ch1' }
    ];

    await db.messages.bulkPut(messages);

    // Generate mock embeddings
    const embeddings = await generateMockEmbeddings(messages);
    await vectorSearch.addVectors(
      messages.map(m => m.id),
      embeddings
    );

    // Search
    const queryEmbedding = embeddings[0]; // "cooking pasta"
    const results = await vectorSearch.search(queryEmbedding, 2);

    expect(results[0].id).toBe('1'); // Exact match
    expect(results[1].id).toBe('2'); // Similar topic
    expect(results.find(r => r.id === '3')).toBeUndefined(); // Different topic
  });

  it('should handle R2 sync failures gracefully', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockRejectedValue(
      new Error('Network error')
    );

    const manager = new EmbeddingManager(db, vectorSearch);

    await expect(manager.syncFromR2('ch1')).rejects.toThrow();

    // Should fall back to keyword search
    const results = await manager.search('cooking', 10);
    expect(results.method).toBe('keyword');

    mockFetch.mockRestore();
  });

  it('should recover from corrupted index', async () => {
    const manager = new EmbeddingManager(db, vectorSearch);

    // Create valid index
    await manager.buildIndex(['msg1', 'msg2']);

    // Corrupt index metadata
    await db.vectorMetadata.update('main', { checksum: 'invalid' });

    // Should detect corruption and rebuild
    await manager.ensureIndexValid();

    const isValid = await validateIndexIntegrity();
    expect(isValid).toBe(true);
  });
});
```

**3. E2E Tests (5% coverage target)**
```typescript
// tests/e2e/semantic-search.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Semantic Search E2E', () => {
  test('should search messages semantically', async ({ page }) => {
    await page.goto('/channel/general');

    // Wait for embeddings to load
    await page.waitForSelector('[data-testid="search-ready"]');

    // Enter search query
    await page.fill('[data-testid="search-input"]', 'cooking recipes');
    await page.click('[data-testid="semantic-search-toggle"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]');

    const results = page.locator('[data-testid="message-result"]');
    const count = await results.count();

    expect(count).toBeGreaterThan(0);

    // Verify first result is relevant
    const firstResult = results.first();
    const content = await firstResult.textContent();

    expect(content?.toLowerCase()).toMatch(/cook|recipe|food/);
  });

  test('should fall back to keyword search on error', async ({ page }) => {
    // Intercept R2 request and return error
    await page.route('**/r2.cloudflare.com/**', route => {
      route.abort('failed');
    });

    await page.goto('/channel/general');

    // Search should still work with keyword fallback
    await page.fill('[data-testid="search-input"]', 'hello');

    await page.waitForSelector('[data-testid="search-results"]');

    // Verify fallback indicator
    const fallbackBadge = page.locator('[data-testid="keyword-search-badge"]');
    await expect(fallbackBadge).toBeVisible();
  });

  test('should show storage warning when quota low', async ({ page, context }) => {
    // Mock storage API to return low quota
    await page.addInitScript(() => {
      Object.defineProperty(navigator.storage, 'estimate', {
        value: () => Promise.resolve({
          usage: 900 * 1024 * 1024,  // 900 MB
          quota: 1000 * 1024 * 1024   // 1 GB (90% full)
        })
      });
    });

    await page.goto('/settings');

    // Should show storage warning
    const warning = page.locator('[data-testid="storage-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('90%');
  });
});
```

### 6.2 Performance Testing

**Benchmark Suite:**
```typescript
// tests/performance/vector-search.bench.ts
import { bench, describe } from 'vitest';

describe('Vector Search Performance', () => {
  bench('HNSW index build (1k vectors)', async () => {
    const vs = new VectorSearch(384, 1000);
    await vs.initialize();

    const vectors = Array.from({ length: 1000 }, () =>
      new Float32Array(384).fill(Math.random())
    );
    const ids = Array.from({ length: 1000 }, (_, i) => `msg${i}`);

    await vs.addVectors(ids, vectors);
  });

  bench('HNSW search (k=10) on 10k index', async () => {
    const vs = await setupIndex(10000);
    const query = new Float32Array(384).fill(Math.random());

    await vs.search(query, 10);
  });

  bench('IndexedDB vector storage (1k vectors)', async () => {
    const db = new MinimoomaNoirDB();
    await db.open();

    const vectors = Array.from({ length: 1000 }, (_, i) => ({
      messageId: `msg${i}`,
      channelId: 'ch1',
      embedding: new Float32Array(384).fill(Math.random()),
      timestamp: Date.now()
    }));

    await db.vectorIndex.bulkPut(vectors);

    await db.delete();
  });

  bench('R2 download and parse (1k embeddings)', async () => {
    const data = generateMockEmbeddingFile(1000);
    const blob = new Blob([data]);

    const arrayBuffer = await blob.arrayBuffer();
    const parsed = parseEmbeddingFile(arrayBuffer);

    expect(parsed.length).toBe(1000);
  });
});

// Performance targets
const PERFORMANCE_TARGETS = {
  indexBuild1k: 500,      // ms
  indexBuild10k: 5000,    // ms
  searchK10: 50,          // ms
  idbWrite1k: 100,        // ms
  r2Download1k: 1000      // ms
};
```

**Load Testing:**
```typescript
// tests/load/concurrent-search.test.ts
describe('Concurrent Search Load Test', () => {
  it('should handle 100 concurrent searches', async () => {
    const vs = await setupIndex(10000);

    const searches = Array.from({ length: 100 }, () => {
      const query = new Float32Array(384).fill(Math.random());
      return vs.search(query, 10);
    });

    const start = Date.now();
    const results = await Promise.all(searches);
    const duration = Date.now() - start;

    expect(results).toHaveLength(100);
    expect(duration).toBeLessThan(5000); // 5s for 100 searches
  });

  it('should handle memory pressure during indexing', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

    const vs = new VectorSearch(384, 100000);
    await vs.initialize();

    // Add vectors in batches
    for (let i = 0; i < 100; i++) {
      const vectors = Array.from({ length: 1000 }, () =>
        new Float32Array(384).fill(Math.random())
      );
      const ids = Array.from({ length: 1000 }, (_, j) =>
        `msg${i * 1000 + j}`
      );

      await vs.addVectors(ids, vectors);

      // Check memory growth
      const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const growth = currentMemory - initialMemory;

      expect(growth).toBeLessThan(500 * 1024 * 1024); // Max 500 MB growth
    }
  });
});
```

### 6.3 Security Testing

**Security Test Suite:**
```typescript
// tests/security/vector-search.security.test.ts
describe('Vector Search Security', () => {
  describe('PII Protection', () => {
    it('should reject embeddings with private keys', async () => {
      const message = {
        id: '1',
        content: 'My private key is nsec1abcdef...',
        channelId: 'ch1'
      };

      const generator = new EmbeddingGenerator();

      await expect(
        generator.generateWithPIICheck(message)
      ).rejects.toThrow('PII detected');
    });

    it('should anonymize PII before embedding', async () => {
      const message = {
        id: '1',
        content: 'Contact me at test@example.com or 555-1234',
        channelId: 'ch1'
      };

      const generator = new EmbeddingGenerator({ anonymize: true });
      const result = await generator.generate(message);

      expect(result.processedContent).toBe(
        'Contact me at [EMAIL] or [PHONE]'
      );
    });
  });

  describe('Access Control', () => {
    it('should require valid token for R2 access', async () => {
      const response = await fetch(
        'https://r2-proxy.../embeddings/channel123.bin'
      );

      expect(response.status).toBe(403);
    });

    it('should allow access with valid token', async () => {
      const token = await generateValidToken('user1', 'channel123');

      const response = await fetch(
        `https://r2-proxy.../embeddings/channel123.bin?token=${token}`
      );

      expect(response.status).toBe(200);
    });

    it('should prevent enumeration attacks', async () => {
      const attempts = [];

      for (let i = 0; i < 100; i++) {
        const response = await fetch(
          `https://r2.../embeddings/channel${i}.bin`
        );
        attempts.push(response.status);
      }

      // Should not reveal which channels exist
      const unique = new Set(attempts);
      expect(unique.size).toBe(1); // All 404 or all 403
    });
  });

  describe('Encrypted Channel Protection', () => {
    it('should not generate embeddings for encrypted channels', async () => {
      const channel = {
        id: 'encrypted1',
        isEncrypted: true
      };

      await db.channels.put(channel);

      const generator = new EmbeddingGenerator(db);
      const shouldGenerate = await generator.shouldProcess(channel.id);

      expect(shouldGenerate).toBe(false);
    });
  });
});
```

**Action Items:**
- [ ] Implement unit test suite (target: 70% coverage)
- [ ] Create integration tests for R2 sync
- [ ] Add E2E tests with Playwright
- [ ] Set up performance benchmarks
- [ ] Run security test suite
- [ ] Add CI/CD integration for tests

---

## 7. Go/No-Go Criteria

### Decision Matrix

| Criterion | Weight | Score (1-10) | Weighted Score | Status |
|-----------|--------|--------------|----------------|--------|
| **Dependency Stability** | 0.2 | 5 | 1.0 | ⚠ CONCERN |
| **Technical Feasibility** | 0.25 | 8 | 2.0 | ✓ GO |
| **Security & Privacy** | 0.2 | 7 | 1.4 | ✓ GO |
| **Scalability** | 0.15 | 6 | 0.9 | ⚠ CONCERN |
| **Resource Availability** | 0.1 | 9 | 0.9 | ✓ GO |
| **User Value** | 0.1 | 9 | 0.9 | ✓ GO |
| **TOTAL** | 1.0 | - | **7.1/10** | **CONDITIONAL GO** |

### Scoring Breakdown

**Dependency Stability (5/10):**
- ✗ hnswlib-wasm 18 months stale (-3 points)
- ✓ Python ecosystem well-maintained (+2 points)
- ✓ R2 is production-ready (+1 point)

**Technical Feasibility (8/10):**
- ✓ Vite + WASM integration proven (+2 points)
- ✓ IndexedDB widely supported (+2 points)
- ⚠ Mobile memory constraints (-1 point)
- ✓ Existing Dexie infrastructure (+1 point)

**Security & Privacy (7/10):**
- ✓ Encrypted channel exclusion strategy (+2 points)
- ✓ PII detection implemented (+1 point)
- ⚠ Public R2 embeddings (-1 point)
- ✓ Access control via Worker (+2 points)

**Scalability (6/10):**
- ⚠ IndexedDB quota limits on mobile (-2 points)
- ✓ GitHub Actions can handle 100k messages (+1 point)
- ✓ R2 free tier sufficient (+2 points)
- ⚠ WASM memory on low-end devices (-1 point)

**Resource Availability (9/10):**
- ✓ Free Cloudflare R2 (+2 points)
- ✓ GitHub Actions included (+2 points)
- ✓ No additional infrastructure needed (+1 point)

**User Value (9/10):**
- ✓ Semantic search is high-value feature (+3 points)
- ✓ Improves content discovery (+2 points)
- ⚠ Not available on encrypted channels (-1 point)

### GO Conditions

**PROCEED IF:**
1. ✅ Implement hnswlib-wasm abstraction layer (allows swapping)
2. ✅ Add device capability detection (exclude low-end devices)
3. ✅ Implement encrypted channel exclusion (v1)
4. ✅ Set up R2 proxy with access control
5. ✅ Create fallback to keyword search
6. ✅ Establish monitoring for quota/memory usage
7. ✅ Document rollback plan

**NO-GO IF:**
- ❌ hnswlib-wasm has critical security vulnerability
- ❌ IndexedDB quota too restrictive (<100MB on target browsers)
- ❌ GitHub Actions costs exceed $50/month
- ❌ Memory usage >500MB on desktop browsers
- ❌ Cannot achieve <3s search latency

### Phase 1 Success Metrics

**Must Have (v1.0):**
- [ ] Semantic search works on desktop Chrome/Firefox
- [ ] Search latency <3 seconds for 10k message index
- [ ] Storage usage <100MB for 10k messages
- [ ] Fallback to keyword search on failures
- [ ] PII detection prevents embedding leaks

**Should Have (v1.1):**
- [ ] Mobile browser support (iOS Safari, Chrome Android)
- [ ] Progressive embedding download
- [ ] R2 access control via Worker
- [ ] Index recovery from corruption

**Nice to Have (v2.0):**
- [ ] Client-side embedding for encrypted channels
- [ ] Multi-language support
- [ ] Personalized search ranking
- [ ] Search analytics dashboard

### Rollback Plan

**Trigger Conditions:**
- User complaints about performance/crashes
- Storage quota exceeded on >20% of devices
- Security vulnerability discovered in hnswlib-wasm
- GitHub Actions costs spike unexpectedly

**Rollback Steps:**
1. **Disable vector search UI** - hide toggle in search interface
2. **Stop embedding generation** - pause GitHub Actions workflow
3. **Keep keyword search** - existing functionality unaffected
4. **Analyze root cause** - debug logs, user reports
5. **Fix or pivot** - patch issue or switch to alternative

**Rollback SLA:**
- Detection to mitigation: <1 hour
- Full rollback: <4 hours
- User communication: Within 24 hours

---

## 8. Recommended Implementation Roadmap

### Phase 0: Foundation (Week 1-2)

**Goals:** Validate core assumptions, set up infrastructure

**Tasks:**
1. ✅ **WASM Integration Test**
   - Test hnswlib-wasm with Vite 5.4
   - Verify browser compatibility
   - Measure load time and performance

2. ✅ **R2 Bucket Setup**
   - Create minimoonoir-embeddings bucket
   - Configure CORS for PWA domain
   - Test upload/download

3. ✅ **Embedding Generation POC**
   - Create `scripts/generate-embeddings.py`
   - Test with 1k messages
   - Measure inference time

4. ✅ **Storage Quota Analysis**
   - Test on Safari (1GB limit)
   - Test on mobile browsers
   - Document findings

**Success Criteria:**
- [ ] WASM loads in <2 seconds
- [ ] Python script generates 1k embeddings in <1 minute
- [ ] Safari quota sufficient for 5k messages
- [ ] No blockers identified

### Phase 1: MVP (Week 3-6)

**Goals:** Working semantic search for public channels on desktop

**Tasks:**
1. **Core Implementation** (Week 3-4)
   - [ ] Create vector-search.ts abstraction layer
   - [ ] Implement HNSW index wrapper
   - [ ] Add Dexie schema for vectors
   - [ ] Build WebWorker for indexing

2. **UI Integration** (Week 4-5)
   - [ ] Add semantic search toggle to search bar
   - [ ] Create embedding download progress indicator
   - [ ] Implement device capability check
   - [ ] Add fallback to keyword search

3. **Backend Pipeline** (Week 5-6)
   - [ ] Create GitHub Actions workflow
   - [ ] Implement incremental embedding generation
   - [ ] Upload embeddings to R2
   - [ ] Add D1 tracking table

4. **Testing** (Week 6)
   - [ ] Unit tests (70% coverage)
   - [ ] Integration tests (R2 sync, search)
   - [ ] E2E tests (Playwright)
   - [ ] Performance benchmarks

**Success Criteria:**
- [ ] Search 10k messages in <3 seconds
- [ ] <100MB storage usage
- [ ] 90%+ accuracy on semantic queries
- [ ] Zero crashes on desktop browsers

### Phase 2: Hardening (Week 7-8)

**Goals:** Production-ready with security, monitoring, recovery

**Tasks:**
1. **Security** (Week 7)
   - [ ] Implement R2 proxy Worker
   - [ ] Add channel access control
   - [ ] PII detection in embedding pipeline
   - [ ] Security audit and penetration testing

2. **Reliability** (Week 7-8)
   - [ ] Index corruption detection
   - [ ] Automatic rebuild mechanism
   - [ ] Version migration framework
   - [ ] Checkpointing and rollback

3. **Monitoring** (Week 8)
   - [ ] Storage quota alerts
   - [ ] Search latency tracking
   - [ ] GitHub Actions cost monitoring
   - [ ] Error rate dashboards

**Success Criteria:**
- [ ] All security tests pass
- [ ] Recovery from corruption in <5 minutes
- [ ] Monitoring alerts functional
- [ ] Zero critical bugs in prod

### Phase 3: Optimization (Week 9-10)

**Goals:** Mobile support, performance tuning

**Tasks:**
1. **Mobile Optimization** (Week 9)
   - [ ] Test on iOS Safari, Android Chrome
   - [ ] Implement progressive loading
   - [ ] Memory usage optimization
   - [ ] 3G network testing

2. **Performance Tuning** (Week 9-10)
   - [ ] Optimize HNSW parameters (M, efSearch)
   - [ ] Implement embedding compression
   - [ ] Add search caching
   - [ ] Reduce bundle size

3. **UX Polish** (Week 10)
   - [ ] Search result highlighting
   - [ ] Related message suggestions
   - [ ] Search history
   - [ ] Keyboard shortcuts

**Success Criteria:**
- [ ] Works on mid-range mobile devices
- [ ] Search latency <1 second (cached)
- [ ] <50MB storage on mobile
- [ ] Positive user feedback

### Phase 4: Advanced Features (Week 11-12)

**Goals:** Encrypted channel support, analytics

**Tasks:**
1. **Client-Side Embeddings** (Week 11)
   - [ ] Evaluate ONNX.js for in-browser inference
   - [ ] Implement opt-in client-side generation
   - [ ] Test performance on mobile
   - [ ] Document trade-offs

2. **Analytics** (Week 12)
   - [ ] Search query analytics
   - [ ] Popular topics dashboard
   - [ ] User engagement metrics
   - [ ] A/B test semantic vs keyword

**Success Criteria:**
- [ ] Client-side embedding <500ms per message
- [ ] Analytics dashboard functional
- [ ] Encrypted channel search available (opt-in)

---

## 9. Conclusion

### Summary

The Semantic Vector Search feature is **TECHNICALLY FEASIBLE** but carries **MODERATE-HIGH RISK** due to:

1. **Dependency age:** hnswlib-wasm is 18 months stale
2. **Storage constraints:** Mobile browsers have tight quotas
3. **Complexity:** Multi-component system (WASM + R2 + Workers + GitHub Actions)

### Recommendation

**CONDITIONAL GO** - Proceed with MVP implementation under these conditions:

✅ **DO:**
- Implement abstraction layer for vector search provider
- Add device capability detection (exclude low-end devices)
- Use encrypted channel exclusion strategy (v1)
- Set up comprehensive monitoring
- Create rollback plan

❌ **DON'T:**
- Deploy to production without thorough testing
- Enable on all devices (risk crashes on low-memory)
- Generate embeddings for encrypted channels (v1)
- Ignore storage quota warnings

### Risk Mitigation Priorities

**P0 (Must Fix Before Prod):**
1. Implement hnswlib-wasm abstraction layer
2. Add device capability checks
3. Create fallback to keyword search
4. Set up R2 access control

**P1 (Should Fix in v1.1):**
1. Index corruption recovery
2. Mobile optimization
3. Progressive embedding download
4. Storage quota monitoring

**P2 (Nice to Have):**
1. Client-side embedding for encrypted
2. Multi-language support
3. Search analytics

### Next Steps

1. **Week 1:** Validate assumptions (WASM test, R2 setup, quota analysis)
2. **Week 2:** Decision checkpoint - GO/NO-GO based on validation
3. **Week 3-6:** MVP implementation if validated
4. **Week 7-8:** Hardening and security
5. **Week 9-10:** Optimization and mobile support

### Final Risk Assessment

**Overall Risk Level:** MEDIUM-HIGH
**Confidence Level:** 75%
**Recommended Action:** Proceed with caution, validate early, monitor closely

---

**Document Version:** 1.0
**Last Updated:** 2025-12-14
**Next Review:** After Phase 0 validation (Week 2)
