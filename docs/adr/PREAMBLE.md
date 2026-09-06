**How to work against this pack** (engineering agents start here):

The ADR pack for any domain is **its living governing document in `docs/` plus the
ledger records below that amend it**. The living docs are normative — their
*Invariants* sections are the compliance surface and their *Change process*
sections say how to amend them:

| Domain | Governing document |
|---|---|
| Crate topology, upstream `nostr` absorption, pod mesh, CF Workers, ACL, NIP-05, kit publishing, clients | [`../BASELINE-architecture.md`](../BASELINE-architecture.md) |
| Key derivation, device keys, key lifecycle, agent identity, DM delivery, gift-wrap admission, trust levels | [`../IDENTITY-keys-and-trust.md`](../IDENTITY-keys-and-trust.md) |

**Lookup order:** governing doc → its `file:line` citations into code → the ledger
records below → `docs/archive/adr/` **only for rationale and history — never as
authority** (the archive is the pre-2026-08-31 corpus, ADRs 086–109, frozen
precisely because it drifted from the code; see
[`../archive/adr/README.md`](../archive/adr/README.md) for the map from legacy
numbers to the living docs).

**Making a decision:** copy [`TEMPLATE.md`](TEMPLATE.md) to `ADR-NNNN-slug.md`
(next free number), fill the three-axis status honestly, update the affected
governing document **in the same change**, and regenerate this index
(`node scripts/adr-index-gen.js docs/adr` — it fails CI on invalid frontmatter).

The [historical closeout map](../adr-history-closeout.md) resolves each frozen record to its current governing surface and remaining acceptance work. [ADR-2010](ADR-2010-durable-governance-outcome-receipts.md) is a proposed governance receipt contract; its presence in this index does not ratify it.
