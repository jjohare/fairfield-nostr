---
id: ADR-2007
title: Pin `solid-pod-rs` to an exact version and publish the kit on a single `1.0.0-beta.N` channel
date: 2026-08-31
decision_status: accepted
implementation_status: complete
activation_status: live
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: the next kit release, or a `solid-pod-rs` alpha bump requiring the exact pin to move
repo: nostr-rust-forum
domain: BASELINE-architecture.md
lineage: distils legacy ADR-103 (kit semver publish/yank policy)
---

# ADR-2007 — Pin `solid-pod-rs` to an exact version and publish the kit on a single `1.0.0-beta.N` channel

## Context

The `nostr-bbs-*` crates are the publishable kit surface and depend on the fast-moving,
pre-1.0 `solid-pod-rs`, which the ACL absorption re-exports directly. A caret range
(`0.5.0-alpha.7`) would let `cargo update` pull a newer published alpha at resolve time,
silently changing the WAC evaluation the pod worker relies on. The internal crates likewise
need one coherent version story across the workspace.

## Decision

`solid-pod-rs` is an **exact** pin — `=0.5.0-alpha.7`, `default-features = false`,
`features = ["core"]` — so no resolve can substitute a different published alpha; the pin
moves only by a deliberate edit. All internal `nostr-bbs-*` path deps carry one lockstep
version (`1.0.0-beta.9`) on the single beta publish channel, and the kit caps ACL JSON-LD
stricter than upstream (64 KiB vs upstream's 1 MiB). The published-registry version is
reconciled to the in-tree version as part of each release.

## Consequences

- Forecloses caret/range dependency on `solid-pod-rs`: the convenience of auto-picking
  patch alphas is traded away to keep WAC semantics frozen (Invariant: exact `=` pin).
- Every `solid-pod-rs` uptake is a manual, reviewable bump — more release friction, no
  surprise upgrades.
- A standing reconciliation debt exists: the in-tree beta (`1.0.0-beta.9`) has outrun the
  stale "published as 1.0.0-beta.3" comment, which must be squared before the next publish.

## Verification

- Exact pin with trimmed features: `Cargo.toml:155` (and the publish-order note at `:149-151`).
- Lockstep internal versions on the beta channel: `Cargo.toml:158-162`;
  in-tree crate version `1.0.0-beta.9`: `crates/nostr-bbs-core/Cargo.toml:3`.
- Stale published-version comment (reconciliation debt): `Cargo.toml:157`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).

## Closeout extension — 2026-09-04

Work packages: CP-01/04/08. Accountable owner: the existing owner above, with forum release/identity maintainers for cross-service acceptance. Historical verification and activation declarations are preserved; this review does not re-certify a live deployment.

Cargo.toml has the exact =0.5.0-alpha.7 core-only pin. Other estate consumers use different pod revisions; shared naming does not establish equal WAC behaviour.

**Acceptance condition:** Publish a resolved dependency/features manifest, registry/artifact receipt and consumer compatibility checks. Include malformed/missing ACL, sidecar and cache visibility tests on this consumed version; a newer sibling server test cannot certify this build.

Dependencies: CP-01 release identity and the relevant identity, governance and recovery journeys. Reopen when the governed source, dependency, deployment profile or consumer contract changes. See the [estate forum review](../../../VisionFlow/docs/estate-review/forum-decisions.md) and [current source/test receipt](../../../VisionFlow/docs/estate-review/evidence/forum-closeout-snapshot.json).
