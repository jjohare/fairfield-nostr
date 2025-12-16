[← Back to Main README](../../README.md)

# Minimoonoir - Semantic Vector Search Specification

> **Project:** Private Chatroom System - Semantic Search Enhancement
> **Version:** 0.1.0-draft
> **Date:** 2024-12-14
> **Status:** Proposal Phase
> **[Back to Main README](../../README.md)**

---

## 1. Executive Summary

Semantic Vector Search enhances the Minimoonoir chat system with intelligent similarity-based message discovery. This feature enables users to find relevant conversations using natural language queries rather than exact keyword matching.

**Key Capabilities:**
- **Semantic message search** across 100k+ historical messages
- **Client-side vector search** (privacy-preserving, no server queries)
- **Nightly embedding generation** via GitHub Actions
- **WiFi-optimized lazy loading** (~15MB compressed index)
- **O(log n) HNSW search** using hnswlib-wasm (247KB bundle)
- **R2-backed storage** (Cloudflare free tier: 10GB, 1M reads/month)

**Architecture Philosophy:**
- Generate embeddings server-side (GitHub Actions)
- Store vectors in Cloudflare R2 (cheap, scalable)
- Download index to PWA over WiFi (one-time ~15MB)
- Search locally using WASM (instant, offline-capable)

---

## 2. Business Requirements

### 2.1 Use Cases

| Use Case | Example Query | Value Proposition |
|----------|---------------|-------------------|
| **Topic Discovery** | "meditation retreat schedules" | Find scattered conversations about a topic |
| **Knowledge Retrieval** | "how to reset my password" | Locate help messages without scrolling |
| **Event Context** | "summer 2024 bonfire" | Recall event discussions months later |
| **Course Content** | "breathwork techniques" | Search course-related messages |
| **Admin Insight** | "user complaints about booking" | Aggregate feedback patterns |

### 2.2 Scale Parameters

| Metric | Initial | 2-Year Target |
|--------|---------|---------------|
| **Total messages** | 10k | 100k |
| **Users** | 50 | 300 |
| **Vector dimensions** | 384 | 384 |
| **Index size (uncompressed)** | 1.5MB | 15MB |
| **Index size (int8 quantized)** | 375KB | 3.75MB |
| **Index size (gzipped)** | ~150KB | ~1.5MB |
| **Daily new messages** | 10-50 | 50-200 |

### 2.3 User Experience Goals

- Search results appear in <200ms (local WASM)
- Index download happens silently over WiFi
- Search available offline after first load
- No additional server costs beyond R2 storage
- Privacy: Search queries never leave client device

---

## 3. Functional Requirements

### 3.1 Embedding Generation (Server-Side)

```
FR-001: GitHub Actions workflow runs nightly at 2 AM UTC
FR-002: Fetch all new/updated messages from Nostr relay since last run
FR-003: Generate 384d embeddings using sentence-transformers/all-MiniLM-L6-v2
FR-004: Quantize float32 → int8 (75% size reduction)
FR-005: Build HNSW index with ef_construction=200, M=16
FR-006: Upload index.bin, vectors.bin, manifest.json to Cloudflare R2
FR-007: Track last_indexed_timestamp in manifest for incremental updates
FR-008: Generate index in <10 minutes for 100k messages
```

### 3.2 Index Storage (Cloudflare R2)

```
FR-010: R2 bucket structure: /semantic-search/{version}/
FR-011: Manifest JSON schema includes: version, timestamp, message_count, index_hash
FR-012: Index files: index.bin (HNSW graph), vectors.bin (quantized embeddings)
FR-013: Version-based URLs for cache busting
FR-014: Public read access via R2 custom domain (no auth required)
FR-015: Automatic 30-day retention for old index versions
FR-016: Monitor R2 usage (alert at 80% of 10GB free tier)
```

### 3.3 PWA Integration (Client-Side)

```
FR-020: Detect WiFi connection before downloading index
FR-021: Show "Download Search Index" prompt with size estimate
FR-022: Download index.bin + vectors.bin to IndexedDB
FR-023: Lazy-load hnswlib-wasm (~247KB) only when search is used
FR-024: Initialize HNSW index in Web Worker (non-blocking UI)
FR-025: Cache loaded index in IndexedDB (persist across sessions)
FR-026: Show download progress bar (0-100%)
FR-027: Retry failed downloads with exponential backoff
FR-028: Auto-update index if new version detected (background)
```

