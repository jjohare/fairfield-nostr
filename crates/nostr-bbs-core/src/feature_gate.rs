//! Worker feature-gate parsing — the single source of truth for how a
//! Cloudflare Worker `[vars]` string is turned into a boolean feature switch
//! (ADR-2004).
//!
//! ## Why this lives here
//!
//! ADR-2004 gates the revocable device-key feature (ADR-099/100) behind one
//! Worker var, `DEVICE_KEYS_ENABLED`, and requires the gate to be **checked
//! independently in both the auth worker and the relay worker**:
//!
//! > The whole feature is **default-off** behind a single Worker var
//! > `DEVICE_KEYS_ENABLED`, enabled only on the **exact** string `"true"` (any
//! > unset/empty/other value → off), and the identical exact-match gate is
//! > duplicated **independently in both the auth worker and the relay worker**
//! > rather than shared.
//!
//! …and it names the price of that duplication:
//!
//! > Duplicated gate logic in two crates must be kept in lockstep; a fix to one
//! > must be mirrored, the accepted cost of not sharing a helper across worker
//! > boundaries.
//!
//! The two **checks** stay independent — each worker reads its own binding and
//! decides on its own, with no cross-worker call — but the **parse rule** is
//! stated once, here, so "kept in lockstep" is a compile-time fact rather than
//! a review convention. Nothing observable changes: both workers already
//! implemented exactly `raw == "true"`, and [`device_keys_enabled`] is that
//! same predicate, made pure and testable off the Workers runtime.
//!
//! ## The rule
//!
//! Enabled **iff** the variable is present and its value is byte-for-byte
//! `"true"`. No trimming, no case folding, no truthy aliases. Everything else —
//! unset, empty, `"1"`, `"yes"`, `"TRUE"`, `" true "` — is **disabled**.
//! A looser parse would widen the NIP-42 admission surface (ADR-2004
//! Consequences, Invariant 3 of `docs/IDENTITY-keys-and-trust.md`).

/// Name of the Worker var that gates revocable device keys (ADR-2004).
///
/// Both workers read this exact binding name; using the constant keeps the
/// two lookups from drifting on the key as well as on the value.
pub const DEVICE_KEYS_ENABLED_VAR: &str = "DEVICE_KEYS_ENABLED";

/// The one and only value that enables the device-key feature (ADR-2004).
pub const DEVICE_KEYS_ENABLED_ON: &str = "true";

/// Parse the `DEVICE_KEYS_ENABLED` Worker var into the feature switch.
///
/// `raw` is the variable's value, or `None` when the binding is absent.
/// Returns `true` **only** for the exact string `"true"`; every other value,
/// and absence, yields `false` (default-off, ADR-2004).
///
/// ```
/// use nostr_bbs_core::feature_gate::device_keys_enabled;
///
/// assert!(device_keys_enabled(Some("true")));
/// assert!(!device_keys_enabled(None));          // unset  → off
/// assert!(!device_keys_enabled(Some("TRUE")));  // case   → off
/// assert!(!device_keys_enabled(Some(" true "))); // padded → off
/// assert!(!device_keys_enabled(Some("1")));     // truthy → off
/// ```
#[inline]
#[must_use]
pub fn device_keys_enabled(raw: Option<&str>) -> bool {
    raw == Some(DEVICE_KEYS_ENABLED_ON)
}

/// The combined posture of the two independently-gated workers (ADR-2004).
///
/// The gate is duplicated by design, so a deployment can end up with the two
/// halves disagreeing — a var set on one worker's `wrangler.toml` and not the
/// other, or a partial rollout. This enum names each combination and what it
/// actually does, so the mismatch cases are asserted rather than assumed.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum DeviceGatePosture {
    /// Both workers off — the default in every stock deployment. The device
    /// endpoints 404 and the relay ignores any `device_keys` row.
    Off,
    /// Both workers on — the feature is live and lockstep.
    On,
    /// Auth worker on, relay worker off. Devices can be registered, listed and
    /// revoked, but the relay never consults the registry: a device key stays
    /// an ordinary unknown pubkey and its events are denied by the write gate.
    /// **Fails closed** — no attribution is rewritten.
    AuthOnlyFailsClosed,
    /// Relay worker on, auth worker off. The relay honours any `device_keys`
    /// rows already present (attribution rewriting is live), while the auth
    /// worker 404s `register`, `list` **and `revoke`** — so an existing device
    /// mapping cannot be withdrawn through the API. **Fails open on
    /// revocation**; this is the asymmetry the lockstep requirement exists to
    /// prevent, and the posture to watch for in a partial rollout.
    RelayOnlyUnrevocable,
}

