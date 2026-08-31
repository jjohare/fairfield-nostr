---
id: ADR-2006
title: Run trust demotion time-driven on the cron trigger with hysteresis; never auto-demote TL3
date: 2026-08-31
decision_status: accepted
implementation_status: complete
activation_status: live
supersedes: []
superseded_by: []
verified_commit: 7795af5
owner: jjohare
review_trigger: a demotion-latency complaint, or a requirement to demote in real time on the admission path
repo: nostr-rust-forum
domain: IDENTITY-keys-and-trust.md
lineage: distils legacy ADR-102 (inactivity-decay demotion sweep) and the TL0–TL3 ladder of ADR-100
---

# ADR-2006 — Run trust demotion time-driven on the cron trigger with hysteresis; never auto-demote TL3

## Context

Promotion up the TL0–TL3 ladder is driven by activity tallied at EOSE on the hot path.
Demotion is the mirror question, and the obvious symmetry is to also evaluate it inline
when a member acts. But `check_demotion`'s precondition is ~6 months of **inactivity** —
firing it on a request evaluates it precisely against active users, the opposite of its
gate — and TL3 is an administrative grant, not an earned level.

## Decision

Demotion is **time-driven and runs only on the scheduled (cron) trigger**, alongside the
profile-backfill sweep, never inline on admission. It applies **hysteresis** (TL2 demotes
at 90% of the promotion threshold combined with ~6-month inactivity), steps one level per
qualifying sweep with TL0 as a hard floor, and **never auto-demotes TL3** (admin-granted
levels and exempt rows are untouchable by the sweep). Promotion stays on the EOSE read
tally; demotion stays on the cron sweep.

## Consequences

- Forecloses inline/real-time demotion: putting `check_demotion` on the hot path would fire
  it against active users and add a write to admission latency (Invariant: demotion stays
  off the hot path).
- Demotion is only as fresh as the cron cadence — a member inactive past the gate keeps
  their level until the next sweep; acceptable given the ~6-month timescale.
- TL3 can only ever be revoked by an admin action, by design; an operator wanting automatic
  TL3 decay would have to override this decision explicitly.

## Verification

- Demotion sweep lives on the cron trigger, with the "would fire on active users" rationale:
  `crates/nostr-bbs-relay-worker/src/cron.rs:264-282`.
- Ladder, hysteresis and "TL3 never auto-demoted": `crates/nostr-bbs-relay-worker/src/trust.rs:9-10,26-35`;
  promotion never computes/modifies TL3: `trust.rs:165,200-202`.
- Established at `verified_commit` 7795af5 (`git rev-parse --short HEAD`).