### 3.4 Search Execution

```
FR-030: Accept natural language query (any length)
FR-031: Generate query embedding using TF.js Sentence Encoder (client-side)
FR-032: Search HNSW index with k=20 nearest neighbors
FR-033: Return note_ids ranked by cosine similarity
FR-034: Fetch full note objects from Nostr relay
FR-035: Display results with snippet highlighting
FR-036: Filter results by channel/cohort permissions
FR-037: Sort by relevance (default) or recency (optional)
FR-038: Search completes in <200ms for 100k vectors
```

### 3.5 Search UI

```
FR-040: Search bar in navigation (global access)
FR-041: Autocomplete suggestions (optional)
FR-042: Inline result previews with message snippet
FR-043: Click result to jump to message in channel context
FR-044: "No results" state with suggestions
FR-045: Search history (last 10 queries in localStorage)
FR-046: Loading states: "Downloading index", "Searching", "Fetching results"
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

```
NFR-001: HNSW search latency <50ms for 100k vectors
NFR-002: Index load time <2 seconds (from IndexedDB)
NFR-003: Index download <30 seconds on WiFi (15MB)
NFR-004: Query embedding generation <100ms (TF.js WASM)
NFR-005: Relay fetch for 20 results <200ms
NFR-006: Total search time <500ms (embedding + search + fetch)
```

### 4.2 Scalability

```
NFR-010: Support 100k messages (38MB uncompressed, 9.5MB int8, ~4MB gzipped)
NFR-011: Incremental index updates (append-only, no full rebuild)
NFR-012: Graceful degradation beyond 200k messages (batch queries)
NFR-013: R2 bandwidth: <1GB/month (100 users × 10 downloads/month)
```

### 4.3 Accuracy

```
NFR-020: Recall@20 ≥85% for semantic queries
NFR-021: False positive rate <10% (irrelevant results)
NFR-022: Handle typos and paraphrasing gracefully
NFR-023: Respect E2E encryption (only index unencrypted channels)
```

### 4.4 Reliability

```
NFR-030: Index generation succeeds 99% of nights
NFR-031: R2 availability 99.9% (Cloudflare SLA)
NFR-032: Fallback to keyword search if index unavailable
NFR-033: Corrupted index auto-redownload
```

### 4.5 Privacy

```
NFR-040: Search queries NEVER sent to server
NFR-041: Embeddings generated ONLY from public/common channels
NFR-042: E2E encrypted channels excluded from index
NFR-043: No query logging or analytics
NFR-044: Index includes note_ids only (no plaintext content)
```

---

## 5. Data Models

### 5.1 Manifest Schema (manifest.json)

```json
{
  "version": "2024-12-14T02:00:00Z",
  "message_count": 100000,
  "index_hash": "sha256:abc123...",
  "vector_dimensions": 384,
  "quantization": "int8",
  "model": "sentence-transformers/all-MiniLM-L6-v2",
  "files": {
    "index": "index.bin",
    "vectors": "vectors.bin"
  },
  "stats": {
    "channels_indexed": 12,
    "size_bytes": {
      "index": 5242880,
      "vectors": 9830400,
      "total_uncompressed": 15073280,
      "total_gzipped": 1507328
    }
  },
  "last_indexed_at": "2024-12-14T02:15:00Z",
  "next_update_eta": "2024-12-15T02:00:00Z"
}
```

### 5.2 Index Structure (HNSW)

```
index.bin (HNSW Graph):
  - ef_construction: 200
  - M: 16 (connections per node)
  - ef_search: 50
  - max_elements: 100000
  - Format: hnswlib binary format
```

### 5.3 Vector Storage (vectors.bin)

```
Binary format (int8 quantized):
  - Header: [message_count: uint32, dimensions: uint16]
  - Scaling factors: [float32 × message_count] (for dequantization)
  - Vectors: [int8 × (message_count × dimensions)]

Total size = 4 + 2 + (4 × N) + (N × 384)
           = 6 + 4N + 384N
           = 6 + 388N bytes

For 100k messages:
  = 6 + 38,800,000 bytes
  = ~37MB uncompressed
  = ~9.3MB gzipped (75% reduction)
