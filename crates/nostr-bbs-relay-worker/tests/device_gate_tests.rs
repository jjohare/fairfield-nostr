//! ADR-2004 acceptance — the relay worker's half of the dual-worker device-key
//! feature gate, and the mismatched-worker postures.
//!
//! ADR-2004 (Decision):
//!
//! > The whole feature is **default-off** behind a single Worker var
//! > `DEVICE_KEYS_ENABLED`, enabled only on the **exact** string `"true"` (any
//! > unset/empty/other value → off), and the identical exact-match gate is
//! > duplicated **independently in both the auth worker and the relay worker**
//! > rather than shared. […] With the gate off, a known device→owner mapping is
//! > ignored and the author key is used as-is.
//!
//! The relay's gate is `NostrRelayDO::device_keys_enabled()`, which is
//! `Env`-bound; it takes its decision in the pure seam
//! [`device_keys_enabled_var`], exercised here together with
//! [`effective_principal`] — the attribution-rewrite the gate actually guards.
//!
//! Run with: `cargo test -p nostr-bbs-relay-worker --features test-exports`.

#![cfg(feature = "test-exports")]

use nostr_bbs_core::feature_gate::{
    device_keys_enabled as core_device_keys_enabled, DeviceGatePosture, DualWorkerGate,
    DEVICE_KEYS_ENABLED_VAR,
};
use nostr_bbs_relay_worker::test_exports::{device_keys_enabled_var, effective_principal};

fn device() -> String {
    "d".repeat(64)
}

fn owner() -> String {
    "0".repeat(64)
}

// ---------------------------------------------------------------------------
// The variant matrix: input → enabled?
// ---------------------------------------------------------------------------

/// Every variant ADR-2004 acceptance calls for (unset / "false" / "TRUE" /
/// "true") plus the other realistic spellings a deployment might carry.
/// Exact match only; default-off.
#[test]
fn gate_variant_matrix_relay_worker() {
    let cases: &[(Option<&str>, bool)] = &[
        (None, false),          // unset — the default deployment
        (Some("true"), true),   // the ONLY enabling value
        (Some("false"), false), // stock wrangler.toml value
        (Some("TRUE"), false),  // case variants do NOT enable
        (Some("True"), false),
        (Some("False"), false),
        (Some(""), false),  // present but empty
        (Some("0"), false), // truthy aliases do NOT enable
        (Some("1"), false),
        (Some("yes"), false),
        (Some("no"), false),
        (Some(" true "), false), // whitespace is NOT trimmed
        (Some("true "), false),
        (Some(" true"), false),
        (Some("\ttrue\n"), false),
        (Some("\"true\""), false),
        (Some("enabled"), false),
    ];
    for (raw, expected) in cases {
        assert_eq!(
            device_keys_enabled_var(*raw),
            *expected,
            "DEVICE_KEYS_ENABLED={raw:?} should be enabled={expected}"
        );
    }
}

#[test]
fn gate_defaults_off_when_unset_or_unparseable() {
    assert!(!device_keys_enabled_var(None));
    assert!(!device_keys_enabled_var(Some("")));
    assert!(!device_keys_enabled_var(Some("not-a-bool")));
}

/// The relay does not re-implement the rule; it delegates to the single shared
/// parser, which is what makes ADR-2004's "kept in lockstep" obligation a
/// compile-time fact rather than a review convention.
#[test]
fn gate_delegates_to_the_shared_parser() {
    for raw in [
        None,
        Some("true"),
        Some("TRUE"),
        Some("false"),
        Some(""),
        Some("1"),
        Some(" true "),
    ] {
        assert_eq!(device_keys_enabled_var(raw), core_device_keys_enabled(raw));
    }
}

#[test]
fn gate_reads_the_documented_binding_name() {
    assert_eq!(DEVICE_KEYS_ENABLED_VAR, "DEVICE_KEYS_ENABLED");
}

// ---------------------------------------------------------------------------
// End-to-end through the behaviour the gate guards
// ---------------------------------------------------------------------------

/// ADR-2004: "With the gate off, a known device→owner mapping is ignored and the
/// author key is used as-is." Asserted through the real resolution function for
/// every non-enabling variant, with a live (non-revoked) mapping present.
#[test]
fn every_non_enabling_variant_ignores_a_live_mapping() {
    for raw in [
        None,
        Some(""),
        Some("false"),
        Some("False"),
        Some("TRUE"),
        Some("True"),
        Some("0"),
        Some("1"),
        Some("yes"),
        Some(" true "),
    ] {
        let enabled = device_keys_enabled_var(raw);
        assert_eq!(
            effective_principal(&device(), Some(&owner()), enabled),
            device(),
            "DEVICE_KEYS_ENABLED={raw:?} must leave attribution untouched"
        );
    }
}

