# Forum historical ADR closeout map

This companion leaves the frozen archive unchanged. Routing follows its [consolidation map](archive/adr/README.md) and [ADR-2001](adr/ADR-2001-corpus-consolidation.md). Each row identifies current responsibility and an acceptance task; it does not certify the historical implementation. Repository maintainers own disposition, with the named estate work-package roles for cross-service evidence.

Archived 090–092 contain relative canonical links that no longer resolve after the archive move. The explicit sprint links below provide the current route without rewriting frozen text. All three sprint documents remain visible in estate scope.

| Historical record | Current governing document | Closeout requirement |
|---|---|---|
| [ADR-086-nip05-pod-federation](archive/adr/ADR-086-nip05-pod-federation.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-01/04/08: demonstrate authoritative discovery and fallback across both pod tiers. |
| [ADR-087-cf-workers-portable-cores](archive/adr/ADR-087-cf-workers-portable-cores.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-01/04/08: resolve portable-core ownership and prove the selected WASM surface; historical deferral remains open. |
| [ADR-088-wac-turtle-serializer-quirk](archive/adr/ADR-088-wac-turtle-serializer-quirk.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-04: establish whether Turtle round-tripping is consumed before choosing a serializer remedy. |
| [ADR-089-git-pods-cf-workers-limitation](archive/adr/ADR-089-git-pods-cf-workers-limitation.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-04/08: retain the recorded ADR-093 supersession; prove native-tier restore and routing separately from CF constraints. |
| [ADR-090-forum-base-path-discipline](archive/adr/ADR-090-forum-base-path-discipline.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-06: verify direct and nested routes under the actual deployment base. [Sprint canonical](sprint/2026-05-17-ux-audit/ADR-090-forum-base-path-discipline.md). |
| [ADR-091-channel-counts-derived-from-events](archive/adr/ADR-091-channel-counts-derived-from-events.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-06: verify counts after event replacement, deletion and reconnect. [Sprint canonical](sprint/2026-05-17-ux-audit/ADR-091-channel-counts-derived-from-events.md). |
| [ADR-092-deeplink-self-bootstrap](archive/adr/ADR-092-deeplink-self-bootstrap.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-06: verify cold deep-link entry without prior navigation state. [Sprint canonical](sprint/2026-05-17-ux-audit/ADR-092-deeplink-self-bootstrap.md). |
| [ADR-093-native-pod-mesh](archive/adr/ADR-093-native-pod-mesh.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-04/08: test discovery, authentication, fallback and restoration across native and CF tiers. |
| [ADR-094-deterministic-subkey-derivation](archive/adr/ADR-094-deterministic-subkey-derivation.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04: ADR-2003; execute current Rust and JS against a common identity vector set. |
| [ADR-095-recovery-device-onboarding-sheet](archive/adr/ADR-095-recovery-device-onboarding-sheet.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04/06: exercise recovery-sheet generation, storage and recovery without retaining unintended credentials. |
| [ADR-096-acl-container-resolution-and-delegation](archive/adr/ADR-096-acl-container-resolution-and-delegation.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-04: ADR-2009; test sidecar control, delegation and malformed-policy handling on the consumed version. |
| [ADR-097-agent-identity-provisioning](archive/adr/ADR-097-agent-identity-provisioning.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04/05: verify membership/registry atomicity and idempotent provisioning; a same-worker boundary alone is not a transaction receipt. |
| [ADR-098-connect-magic-link-onboarding](archive/adr/ADR-098-connect-magic-link-onboarding.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04/06: exercise connect-link consumption, browser history/storage and recovery boundaries. |
| [ADR-099-revocable-device-keys](archive/adr/ADR-099-revocable-device-keys.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04: ADR-2004; prove dual-worker activation and revocation, keeping deferred multi-device delivery explicit. |
| [ADR-100-key-lifecycle](archive/adr/ADR-100-key-lifecycle.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04/08: ADR-2003/2004; prove rotation, re-derivation, revocation and recovery across consumers. |
| [ADR-101-multi-device-dm-delivery](archive/adr/ADR-101-multi-device-dm-delivery.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04/06: retain multi-device DM delivery as unverified; test per-device private delivery before closing. |
| [ADR-102-trust-demotion-inactivity-sweep](archive/adr/ADR-102-trust-demotion-inactivity-sweep.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04/05/08: ADR-2006; fix or explicitly resolve pagination and committed/audit outcome gaps. |
| [ADR-103-kit-semver-publish-yank-policy](archive/adr/ADR-103-kit-semver-publish-yank-policy.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-01/08: ADR-2007; reconcile exact dependency, published kit and consumed lockfiles. |
| [ADR-104-gift-wrap-recipient-admission](archive/adr/ADR-104-gift-wrap-recipient-admission.md) | [IDENTITY-keys-and-trust.md](IDENTITY-keys-and-trust.md) | CP-04: ADR-2005; distinguish recipient admission from private read visibility and delivery. |
| [ADR-105-bbs-door-games-and-write-architecture](archive/adr/ADR-105-bbs-door-games-and-write-architecture.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-04/06: ADR-2008 records signer divergence; verify each custody backend and interactive write path. |
| [ADR-106-gap-close-forum-governance-surfaces](archive/adr/ADR-106-gap-close-forum-governance-surfaces.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-05/08: proposed ADR-2010; demonstrate durable projection and downstream application receipts. |
| [ADR-107-zone-first-landing-and-scoped-navigation](archive/adr/ADR-107-zone-first-landing-and-scoped-navigation.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-06: exercise home-zone selection, multi-zone navigation and direct URLs. |
| [ADR-108-bbs-mobile-first-redesign](archive/adr/ADR-108-bbs-mobile-first-redesign.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-06: verify mobile interaction and accessibility by tranche; historical shipped labels do not certify the current client. |
| [ADR-109-zone-bound-bbs-pwa-install](archive/adr/ADR-109-zone-bound-bbs-pwa-install.md) | [BASELINE-architecture.md](BASELINE-architecture.md) | CP-04/06/08: verify installation, boot profile, zone binding, device forgetting and rotation in each supported browser. |

## Remaining evidence

This is complete routing coverage for the 24 frozen entries and their three sprint canonical records, not full semantic or source verification of every historical claim. In particular, provisioning transactions, private delivery, client accessibility, mobile installation and live federation need direct evidence. Current work packages are defined in the [estate roadmap](../../VisionFlow/docs/estate-review/closeout/README.md).

## Sprint consumer follow-up — 2026-09-05

The canonical 090–092 sprint records now carry current source-qualified extensions. The [consumer review](../../VisionFlow/docs/estate-review/forum-decisions.md#forum-navigation-counts-and-cold-entry) credits implemented path, deduplication and replay mechanisms while preserving displayed-deletion and cold-entry acceptance obligations. Archived stubs remain unchanged.