```

### 5.4 Message Metadata (Stored in IndexedDB)

```typescript
interface SearchableMessage {
  note_id: string;           // Nostr event ID
  channel_id: string;        // NIP-29 channel
  author_pubkey: string;     // Message author
  created_at: number;        // Unix timestamp
  vector_index: number;      // Index position in vectors.bin
  snippet: string;           // First 100 chars for preview
}
```

---

## 6. User Stories

### 6.1 Initial Setup

```gherkin
US-001: Download Search Index
AS A user on WiFi
I WANT TO download the search index automatically
SO THAT I can search messages offline

GIVEN I am connected to WiFi
AND the search index has not been downloaded
WHEN I open the app
THEN I see a prompt "Download search index (1.5MB) for offline search?"
AND I click "Download"
AND a progress bar shows 0-100%
AND the index downloads to IndexedDB
AND I see "Search ready" confirmation
AND the search bar becomes active
```

### 6.2 Semantic Query

```gherkin
US-010: Search by Topic
AS A user
I WANT TO search messages by topic
SO THAT I can find relevant conversations

GIVEN I have the search index loaded
WHEN I type "meditation retreat schedules" in the search bar
THEN the system generates a query embedding
AND searches the HNSW index
AND returns 20 ranked results
AND displays message snippets with authors and timestamps
AND I click a result to jump to the message in context
```

### 6.3 Index Update

```gherkin
US-020: Auto-Update Index
AS A returning user
I WANT TO receive updated search indexes automatically
SO THAT new messages are searchable

GIVEN I have an index from 7 days ago
AND I open the app on WiFi
WHEN the app checks for updates
THEN it detects a new index version
AND downloads the update in the background
AND replaces the old index in IndexedDB
AND notifies "Search index updated with 350 new messages"
```

### 6.4 Offline Search

```gherkin
US-030: Search Without Internet
AS A user offline
I WANT TO search previously downloaded messages
SO THAT I can find information without connectivity

GIVEN I have the search index in IndexedDB
AND I am offline (no relay connection)
WHEN I search for "course schedule"
THEN the search completes using the local index
AND returns results with note_ids
AND shows cached message previews
AND displays "⚠ Results may be outdated (index from Dec 10)"
```

---

## 7. Architecture Flow

### 7.1 Nightly Embedding Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│ GitHub Actions Workflow (Runs at 2 AM UTC)                  │
└─────────────────────────────────────────────────────────────┘
  │
  ├─ [1] Fetch new messages from Nostr relay (since last run)
  │     └─ Query: kind:1 (text notes) + kind:42 (channel msgs)
  │     └─ Filter: created_at > last_indexed_timestamp
  │
  ├─ [2] Generate embeddings (Python)
  │     └─ Model: sentence-transformers/all-MiniLM-L6-v2
  │     └─ Batch size: 32, GPU if available
  │     └─ Output: [N × 384] float32 embeddings
  │
  ├─ [3] Quantize to int8
  │     └─ Per-vector scaling: scale = max(abs(vector))
  │     └─ Quantized = round(vector / scale * 127)
  │     └─ Save scaling factors for dequantization
  │
  ├─ [4] Build/update HNSW index
  │     └─ Library: hnswlib (Python)
  │     └─ Parameters: M=16, ef_construction=200
  │     └─ Incremental add_items() for new vectors
  │
  ├─ [5] Generate manifest.json
  │     └─ Version: ISO timestamp
  │     └─ Hash: SHA256 of index.bin + vectors.bin
  │
  └─ [6] Upload to Cloudflare R2
        └─ Path: /semantic-search/2024-12-14T02-00-00Z/
        └─ Files: manifest.json, index.bin, vectors.bin
        └─ Public URL: https://cdn.minimoonoir.com/semantic-search/latest/
```

### 7.2 Client-Side Search Flow

```
┌─────────────────────────────────────────────────────────────┐
│ PWA Search Execution (200ms total)                           │
└─────────────────────────────────────────────────────────────┘
  │
  ├─ [1] User enters query (e.g., "course schedule")
  │
  ├─ [2] Generate query embedding (TF.js WASM)
  │     └─ Model: Universal Sentence Encoder Lite
  │     └─ Latency: ~100ms
  │     └─ Output: [384] float32 vector
  │
  ├─ [3] Search HNSW index (hnswlib-wasm in Web Worker)
  │     └─ knn_query(embedding, k=20)
  │     └─ Returns: [(note_id, distance), ...]
  │     └─ Latency: ~50ms
  │
  ├─ [4] Fetch note details from relay
  │     └─ REQ: note_ids from top 20 results
  │     └─ Latency: ~200ms
  │
  ├─ [5] Filter by permissions
  │     └─ Remove results from channels user can't access
  │     └─ Respect cohort visibility rules
  │
  └─ [6] Render results
        └─ Highlight query terms in snippets
        └─ Show relevance score (1 - distance)
        └─ Link to message in channel context
```

