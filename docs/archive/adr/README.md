# ARCHIVED — ADR (nostr-rust-forum)

**Frozen:** 2026-08-31. **Do not add or edit records here.**

These ADR records (086–109) drifted from the code and were retired in the archive
cut of 2026-08-31. They are kept read-only for history and to resolve inbound
cross-references. `_legacy-index.md` is the frozen pre-cut register index.

The living decision surface is **`docs/`**:
- Architecture baseline ........... docs/BASELINE-architecture.md
- Identity, keys & trust .......... docs/IDENTITY-keys-and-trust.md
- New ADR ledger .................. docs/adr/

**How the archive maps to the living docs:**

| Archived ADRs | Now governed by |
|---|---|
| 086, 087, 088, 089, 093, 096, 103 | `docs/BASELINE-architecture.md` |
| 090, 091, 092, 105, 106, 107, 108, 109 | `docs/BASELINE-architecture.md` (Client surfaces) |
| 094, 095, 097, 098, 099, 100, 101, 102, 104 | `docs/IDENTITY-keys-and-trust.md` |

New decisions go in `docs/adr/` using `docs/adr/TEMPLATE.md`. The consolidation
itself is recorded at `docs/adr/ADR-2001-corpus-consolidation.md`.

Note: ADRs 090/091/092 also have canonical full text under
`docs/sprint/2026-05-17-ux-audit/` (cited directly by client code from that
location); those sprint copies are unchanged.
