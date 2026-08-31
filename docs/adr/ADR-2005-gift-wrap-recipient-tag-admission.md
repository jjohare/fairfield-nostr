---
id: ADR-2005
title: Admit gift-wraps on the recipient `p` tag, whitelist-gated, never on the ephemeral author
date: 2026-08-31
decision_status: accepted
implementation_status: complete
activation_status: live
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: a requirement to deliver gift-wraps to non-members (e.g. invite DMs to outsiders)
repo: nostr-rust-forum
domain: IDENTITY-keys-and-trust.md
lineage: distils legacy ADR-104 (gift-wrap recipient admission); cross-refs the relay admission model in BASELINE-architecture.md
---

# ADR-2005 — Admit gift-wraps on the recipient `p` tag, whitelist-gated, never on the ephemeral author

## Context

NIP-17/59 gift-wraps (kind 1059) are signed by a fresh ephemeral key per message, so the
author is intentionally not a member. The relay's standard author-membership gate would
therefore reject every DM. The relay must decide admission on some principal other than
the author.

## Decision

Gift-wrap admission keys on the **recipient** carried in the first `["p", <hex>]` tag, and
accepts only if that recipient is a whitelisted member — the ephemeral author is never used
for the decision. Gift-wraps are consequently **excluded from ban-gating** (which covers
user-authored content kinds), because the recipient-whitelist gate already bounds them to
messages addressed to existing members. Recipient extraction is a pure function over the
event so the routing decision is unit-testable without a D1 lookup.

## Consequences

- Forecloses author-based admission and open relay of gift-wraps: keying on the ephemeral
  author would either reject all DMs or, if inverted, admit spam to anyone (Invariant on
  recipient-gating).
- Non-members can never receive gift-wrapped DMs through this relay — an invite-to-outsider
  DM flow would need an explicit exception to this gate, not an incremental tweak.
- Ban-gating deliberately does not cover kind 1059; a future reviewer must not "fix" that
  omission, as the recipient gate is the intended bound.

## Verification

- Recipient extracted from first `p` tag, not author: `crates/nostr-bbs-relay-worker/src/relay_do/nip_handlers.rs:103-110`.
- Whitelist-gated admission: `nip_handlers.rs:510-518`.
- Gift-wraps excluded from ban-gating: `nip_handlers.rs:58-64`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).