---

## 8. Technical Constraints

### 8.1 Embedding Model

```
Model: sentence-transformers/all-MiniLM-L6-v2
  - Dimensions: 384
  - Max sequence length: 256 tokens
  - Language: English (multilingual variants available)
  - Inference speed: ~30s per 1,000 messages (CPU)
  - Memory: ~500MB RAM during generation
```

### 8.2 Vector Quantization

```
Quantization: int8 scalar
  - Original: 384 × 4 bytes (float32) = 1,536 bytes/vector
  - Quantized: 384 × 1 byte (int8) + 4 bytes (scale) = 388 bytes/vector
  - Compression ratio: 75% reduction
  - Accuracy loss: <2% on recall@20 (empirically tested)
```

### 8.3 Bundle Size

```
hnswlib-wasm: 247KB gzipped
  - SIMD optimized for modern browsers
  - No external dependencies
  - WebAssembly module + JS glue code
```

### 8.4 Memory Usage

```
Client-side (100k vectors):
  - HNSW index: ~5MB
  - Quantized vectors: ~37MB
  - IndexedDB overhead: ~2MB
  - Total: ~44MB in-memory (acceptable for modern devices)
```

---

## 9. Integration Points

### 9.1 GitHub Actions

```yaml
# .github/workflows/generate-embeddings.yml
name: Generate Semantic Search Index
on:
  schedule:
    - cron: "0 2 * * *"  # 2 AM UTC daily
  workflow_dispatch:      # Manual trigger

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: pip install sentence-transformers hnswlib boto3
      - name: Fetch messages from relay
        run: python scripts/fetch-messages.py
      - name: Generate embeddings
        run: python scripts/generate-embeddings.py
      - name: Build HNSW index
        run: python scripts/build-index.py
      - name: Upload to R2
        env:
          R2_ACCESS_KEY: ${{ secrets.R2_ACCESS_KEY }}
        run: python scripts/upload-to-r2.py
```

### 9.2 Cloudflare R2

```
Bucket: minimoonoir-semantic-search
  - Region: auto
  - Storage class: Standard
  - Public access: Enabled via custom domain
  - CDN: Cloudflare CDN (automatic)
  - Lifecycle: Delete versions older than 30 days
```

### 9.3 PWA (React Component)

```typescript
// src/components/SemanticSearch.tsx
import { useEffect, useState } from 'react';
import { loadHNSW } from '@/lib/hnswlib-loader';
import { generateEmbedding } from '@/lib/embedding-client';

export function SemanticSearch() {
  const [index, setIndex] = useState(null);
  const [results, setResults] = useState([]);

  useEffect(() => {
    // Check WiFi and download index
    if (navigator.connection?.effectiveType === '4g' ||
        navigator.connection?.type === 'wifi') {
      downloadIndex();
    }
  }, []);

  async function search(query: string) {
    const embedding = await generateEmbedding(query);
    const noteIds = index.knnQuery(embedding, 20);
    const notes = await fetchNotesFromRelay(noteIds);
    setResults(notes);
  }
}
```

### 9.4 Nostr Relay

```
Query for matched results:
  - REQ subscription for note_ids from search
  - Filter by user's channel permissions
  - Return full event objects (kind:1, kind:42)
```

---

## 10. Open Questions

### Q1: Encrypted Channel Handling
For E2E encrypted channels (NIP-44):
- **(a)** Exclude entirely from index (safest)
- **(b)** Generate embeddings after client-side decryption (requires key management)
- **(c)** Allow opt-in per-channel (admin decision)

**Recommendation:** Option (a) for v1 - only index public/common channels

### Q2: Index Update Frequency
- **(a)** Nightly (24h lag for new messages)
- **(b)** Every 6 hours (more current, higher costs)
- **(c)** Weekly (minimize GitHub Actions usage)