/// The device-key gate as read by the two workers that own it (ADR-2004).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct DualWorkerGate {
    /// `DEVICE_KEYS_ENABLED` as parsed by the auth worker (`devices.rs`).
    pub auth: bool,
    /// `DEVICE_KEYS_ENABLED` as parsed by the relay worker (`nip_handlers.rs`).
    pub relay: bool,
}

impl DualWorkerGate {
    /// Build the pair from the two raw Worker var values, each parsed with the
    /// single shared rule ([`device_keys_enabled`]).
    #[must_use]
    pub fn from_vars(auth_raw: Option<&str>, relay_raw: Option<&str>) -> Self {
        Self {
            auth: device_keys_enabled(auth_raw),
            relay: device_keys_enabled(relay_raw),
        }
    }

    /// Are both halves configured identically?
    #[must_use]
    pub const fn is_lockstep(&self) -> bool {
        self.auth == self.relay
    }

    /// Named posture of this configuration.
    #[must_use]
    pub const fn posture(&self) -> DeviceGatePosture {
        match (self.auth, self.relay) {
            (false, false) => DeviceGatePosture::Off,
            (true, true) => DeviceGatePosture::On,
            (true, false) => DeviceGatePosture::AuthOnlyFailsClosed,
            (false, true) => DeviceGatePosture::RelayOnlyUnrevocable,
        }
    }

    /// Can a member register a new device? Auth-worker side only — the three
    /// `/api/devices*` handlers 404 when the auth gate is off.
    #[must_use]
    pub const fn registration_available(&self) -> bool {
        self.auth
    }

    /// Can a member revoke a device through the API? Same gate as registration
    /// — which is why [`DeviceGatePosture::RelayOnlyUnrevocable`] is the
    /// dangerous half of a mismatch.
    #[must_use]
    pub const fn revocation_available(&self) -> bool {
        self.auth
    }

    /// Does the relay rewrite `device → owner` at NIP-42 AUTH / write-gate
    /// time? Relay-worker side only.
    #[must_use]
    pub const fn attribution_rewriting_active(&self) -> bool {
        self.relay
    }

