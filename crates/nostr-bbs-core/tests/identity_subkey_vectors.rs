//! ADR-2003 acceptance — shared, versioned identity-vector fixture for
//! `derive_subkey`, executed by BOTH this Rust suite and the Node parity
//! runner (`scripts/identity-vector-parity.mjs`).
//!
//! The fixture at `tests/vectors/identity-subkey-vectors.v1.json` is the single
//! source of truth for the cross-stack contract. `derive_subkey(root, tag)` is
//! a **single raw HMAC-SHA-256** keyed by the root's 32 secret bytes with the
//! UTF-8 tag as the message — deliberately NOT HKDF — so that the Rust output
//! equals the agentbox JavaScript output byte for byte:
//!
//! ```js
//! crypto.createHmac('sha256', rootSk32Bytes).update(tag, 'utf8').digest()
//! ```
//!
//! Do not "upgrade" this construction. Doing so silently forks every agentbox
//! mirror/gateway child identity from its forum-side counterpart.
//!
//! This suite is additive: the inline known-answer JS-parity test in
//! `src/keys.rs` (`derive_subkey_known_answer_vector_js_parity`) must never be
//! deleted, and the `canonical-mirror-v1` vector below reproduces it.

use nostr_bbs_core::{derive_subkey, SecretKey};
use std::path::PathBuf;

/// secp256k1 group order `n`. Valid secret scalars satisfy `0 < x < n`.
const SECP256K1_ORDER_HEX: &str =
    "fffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141";

const FIXTURE_VERSION: u64 = 1;
const FIXTURE_RELATIVE_PATH: &str = "tests/vectors/identity-subkey-vectors.v1.json";

fn fixture_path() -> PathBuf {
    let mut p = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    for segment in FIXTURE_RELATIVE_PATH.split('/') {
        p.push(segment);
    }
    p
}

/// Load the fixture, failing loudly (never skipping) when it is missing or malformed.
fn load_fixture() -> serde_json::Value {
    let path = fixture_path();
    let bytes = std::fs::read(&path).unwrap_or_else(|e| {
        panic!(
            "ADR-2003 identity-vector fixture missing or unreadable at {}: {e}. \
             This fixture is the shared Rust/JS contract and MUST be present; \
             it is not optional and this test must never be skipped.",
            path.display()
        )
    });
    serde_json::from_slice(&bytes).unwrap_or_else(|e| {
        panic!(
            "ADR-2003 identity-vector fixture at {} is not valid JSON: {e}",
            path.display()
        )
    })
}

fn hex32(value: &serde_json::Value, field: &str, vector_id: &str) -> [u8; 32] {
    let s = value
        .get(field)
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| panic!("vector '{vector_id}': missing string field '{field}'"));
    let raw = hex::decode(s).unwrap_or_else(|e| {
        panic!("vector '{vector_id}': field '{field}' is not valid hex: {e}")
    });
    assert_eq!(
        raw.len(),
        32,
        "vector '{vector_id}': field '{field}' must be 32 bytes, got {}",
        raw.len()
    );
    let mut out = [0u8; 32];
    out.copy_from_slice(&raw);
    out
}

fn str_field<'a>(value: &'a serde_json::Value, field: &str, vector_id: &str) -> &'a str {
    value
        .get(field)
        .and_then(|v| v.as_str())
        .unwrap_or_else(|| panic!("vector '{vector_id}': missing string field '{field}'"))
}