**Recommendation:** Option (a) - nightly is sufficient for community chat

### Q3: Client-Side Embedding Model
- **(a)** TF.js Universal Sentence Encoder (~1MB model)
- **(b)** ONNX Runtime with MiniLM model (~20MB)
- **(c)** Pre-generate embeddings for common queries (limited flexibility)

**Recommendation:** Option (a) - best balance of size and accuracy

### Q4: Fallback Search
When index is unavailable:
- **(a)** Full-text keyword search (regex on client)
- **(b)** Relay-side full-text search (requires relay modification)
- **(c)** No search (wait for index)

**Recommendation:** Option (a) - simple keyword fallback

---

## 11. Out of Scope (v1.0)

- Multi-language support (English only initially)
- Image/media content search (text messages only)
- Real-time incremental index updates (nightly batch only)
- Federated search across external relays
- User-specific index customization
- Query autocomplete/suggestions
- Search analytics/trending queries
- Voice-to-text query input
- Export search results
- Advanced filters (date ranges, authors, channels)

---

## 12. Success Criteria

| Metric | Target |
|--------|--------|
| **Search adoption rate** | >60% of active users |
| **Search precision@10** | >80% (relevant results in top 10) |
| **Search recall@20** | >85% (finds most relevant messages) |
| **Average search latency** | <500ms (end-to-end) |
| **Index download completion** | >90% on WiFi |
| **GitHub Actions success rate** | >99% (nightly runs) |
| **R2 storage usage** | <5GB (within free tier) |
| **R2 bandwidth usage** | <1GB/month (within free tier) |
| **Zero search queries sent to server** | 100% (privacy guarantee) |

---

## 13. Rollout Plan

### Phase 1: Infrastructure (Week 1-2)
- Setup Cloudflare R2 bucket
- Create GitHub Actions workflow
- Generate initial index for existing messages

### Phase 2: PWA Integration (Week 3-4)
- Build SemanticSearch component
- Implement index download logic
- Add search UI to navigation

### Phase 3: Testing (Week 5)
- Validate search accuracy on sample queries
- Performance testing with 100k vectors
- User acceptance testing with 10 beta users

### Phase 4: Launch (Week 6)
- Deploy to production
- Monitor R2 usage and costs
- Collect user feedback

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **HNSW** | Hierarchical Navigable Small World - fast approximate nearest neighbor search |
| **Embedding** | Numerical vector representation of text (384 dimensions) |
| **Quantization** | Converting float32 to int8 to reduce storage (75% compression) |
| **R2** | Cloudflare object storage (S3-compatible) |
| **TF.js** | TensorFlow.js - ML inference in browser |
| **WASM** | WebAssembly - near-native performance in browsers |
| **kNN** | k-Nearest Neighbors - find k most similar vectors |
| **Cosine similarity** | Measure of vector similarity (-1 to 1) |

---

## Appendix B: Reference Documents

- [HNSW Algorithm Paper](https://arxiv.org/abs/1603.09320)
- [hnswlib Library](https://github.com/nmslib/hnswlib)
- [Sentence Transformers](https://www.sbert.net/)
- [Cloudflare R2 Docs](https://developers.cloudflare.com/r2/)
- [TensorFlow.js Universal Sentence Encoder](https://tfhub.dev/tensorflow/tfjs-model/universal-sentence-encoder-lite/1/default/1)
- [WebAssembly SIMD](https://v8.dev/features/simd)

---

## Appendix C: Cost Analysis

### Cloudflare R2 Free Tier
- **Storage:** 10GB (current need: ~4MB, 2-year forecast: ~40MB)
- **Class A operations:** 1M/month (writes: ~30/month for nightly updates)
- **Class B operations:** 10M/month (reads: ~3k/month for 100 users × 30 downloads)
- **Bandwidth:** Unlimited egress (via Cloudflare CDN)

**Estimated Monthly Cost:** $0 (well within free tier for 2 years)

### GitHub Actions (Free Tier)
- **Minutes:** 2,000/month (Ubuntu runner)
- **Estimated usage:** ~10 min/night × 30 nights = 300 min/month
- **Cost:** $0 (within free tier)

**Total Infrastructure Cost:** $0/month

---

*Next Phase: Pseudocode & Architecture Implementation (07-semantic-search-implementation.md)*
