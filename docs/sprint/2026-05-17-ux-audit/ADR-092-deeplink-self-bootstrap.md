# ADR-092 — Deep-link entry must self-bootstrap

**Date:** 2026-05-17
**Status:** Accepted

## Context
A direct `GET /community/chat/<id>` shows "0 messages · 0 members" while the same channel entered via click-from-hub renders 3 real messages. `ChannelPage` (`pages/channel.rs`) is a **passive** consumer of `ChannelStore.channel_messages`; the kind-42 subscription lives in App-root `start_msg_sync` triggered after the kind-40 channel-list EOSE. On direct deep-link, when the page mounts the resolver maps (`by_id` / `by_name` / `by_section`) are still empty, so any kind-42 events whose `e` tag points to the requested channel get dropped.

Same architectural cause underlies the persistent "Loading…" h1 (channel_info filtered by id-only never matches slug-based URLs).

## Decision
Add `ChannelStore::ensure_subscribed(cid_or_slug)` — idempotent — called from `ChannelPage::on_mount`:

1. Await `start_sync` EOSE (kind-40 channel list).
2. Resolve `cid_or_slug` to a concrete `cid` via `by_id`/`by_name`/`by_section`. Block until first resolution OR a timeout (~4 s) elapses.
3. Open a narrow kind-42 subscription `#e: [cid]` (complementary to the broad one — relay handles duplicate REQs).
4. Mark this cid as "subscribed" in a set so the second call is a no-op.

Header h1 derivation moves to a `Memo` that re-runs when either `channels` or `channel_info` changes:
```rust
let title = Memo::new(move |_| {
    channel_info.get().map(|c| c.name)
        .or_else(|| store.channels.with(|ch| ch.iter().find(|c| matches(c, &cid)).map(|c| c.name.clone())))
        .unwrap_or_else(|| "Loading…".into())
});
```

## Consequences
- Direct deep-link parity with click-nav. Eliminates Bugs #8, #9, #16.
- Slight increase in relay subscriptions on multi-tab use; relay-worker DO already handles dedup.
- Future principle: **any page reachable by URL must boot its own data**; do not rely on side-effects from a sibling page that may never have mounted.

## Closeout extension — 2026-09-05

Accepted design status is preserved; current implementation and deployment acceptance remain qualified. The page replaced its ensure_subscribed Effect with kind-40 discovery and narrow replay, with subscription cleanup. That replay omits the tombstone check used by the broad store subscription. The current loading fallback is eight seconds, not a successful-bootstrap receipt.

**CP-01/06/08/09:** Amend the current bootstrap design, apply consistent deletion semantics and verify cold ID/slug entry, late metadata, reconnect and rapid navigation with visible failures.

See the [current source-to-consumer assessment](../../../../VisionFlow/docs/estate-review/forum-decisions.md#forum-navigation-counts-and-cold-entry) and [source hashes](../../../../VisionFlow/docs/estate-review/evidence/forum-sprint-snapshot.json). No browser, relay or service-worker test ran in this pass. Frozen archive stubs are unchanged.

## Acceptance progress — 2026-09-05

**Implemented.** Two defects closed. The deep-link replay path now applies the same **tombstone check** the
normal path applies, so a deleted event can no longer be replayed into view by following a deep link.

And bootstrap success is no longer a clock. The eight-second timer fallback is replaced by
`crates/nostr-bbs-forum-client/src/utils/bootstrap.rs`, which derives the phase from what the page has
actually observed, in a deliberate order: an **observed success beats the deadline**, so a late but genuine
answer still resolves to `Ready` rather than being frozen into a failure; a **definitive negative** — the
relay does not have this channel — is an answer, not a timeout, and is reported without waiting; only then
does the deadline apply, attributed to the furthest stage the bootstrap actually reached; otherwise the
pending stage is what the spinner names. The bounded timeout survives purely as a **failure** path with named
`BootstrapFailure` variants, so it can no longer masquerade as success.

**Tests and results.** 16 tests in `utils::bootstrap`. `cargo test -p nostr-bbs-forum-client` — 329 passed,
0 failed. `cargo test --workspace` — 1823 passed. `trunk build` — exit 0.

**Browser receipts.** Verified end-to-end in Chrome (sidecar) against a local `wrangler dev` relay holding no
such channel. A cold, authenticated deep link to `/chat/<unknown id>` renders **"Channel could not be loaded —
This channel is not on the relay. It may have been removed, or the link may be wrong."** while the connection
indicator reads `Connected`. That is a true terminal state reached from a definitive negative, not from a
clock: under the previous implementation the same entry resolved as a success once the eight-second timer
elapsed. Screenshot `adr-092-bootstrap-failed-state.png`; full evidence in
[`browser-run.json`](../../estate-closeout/2026-09-05/browser-run.json).

**Remaining.** The *success* receipt (a deep link to a channel the relay does hold, resolving via observed
EOSE) was not browser-exercised, because seeding a channel needs event signing. The tombstone branch of the
replay path is likewise covered by unit tests only, for the same reason.

**Governed paths changed:** `crates/nostr-bbs-forum-client/src/utils/bootstrap.rs` (new),
`src/utils/mod.rs`, `src/pages/channel.rs`.
Receipt: [`adr-090-092-client.json`](../../estate-closeout/2026-09-05/adr-090-092-client.json).
