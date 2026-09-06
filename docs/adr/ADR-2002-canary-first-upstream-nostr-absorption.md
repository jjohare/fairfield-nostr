---
id: ADR-2002
title: Absorb upstream `nostr` canary-first — keep hand-rolled core until Shape A is proven
date: 2026-08-31
decision_status: accepted
implementation_status: partial
activation_status: staged
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: the canary records a verdict (Shape A pass / Shape C fail) on the wasm32 build matrix
repo: nostr-rust-forum
domain: BASELINE-architecture.md
lineage: distils legacy upstream ADR-076 (absorption, still "Proposed") and the pod-mesh ADR-093; supersedes ADR-076 D5's implicit "just swap the dependency" reading
---

# ADR-2002 — Absorb upstream `nostr` canary-first — keep hand-rolled core until Shape A is proven

## Context

The workspace already depends on upstream `nostr = "0.44.7"` with `nip04/44/59/98`
flags enabled. The tempting move is to delete `nostr-bbs-core`'s hand-rolled crypto
(`nip04.rs`, `nip44.rs`, `nip98.rs`, `gift_wrap.rs`, `keys.rs`, `signer.rs`) now that a
maintained upstream exists. But the binaries target `wasm32-unknown-unknown` on
Cloudflare Workers, and upstream has never been proven on that matrix here.

## Decision

Absorption is gated on empirical proof, not on the dependency being present. A
dedicated `nostr-bbs-upstream-canary` crate — **not linked into any binary** — must
compile and pass its NIP-44 known-answer smokes on the `wasm32` matrix and record
**Shape A (full absorption)** before any `nostr-bbs-core` crypto module is deleted; a
FAIL records **Shape C (patch-in-place)**. Until that verdict lands, `nostr-bbs-core`
remains the sole authority for on-`wasm32` Schnorr, and enabling upstream NIP flags
retires nothing by itself.

## Consequences

- Forecloses the fast path (swap-and-delete): a competent engineer could have deleted
  the hand-roll the moment the dependency resolved; this forbids it until proven.
- Two Schnorr implementations coexist (upstream dependency compiled + hand-roll linked),
  paying duplicate build cost and a standing "which is authoritative" question — answered
  by Invariant 1 of the living doc.
- Absorption is durably in-flight: the deferral itself constrains every crypto change,
  which must still land in `nostr-bbs-core`, not upstream.

## Verification

- Canary is a workspace member and unlinked: `Cargo.toml:34-37`;
  `crates/nostr-bbs-upstream-canary/src/lib.rs:1-30` (PASS→Shape A, FAIL→Shape C).
- Zero core modules deleted — hand-rolled crypto still present and linked:
  `crates/nostr-bbs-core/src/` (`nip44.rs`, `gift_wrap.rs`, `keys.rs`, `signer.rs`).
- Upstream dependency with NIP flags: `Cargo.toml` `[workspace.dependencies] nostr`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).

## Closeout extension — 2026-09-04

Work packages: CP-01/04/08. Accountable owner: the existing owner above, with forum release/identity maintainers for cross-service acceptance. Historical verification and activation declarations are preserved; this review does not re-certify a live deployment.

The canary remains separate from the linked hand-rolled crypto. CI declares native workspace tests and a WASM cargo check; this pass does not establish WASM execution or an absorption verdict.

**Acceptance condition:** Record target, toolchain, features, dependency lock and executed known-answer receipts before Shape A. Separate compile success from runtime success and document each module replacement with rollback and consumer parity.

Dependencies: CP-01 release identity and the relevant identity, governance and recovery journeys. Reopen when the governed source, dependency, deployment profile or consumer contract changes. See the [estate forum review](../../../VisionFlow/docs/estate-review/forum-decisions.md) and [current source/test receipt](../../../VisionFlow/docs/estate-review/evidence/forum-closeout-snapshot.json).