/// The single enabling variant, and only it, rebinds the device onto its owner.
#[test]
fn exact_true_rebinds_device_to_owner() {
    let enabled = device_keys_enabled_var(Some("true"));
    assert!(enabled);
    assert_eq!(
        effective_principal(&device(), Some(&owner()), enabled),
        owner()
    );
    // Gate on but no live row (unknown or revoked device) ⇒ still passthrough.
    assert_eq!(effective_principal(&device(), None, enabled), device());
}

// ---------------------------------------------------------------------------
// Mismatched workers
// ---------------------------------------------------------------------------

/// ADR-2004 (Decision + Consequences): the gate "is duplicated **independently
/// in both the auth worker and the relay worker** rather than shared […]
/// Duplicated gate logic in two crates must be kept in lockstep; a fix to one
/// must be mirrored, the accepted cost of not sharing a helper across worker
/// boundaries."
///
/// Worker A (auth) enabled, worker B (relay) not: registration and revocation
/// are live, but the relay ignores the registry, so the device never gains the
/// owner's scope and its events are judged as an ordinary unknown pubkey — it
/// is not on the whitelist, so the write gate denies it. The system **fails
/// closed**; no attribution is silently rewritten.
#[test]
fn mismatch_auth_enabled_relay_disabled_fails_closed() {
    let gate = DualWorkerGate::from_vars(Some("true"), Some("false"));

    assert!(!gate.is_lockstep());
    assert_eq!(gate.posture(), DeviceGatePosture::AuthOnlyFailsClosed);
    assert!(gate.registration_available());
    assert!(gate.revocation_available());
    assert!(!gate.attribution_rewriting_active());

    // The load-bearing assertion: with the relay half off, a fully registered,
    // non-revoked device resolves to ITSELF, not to its owner.
    assert_eq!(
        effective_principal(
            &device(),
            Some(&owner()),
            gate.attribution_rewriting_active()
        ),
        device(),
        "relay gate off ⇒ mapping ignored, author key used as-is"
    );
    assert!(!gate.device_acts_as_owner());
}

/// The inverse mismatch — worker B (relay) enabled, worker A (auth) not — is the
/// one lockstep exists to prevent: the relay honours `device_keys` rows that are
/// already present (attribution rewriting is live), while the auth worker 404s
/// `register`, `list` **and `revoke`**, so an existing device mapping cannot be
/// withdrawn through the API. This half fails **open** on revocation.
#[test]
fn mismatch_relay_enabled_auth_disabled_is_unrevocable() {
    let gate = DualWorkerGate::from_vars(Some("false"), Some("true"));

    assert!(!gate.is_lockstep());
    assert_eq!(gate.posture(), DeviceGatePosture::RelayOnlyUnrevocable);
    assert!(!gate.registration_available());
    assert!(
        !gate.revocation_available(),
        "revoke shares the auth-worker gate; with it off the owner has no API \
         route to withdraw a mapping the relay is still honouring"
    );
    assert!(gate.attribution_rewriting_active());

    // A pre-existing live mapping IS honoured here…
    assert_eq!(
        effective_principal(
            &device(),
            Some(&owner()),
            gate.attribution_rewriting_active()
        ),
        owner()
    );
    // …and the only remaining way to stop it is a direct D1 write, since the
    // revoke endpoint is gated off. The relay's own filter (`revoked = 0`)
    // still holds: a row flipped by hand surfaces as `None` and passes through.
    assert_eq!(effective_principal(&device(), None, true), device());
}

/// A mismatch in *spelling* is a mismatch in *meaning*: `true` on one worker and
/// `TRUE` on the other is the fail-closed posture, never the enabled one.
#[test]
fn spelling_mismatch_between_workers_collapses_to_fail_closed() {
    let gate = DualWorkerGate::from_vars(Some("true"), Some("TRUE"));
    assert_eq!(gate.posture(), DeviceGatePosture::AuthOnlyFailsClosed);
    assert!(!gate.device_acts_as_owner());
    assert_eq!(
        effective_principal(
            &device(),
            Some(&owner()),
            gate.attribution_rewriting_active()
        ),
        device()
    );
}

/// Both workers agreeing — the two lockstep postures, including the default
/// every stock deployment ships (`DEVICE_KEYS_ENABLED = "false"` in both
/// `wrangler.toml` files).
#[test]
fn lockstep_postures_off_and_on() {
    let stock = DualWorkerGate::from_vars(Some("false"), Some("false"));
    assert_eq!(stock.posture(), DeviceGatePosture::Off);
    assert!(stock.is_lockstep());
    assert_eq!(
        effective_principal(
            &device(),
            Some(&owner()),
            stock.attribution_rewriting_active()
        ),
        device()
    );

    let unset = DualWorkerGate::from_vars(None, None);
    assert_eq!(unset.posture(), DeviceGatePosture::Off);
    assert!(!unset.device_acts_as_owner());

    let on = DualWorkerGate::from_vars(Some("true"), Some("true"));
    assert_eq!(on.posture(), DeviceGatePosture::On);
    assert!(on.is_lockstep());
    assert_eq!(
        effective_principal(&device(), Some(&owner()), on.attribution_rewriting_active()),
        owner()
    );
}
