---
id: ADR-2003
title: Derive purpose-scoped subkeys with raw HMAC-SHA256, not HKDF, for byte-for-byte JS parity
date: 2026-08-31
decision_status: accepted
implementation_status: complete
activation_status: live
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: any change to the agentbox JS mirror-key derivation, or a move to per-subkey compromise isolation
repo: nostr-rust-forum
domain: IDENTITY-keys-and-trust.md
lineage: distils legacy ADR-094 (deterministic subkey derivation) and the ADR-100 key-lifecycle rotation model
---

# ADR-2003 — Derive purpose-scoped subkeys with raw HMAC-SHA256, not HKDF, for byte-for-byte JS parity

## Context

`derive_subkey(root, tag)` produces a purpose-scoped child secret shared across the
Rust forum and agentbox's JavaScript. HKDF-SHA256 (Extract+Expand) is the textbook
choice and is already used by the sibling `derive_from_prf`. But agentbox's mirror-key
derivation is a single `crypto.createHmac('sha256', root).update(tag).digest()`.

## Decision

`derive_subkey` is a single raw **HMAC-SHA-256** keyed by the root's 32 secret bytes with
the UTF-8 tag as the message — deliberately **not** HKDF, with no Extract/Expand step —
so the Rust output equals the JS output byte-for-byte for a given `(root, tag)`. This
cross-stack equality is the contract; the construction may not be "upgraded" to HKDF
without forking every derived identity on both stacks. Rotation is by tag suffix
(`-v1`→`-v2`), and the accepted, documented cost is that a derived subkey is
**recoverable from the root** — domain separation, not compromise isolation.

## Consequences

- Forecloses HKDF and any keyed-hash variant: the "more correct" KDF would silently
  diverge from the JS mirror, breaking the shared-identity guarantee.
- A leaked root exposes every child; no design may assume a compromised subkey is
  contained — root rotation is the only boundary (ties Invariant 6).
- Binds a Rust security primitive to an external JS implementation's exact bytes, pinned
  by a known-answer JS-parity test that must never be deleted.

## Verification

- Raw HMAC construction, explicitly "not HKDF": `crates/nostr-bbs-core/src/keys.rs:251-256`.
- Root-recoverability disclaimer is load-bearing doc: `keys.rs:238-243`.
- Distinct from the HKDF `derive_from_prf`: `keys.rs:196-205`.
- JS-parity known-answer vector guards it: `keys.rs:478-486`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).
