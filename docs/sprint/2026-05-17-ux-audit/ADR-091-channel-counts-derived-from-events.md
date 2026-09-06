# ADR-091 — Channel post counts must be derived, not accumulated

**Date:** 2026-05-17
**Status:** Accepted
**Supersedes:** `ChannelStore.message_counts: HashMap<String, u32>` mutated by `+= 1`.

## Context
Live audit showed channel post counts inflate on every visit (4 → 14 → 22 → … for the same channel). Root cause in `src/stores/channels.rs:232-272`:
- `message_counts.update(|m| *m.entry(cid).or_insert(0) += 1)` runs on every kind-42 delivery with **no event-id dedup**.
- `channel_messages: HashMap<String, Vec<NostrEvent>>` in the same closure **does** dedup.
- Counts are persisted to localStorage, rehydrated on next mount, and then the broad kind-42 subscription replays history → counts grow.
- Two pipelines from the same source data caused additional UI divergence (Bug #12: header summary "0 messages" vs tile "96 Messages").

## Decision
Delete the standalone `message_counts` field. Expose count as a **memoised derivation** of `channel_messages`:

```rust
pub fn count_for(&self, cid: &str) -> usize {
    self.channel_messages.with(|m| m.get(cid).map_or(0, Vec::len))
}
```

For the sum used in the chat-hub total tile, derive equivalently:

```rust
pub fn total_messages(&self) -> usize {
    self.channel_messages.with(|m| m.values().map(Vec::len).sum())
}
```

## Consequences
- Bugs #2, #12, #15 collapse: single source of truth, no sparse map, no inflation.
- `CachedData` schema bumps (`message_counts` removed). Forward-compat: deserialize ignores unknown fields; old caches just don't populate counts — re-derived on first kind-42 EOSE.
- Slight memory overhead: full event Vec instead of just a counter. Acceptable: the events were already cached for rendering.
- Future invariant: any new aggregation MUST be a `Memo` derived from `channel_messages`. Reject PRs that introduce parallel counters.

## Closeout extension — 2026-09-05

Accepted design status is preserved; current implementation and deployment acceptance remain qualified. The persisted standalone counter is removed and store counts derive from deduplicated vectors. ChannelPage separately appends into MessageData without removing events absent from subsequent store snapshots; store deletion alone does not prove displayed-count reconciliation.

**CP-01/06/08/09:** Verify remote deletion, replay, reconnect and mounted-page counts through the actual store-to-view path; preserve deduplication across all insertion paths.

See the [current source-to-consumer assessment](../../../../VisionFlow/docs/estate-review/forum-decisions.md#forum-navigation-counts-and-cold-entry) and [source hashes](../../../../VisionFlow/docs/estate-review/evidence/forum-sprint-snapshot.json). No browser, relay or service-worker test ran in this pass. Frozen archive stubs are unchanged.

## Acceptance progress — 2026-09-05

**Implemented.** `ChannelPage` no longer accumulates events append-only. The rendered set is reconciled
against the store snapshot on every update, through
`crates/nostr-bbs-forum-client/src/utils/reconcile.rs`: `retain_present` drops every rendered item whose id
is absent from the snapshot, `absent_from` appends the new ones in snapshot order. An event removed upstream —
a NIP-09 deletion, a tombstone — therefore disappears and the count decreases, which it previously could not.

Survivors keep their relative order **and their identity**: they are not rebuilt, so per-item reactive state
(a thread's replies signal, an expanded/collapsed flag) survives a reconciliation pass rather than being
reset by a wholesale re-render.

**Tests and results.** 13 tests in `utils::reconcile` covering removals before appends, survivor ordering,
snapshot-order appends, and identity preservation. `cargo test -p nostr-bbs-forum-client` — 329 passed, 0
failed. `cargo test --workspace` — 1823 passed. `trunk build` — exit 0.

**Browser receipts.** Partial. The channel header was observed in Chrome rendering counts derived from the
store snapshot (`0 messages · 0 members`) rather than from a local accumulator, which is the shape the fix
requires. A **deletion was not driven in the browser**: publishing a kind-42 and then a kind-5 needs
secp256k1 Schnorr signing, and no signing library is installed in this container; the relay additionally
gates writes on NIP-42 AUTH plus the whitelist. See
[`browser-run.json`](../../estate-closeout/2026-09-05/browser-run.json).

**Remaining.** The count actually decreasing after a real deletion is proven in unit tests only. A browser
demonstration needs an event-signing helper in the harness — the same blocker as the ADR-2010 governance
journey, and worth solving once for both. Incidental: a Leptos dev-mode advisory at `pages/channel.rs:87`
reports a `ParamsMap` memo read outside a reactive tracking context; the page functions, but it may mean
navigation between channels does not re-run that read.

**Governed paths changed:** `crates/nostr-bbs-forum-client/src/utils/reconcile.rs` (new),
`src/utils/mod.rs`, `src/pages/channel.rs`, `src/stores/channels.rs`.
Receipt: [`adr-090-092-client.json`](../../estate-closeout/2026-09-05/adr-090-092-client.json).