    /// Does a registered, non-revoked device actually gain its owner's scope?
    /// Requires the relay half; the auth half only fills the registry.
    #[must_use]
    pub const fn device_acts_as_owner(&self) -> bool {
        self.relay
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// ADR-2004: "enabled only on the **exact** string `"true"` (any
    /// unset/empty/other value → off)". The full variant matrix, one assertion
    /// per realistic spelling an operator or CI template might emit.
    #[test]
    fn variant_matrix_is_exact_match_default_off() {
        // The only enabling value in the entire input space.
        assert!(device_keys_enabled(Some("true")), "exact \"true\" enables");

        for raw in [
            None,               // var absent from [vars] entirely
            Some(""),           // present but empty
            Some("false"),      // the stock wrangler.toml value
            Some("False"),
            Some("FALSE"),
            Some("TRUE"),       // case variants do NOT enable (exact match)
            Some("True"),
            Some("tRuE"),
            Some("0"),
            Some("1"),          // truthy aliases do NOT enable
            Some("yes"),
            Some("no"),
            Some("on"),
            Some("off"),
            Some(" true"),      // whitespace is NOT trimmed
            Some("true "),
            Some(" true "),
            Some("\ttrue\n"),
            Some("\"true\""),   // quoted (a TOML/JSON mis-escape)
            Some("true1"),
            Some("truthy"),
            Some("enabled"),
        ] {
            assert!(
                !device_keys_enabled(raw),
                "default-off violated for {raw:?}"
            );
        }
    }

    #[test]
    fn unset_is_off() {
        assert!(!device_keys_enabled(None));
    }

    #[test]
    fn stock_wrangler_value_false_is_off() {
        // Both crates ship `DEVICE_KEYS_ENABLED = "false"` in wrangler.toml.
        assert!(!device_keys_enabled(Some("false")));
    }

    #[test]
    fn uppercase_true_is_off_not_on() {
        // Deliberate: ADR-2004 forecloses "any loose/truthy parse", so the
        // case-insensitive reading is rejected even though it is the more
        // forgiving one. Off is the safe direction.
        assert!(!device_keys_enabled(Some("TRUE")));
        assert!(!device_keys_enabled(Some("True")));
    }

    /// ADR-2004: "the identical exact-match gate is duplicated **independently
    /// in both the auth worker and the relay worker** rather than shared …
    /// Duplicated gate logic in two crates must be kept in lockstep; a fix to
    /// one must be mirrored, the accepted cost of not sharing a helper across
    /// worker boundaries."
    ///
    /// The mismatched-worker cases, and what each actually does.
    #[test]
    fn mismatched_workers_have_documented_postures() {
        // Auth ON, relay OFF — registry writable, mappings ignored at AUTH.
        let a = DualWorkerGate::from_vars(Some("true"), Some("false"));
        assert_eq!(a.posture(), DeviceGatePosture::AuthOnlyFailsClosed);
        assert!(!a.is_lockstep());
        assert!(a.registration_available());
        assert!(a.revocation_available());
        assert!(!a.attribution_rewriting_active());
        // The safety property: no device ever gains the owner's scope, so the
        // half-rollout cannot silently rewrite attribution. Fails CLOSED.
        assert!(!a.device_acts_as_owner());

        // Relay ON, auth OFF — mappings honoured, but nothing can be revoked.
        let b = DualWorkerGate::from_vars(Some("false"), Some("true"));
        assert_eq!(b.posture(), DeviceGatePosture::RelayOnlyUnrevocable);
        assert!(!b.is_lockstep());
        assert!(!b.registration_available());
        assert!(
            !b.revocation_available(),
            "revoke shares the auth-worker gate: it 404s while the relay still \
             honours existing rows — the fail-open half of a mismatch"
        );
        assert!(b.attribution_rewriting_active());
        assert!(b.device_acts_as_owner());
    }

    #[test]
    fn lockstep_postures() {
        let off = DualWorkerGate::from_vars(None, None);
        assert_eq!(off.posture(), DeviceGatePosture::Off);
        assert!(off.is_lockstep());
        assert!(!off.device_acts_as_owner());
        assert!(!off.registration_available());

        let on = DualWorkerGate::from_vars(Some("true"), Some("true"));
        assert_eq!(on.posture(), DeviceGatePosture::On);
        assert!(on.is_lockstep());
        assert!(on.device_acts_as_owner());
        assert!(on.registration_available());
    }

    /// A mismatch in *spelling* is still a mismatch in *meaning*: an operator
    /// who sets `TRUE` on the relay and `true` on the auth worker gets the
    /// fail-closed posture, not the enabled one.
    #[test]
    fn spelling_mismatch_collapses_to_fail_closed() {
        let g = DualWorkerGate::from_vars(Some("true"), Some("TRUE"));
        assert_eq!(g.posture(), DeviceGatePosture::AuthOnlyFailsClosed);
        assert!(!g.device_acts_as_owner());

        // …and both mis-spelled is simply Off.
        let both = DualWorkerGate::from_vars(Some("TRUE"), Some("TRUE"));
        assert_eq!(both.posture(), DeviceGatePosture::Off);
    }

    #[test]
    fn var_name_constant_is_the_deployed_binding() {
        assert_eq!(DEVICE_KEYS_ENABLED_VAR, "DEVICE_KEYS_ENABLED");
        assert_eq!(DEVICE_KEYS_ENABLED_ON, "true");
    }
}