/// The fixture header pins the version, the algorithm identity and the runner
/// commands. A mismatch here means the two stacks are no longer reading the
/// same contract.
#[test]
fn fixture_header_is_the_expected_contract() {
    let fixture = load_fixture();

    let version = fixture
        .get("version")
        .and_then(|v| v.as_u64())
        .expect("fixture must carry a numeric top-level `version`");
    assert_eq!(
        version, FIXTURE_VERSION,
        "fixture version changed: this test targets v{FIXTURE_VERSION}. \
         Bump the test alongside the fixture, or add a new versioned fixture file."
    );

    let algorithm_id = fixture
        .get("algorithm_id")
        .and_then(|v| v.as_str())
        .expect("fixture must carry `algorithm_id`");
    assert_eq!(
        algorithm_id, "agentbox-subkey-hmac-sha256-v1",
        "fixture algorithm_id changed — the construction must stay raw HMAC-SHA-256, not HKDF"
    );

    let algorithm = fixture
        .get("algorithm")
        .and_then(|v| v.as_str())
        .expect("fixture must carry a human-readable `algorithm`");
    assert!(
        algorithm.contains("HMAC-SHA-256"),
        "fixture `algorithm` must describe HMAC-SHA-256, got: {algorithm}"
    );
    assert!(
        !algorithm.contains("HKDF"),
        "fixture `algorithm` mentions HKDF — ADR-2003 forbids that construction here"
    );

    assert_eq!(
        fixture
            .get("secp256k1_order_hex")
            .and_then(|v| v.as_str())
            .expect("fixture must carry `secp256k1_order_hex`"),
        SECP256K1_ORDER_HEX,
        "fixture curve order does not match the secp256k1 group order"
    );

    let vectors = fixture
        .get("vectors")
        .and_then(|v| v.as_array())
        .expect("fixture must carry a `vectors` array");
    assert!(
        !vectors.is_empty(),
        "fixture `vectors` array is empty — nothing would be proven"
    );

    let invalid = fixture
        .get("invalid")
        .and_then(|v| v.as_array())
        .expect("fixture must carry an `invalid` array");
    assert!(
        !invalid.is_empty(),
        "fixture `invalid` array is empty — rejection behaviour would be unproven"
    );
}

/// Every fixture vector must reproduce byte for byte through `derive_subkey`.
#[test]
fn every_fixture_vector_matches_derive_subkey() {
    let fixture = load_fixture();
    let vectors = fixture
        .get("vectors")
        .and_then(|v| v.as_array())
        .expect("fixture must carry a `vectors` array");

    let mut seen_ids: Vec<&str> = Vec::new();
    let mut passed = 0usize;

    for vector in vectors {
        let id = str_field(vector, "id", "<unknown>");
        assert!(
            !seen_ids.contains(&id),
            "duplicate vector id '{id}' in the fixture"
        );
        seen_ids.push(id);

        let root_bytes = hex32(vector, "root_secret_hex", id);
        let tag = str_field(vector, "tag", id);
        let expected = str_field(vector, "expected_child_secret_hex", id);

        // The declared UTF-8 byte length guards against a fixture edited by a
        // tool that silently re-encoded or normalised the tag.
        let declared_len = vector
            .get("tag_utf8_bytes")
            .and_then(|v| v.as_u64())
            .unwrap_or_else(|| panic!("vector '{id}': missing numeric `tag_utf8_bytes`"));
        assert_eq!(
            tag.as_bytes().len() as u64,
            declared_len,
            "vector '{id}': tag is {} UTF-8 bytes but the fixture declares {declared_len} — \
             the tag was re-encoded or normalised somewhere",
            tag.as_bytes().len()
        );

        let root = SecretKey::from_bytes(root_bytes).unwrap_or_else(|e| {
            panic!("vector '{id}': `root_secret_hex` is not a valid secp256k1 scalar: {e}")
        });

        let child = derive_subkey(&root, tag).unwrap_or_else(|e| {
            panic!("vector '{id}': derive_subkey failed: {e}")
        });
        let actual = hex::encode(child.as_bytes());

        assert_eq!(
            actual, expected,
            "vector '{id}' MISMATCH (tag = {tag:?}, root = {}): \
             Rust derive_subkey diverged from the shared JS-parity fixture. \
             Do not update the fixture to match Rust without re-running \
             `node scripts/identity-vector-parity.mjs`.",
            hex::encode(root_bytes)
        );

        // Determinism: a second call must be identical.
        let again = derive_subkey(&root, tag).expect("re-derivation must succeed");
        assert_eq!(
            hex::encode(again.as_bytes()),
            actual,
            "vector '{id}': derive_subkey is not deterministic"
        );

        passed += 1;
    }

    assert_eq!(
        passed,
        vectors.len(),
        "not every vector was executed ({passed}/{})",
        vectors.len()
    );
    eprintln!("ADR-2003: {passed} identity vectors matched byte for byte");
}

