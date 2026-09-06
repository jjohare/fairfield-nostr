# ADR-090 — Path discipline at the FORUM_BASE boundary

**Date:** 2026-05-17
**Status:** Accepted
**Supersedes:** ad-hoc usage of `base_href` / `location.pathname.get()` in `app.rs`.

## Context
Forum is deployed at sub-paths (production `/community/`, dev `/`). Compile-time `FORUM_BASE` is passed to `<Router base=>`. Multiple call sites independently compose paths with the base, producing inconsistencies:
- `main.rs:49` registered SW at `./sw.js` (browser-relative).
- `AuthGatedChat`/`AuthGatedChannel`/etc. fed `location.pathname.get()` (which returns the prefixed path) into `login_redirect_target`, which then went back through `use_navigate(…)` — and the router re-prefixed → `/community/community/forums`.
- `login.rs::return_to` only rejected `"/login"`, not the prefixed `"/community/login"`.

## Decision
Adopt the following invariant **everywhere**:

> Internal paths inside the app are always **base-relative** (start with `/`, do not contain the `FORUM_BASE` prefix). The prefix is added in exactly two places: `<Router base=>` (automatic) and `base_href()` for `<A>` / `window.location.set_href`.

Concrete rules:
1. **Never** pass `location.pathname.get()` to `use_navigate(...)`. Always strip `FORUM_BASE` first via the new helper `current_app_path()`.
2. **Never** include `FORUM_BASE` in a `returnTo` query string.
3. Service worker registration uses `format!("{FORUM_BASE}/sw.js")` (absolute) and an explicit `scope = format!("{FORUM_BASE}/")`.
4. `return_to` validators reject any path that starts with `FORUM_BASE` (after stripping, re-validate).

## Consequences
- Eliminates Bug #1 (double prefix) and Bug #6 (self-referential `returnTo`).
- Eliminates Bug #3 (SW 404 on deep routes) and unblocks PWA installation.
- One helper, one rule — future routes can't reintroduce the class.
- Trivial unit-testable: `current_app_path("/community/forums")` ≡ `"/forums"`; with `FORUM_BASE=""`, identity.

## Closeout extension — 2026-09-05

Accepted design status is preserved; current implementation and deployment acceptance remain qualified. Base-relative helpers and explicit service-worker scope exist. current_app_path uses textual prefix stripping, and login returnTo validation must be assessed through the actual router for unusual path forms.

**CP-01/06/08/09:** Verify root/subpath login and navigation, prefix collisions, encoded/protocol-relative forms and service-worker registration from deep routes.

See the [current source-to-consumer assessment](../../../../VisionFlow/docs/estate-review/forum-decisions.md#forum-navigation-counts-and-cold-entry) and [source hashes](../../../../VisionFlow/docs/estate-review/evidence/forum-sprint-snapshot.json). No browser, relay or service-worker test ran in this pass. Frozen archive stubs are unchanged.

## Acceptance progress — 2026-09-05

**Implemented.** Path handling moved into `crates/nostr-bbs-forum-client/src/utils/paths.rs`. The base prefix
is now stripped only on a **proper path-segment boundary**, so a path that merely shares the base's
characters (`base = /community`, `pathname = /communityfoo`) is left alone instead of being mangled, an inner
repeat of the base segment survives (`/community/community-notes`), and an exact match on the base resolves
to `/`. `strip_base` returns `None` for anything not inside the base rather than silently producing a
plausible-looking wrong path.

`returnTo` is now validated by `safe_return_to`, which accepts app-internal relative paths only. It rejects
absolute URLs, scheme-relative `//host`, any scheme (`javascript:`, `data:`), backslash tricks, and traversal
smuggled through multiple rounds of percent-encoding (`%252f` → `%2f` → `/`), with the decoding bounded at
four rounds so hostile input cannot buy unbounded work, plus a length cap. A rejected value falls back to a
safe default route. This closes an open redirect.

**Tests and results.** 32 tests in `utils::paths`, adversarial by construction.
`cargo test -p nostr-bbs-forum-client` — 329 passed, 0 failed. `cargo test --workspace` — 1823 passed.
`trunk build` — exit 0.

**Browser receipts.** Verified end-to-end in Chrome (sidecar) against a local `wrangler dev` relay, with a
throwaway local-only key and no production endpoint contacted. `/login?returnTo=https://evil.example.com/pwned`
stays on origin, renders the login form, and never reflects the hostile value into the document or emits an
off-origin link. A cold unauthenticated deep link to `/chat/<id>` is redirected to
`/login?returnTo=/chat/<id>` — a **relative** returnTo — and after sign-in returns to that exact deep-link
target. Screenshots `adr-090-hostile-returnto.png`, `adr-092-cold-deeplink.png`; full evidence in
[`browser-run.json`](../../estate-closeout/2026-09-05/browser-run.json).

**Remaining.** The harness served the app at the site root, so a non-empty deployed base path was exercised
in unit tests but not in the browser. Incidental finding: the client reads only its own `window.__ENV__` key
names (`VITE_RELAY_URL`, `RELAY_API_URL`, …) and an un-injected build silently falls back to the **production**
relay — a local harness that guesses the key names will talk to production without saying so. Worth a comment
in `index.html`.

**Governed paths changed:** `crates/nostr-bbs-forum-client/src/utils/paths.rs` (new),
`src/utils/mod.rs`, `src/app.rs`, `src/pages/login.rs`, `src/pages/setup.rs`, `src/pages/signup.rs`.
Receipt: [`adr-090-092-client.json`](../../estate-closeout/2026-09-05/adr-090-092-client.json).
