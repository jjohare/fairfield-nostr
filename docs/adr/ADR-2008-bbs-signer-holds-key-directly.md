---
id: ADR-2008
title: Let the retro BBS client hold its SecretKey directly, diverging from the ADR-105 `sign()` seam
date: 2026-08-31
decision_status: accepted
implementation_status: complete
activation_status: live
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: introduction of a shared forum `sign()` seam or hardware/remote-signer support for either client
repo: nostr-rust-forum
domain: BASELINE-architecture.md
lineage: distils legacy ADR-105 §2.3 (BBS door-games/write architecture), amended 2026-07-03 to acknowledge this divergence
---

# ADR-2008 — Let the retro BBS client hold its SecretKey directly, diverging from the ADR-105 `sign()` seam

## Context

ADR-105 §2.3 decided the retro BBS client would not custody key material: it would delegate
signing to a forum `sign()` seam, keeping exactly one place that touches secrets. The
shipped M2 write path did not build that seam. This record captures the divergence honestly
rather than pretending the seam exists.

## Decision

For two of its three signer backends — same-origin local-key adoption (reads the forum's
`nostr_bbs_sk` hex from local/session storage) and the minimal in-memory paste/generate
login — `BbsSigner` **holds a `SecretKey` directly**: it parses the bytes into an in-memory
`nostr_bbs_core::SecretKey` wrapped in a `PrfSigner` and signs locally; the key is zeroized
on drop and transient buffers are scrubbed. The third backend, same-origin NIP-07 adoption,
holds **no** key material at all — it delegates every signature to the browser extension via
`window.nostr`. Adoption is same-origin only, in priority order (local key, then NIP-07, else
a baked key). For the two key-holding backends there is deliberately **no** forum `sign()`
delegation seam; the ADR-105 §2.3 decision-as-stated is not the shipped architecture, and the
living doc records the divergence as the ground truth.

## Consequences

- Forecloses the single-custody design ADR-105 intended: whenever the local-key or baked-key
  backend is active, secret material lives in two clients, so a future hardware/remote signer
  must be threaded into `BbsSigner` too, not just the forum. The NIP-07 backend is unaffected
  — it never custodies a key in either client.
- Same-origin coupling: the BBS client depends on the forum's storage key and scope; it
  cannot sign for a cross-origin or seam-brokered session.
- Honesty cost paid up front — the archive ADR-105 stays citable as intent, but this record
  and the living doc, not ADR-105 §2.3, are authoritative for what the code does.

## Verification

- `BbsSigner` state and same-origin key handling: `crates/nostr-bbs-bbs-client/src/signer.rs:56-72`.
- Parses and holds `SecretKey`, zeroized on drop: `signer.rs:34,207-210,382-384`.
- Same-origin adoption paths (no `sign()` seam): `signer.rs:250-257,305-327`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).