/// The rotation vectors must actually rotate: a `-v2` tag must not collide with
/// its `-v1` sibling under the same root.
#[test]
fn tag_rotation_changes_the_child_key() {
    let fixture = load_fixture();
    let vectors = fixture
        .get("vectors")
        .and_then(|v| v.as_array())
        .expect("fixture must carry a `vectors` array");

    let find = |id: &str| -> &serde_json::Value {
        vectors
            .iter()
            .find(|v| v.get("id").and_then(|x| x.as_str()) == Some(id))
            .unwrap_or_else(|| panic!("fixture is missing the required vector '{id}'"))
    };

    for (v1_id, v2_id) in [
        ("canonical-mirror-v1", "rotation-mirror-v2"),
        ("canonical-gateway-v1", "rotation-gateway-v2"),
    ] {
        let v1 = find(v1_id);
        let v2 = find(v2_id);

        assert_eq!(
            str_field(v1, "root_secret_hex", v1_id),
            str_field(v2, "root_secret_hex", v2_id),
            "rotation pair {v1_id}/{v2_id} must share a root to prove tag-only rotation"
        );
        assert_ne!(
            str_field(v1, "expected_child_secret_hex", v1_id),
            str_field(v2, "expected_child_secret_hex", v2_id),
            "rotation pair {v1_id}/{v2_id} produced the same child key — rotation is broken"
        );

        // Prove it live, not just in the fixture text.
        let root = SecretKey::from_bytes(hex32(v1, "root_secret_hex", v1_id)).unwrap();
        let a = derive_subkey(&root, str_field(v1, "tag", v1_id)).unwrap();
        let b = derive_subkey(&root, str_field(v2, "tag", v2_id)).unwrap();
        assert_ne!(a.as_bytes(), b.as_bytes());
        assert_ne!(a.public_key(), b.public_key());
    }
}

/// Every entry in the `invalid` section must be rejected by the real API.
#[test]
fn invalid_roots_are_rejected() {
    let fixture = load_fixture();
    let invalid = fixture
        .get("invalid")
        .and_then(|v| v.as_array())
        .expect("fixture must carry an `invalid` array");

    let mut rejected = 0usize;
    for entry in invalid {
        let id = str_field(entry, "id", "<unknown>");
        let root_bytes = hex32(entry, "root_secret_hex", id);
        let expectation = str_field(entry, "rust_expects", id);
        assert!(
            expectation.contains("InvalidSecretKey"),
            "invalid entry '{id}': unexpected `rust_expects` value {expectation:?}"
        );

        match SecretKey::from_bytes(root_bytes) {
            Ok(_) => panic!(
                "invalid entry '{id}': SecretKey::from_bytes ACCEPTED a root the fixture \
                 says must be rejected ({})",
                str_field(entry, "reason", id)
            ),
            Err(e) => {
                assert!(
                    matches!(e, nostr_bbs_core::keys::KeyError::InvalidSecretKey),
                    "invalid entry '{id}': expected KeyError::InvalidSecretKey, got {e:?}"
                );
                rejected += 1;
            }
        }
    }

    assert_eq!(rejected, invalid.len());
    eprintln!("ADR-2003: {rejected} invalid roots rejected as specified");
}

/// The construction is not HKDF, and this test says so in executable form: an
/// HKDF-Expand over the same inputs must NOT equal `derive_subkey`'s output.
/// If someone "upgrades" `derive_subkey` to HKDF, this fails immediately.
#[test]
fn derive_subkey_is_raw_hmac_not_hkdf() {
    use hkdf::Hkdf;
    use sha2::Sha256;

    let root_bytes = [0x01u8; 32];
    let root = SecretKey::from_bytes(root_bytes).unwrap();
    let tag = "agentbox-mirror-v1";

    let hmac_output = derive_subkey(&root, tag).unwrap();
    assert_eq!(
        hex::encode(hmac_output.as_bytes()),
        "2d07f2ce93d0361687fdd81d2690082b5d6c35b93e3ece2d44bcf115ef8f695d",
        "the canonical JS-parity known answer changed"
    );

    let hk = Hkdf::<Sha256>::new(None, &root_bytes);
    let mut okm = [0u8; 32];
    hk.expand(tag.as_bytes(), &mut okm).unwrap();
    assert_ne!(
        okm,
        *hmac_output.as_bytes(),
        "derive_subkey now matches HKDF-Expand — ADR-2003 forbids that construction"
    );
}
