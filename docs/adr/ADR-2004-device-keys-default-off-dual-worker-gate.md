---
id: ADR-2004
title: Gate revocable device keys default-off behind exact `DEVICE_KEYS_ENABLED == "true"`, checked in both workers
date: 2026-08-31
decision_status: accepted
implementation_status: complete
activation_status: live
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: DEVICE_KEYS_ENABLED flipped on in a real deployment, or ADR-099 phase-2 multi-device DM scheduled
repo: nostr-rust-forum
domain: IDENTITY-keys-and-trust.md
lineage: distils legacy ADR-099 (revocable device keys) and ADR-100 (key lifecycle); relies on ADR-2003's derivation
---

# ADR-2004 — Gate revocable device keys default-off behind exact `DEVICE_KEYS_ENABLED == "true"`, checked in both workers

## Context

Revocable device keys let a device onboard without the master key, and revocation must
be honoured at NIP-42 AUTH time. This adds an attribution-rewriting surface (device→owner
remap) to the hot admission path. The registry could live in the auth worker's D1 next to
NIP-05 reservations; the gate could be a truthy check; it could default on.

## Decision

The whole feature is **default-off** behind a single Worker var `DEVICE_KEYS_ENABLED`,
enabled only on the **exact** string `"true"` (any unset/empty/other value → off), and the
identical exact-match gate is duplicated **independently in both the auth worker and the
relay worker** rather than shared. The `device_keys` row lives in the **relay worker's
D1** (`RELAY_DB`), not the auth worker's, so the relay DO reads the registry at AUTH with
no cross-worker round-trip. With the gate off, a known device→owner mapping is ignored and
the author key is used as-is.

## Consequences

- Forecloses "enabled by default" and any loose/truthy parse: a looser check widens the
  auth surface (Invariant 3); a default-on rollout would rewrite attribution silently.
- The device story (ADR-099/100) is dormant in every default deployment — revocation has
  no effect until the var is set, which is the intended safe posture.
- Duplicated gate logic in two crates must be kept in lockstep; a fix to one must be
  mirrored, the accepted cost of not sharing a helper across worker boundaries.
- Splitting the registry into `RELAY_DB` couples device-key schema ownership to the relay
  worker, away from the auth worker that mints identities.

## Verification

- Exact `"true"`, default-off, auth worker: `crates/nostr-bbs-auth-worker/src/devices.rs:88-96`.
- Independent gate, relay worker: `crates/nostr-bbs-relay-worker/src/relay_do/nip_handlers.rs:1626-1665`;
  off-path ignores mapping at `nip_handlers.rs:531,3010`.
- Row in relay D1 with `revoked` flag: `devices.rs:81-110`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).
