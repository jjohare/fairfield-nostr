[← Back to Main README](../README.md)

# Security Audit Report - Minimoonoir

**Date:** 2025-12-13
**Auditor:** Claude Code Security Analysis
**Version:** 1.0
**Scope:** Full codebase security review

---

## Executive Summary

This security audit identifies **4 Critical**, **5 High**, **6 Medium**, and **4 Low** severity issues across the Minimoonoir Nostr-based PWA chat application. The most significant concerns involve private key storage in localStorage without encryption and the open relay write policy in development mode.

---

## Critical Findings

### CRIT-01: Private Keys Stored in Plain Text in localStorage

**Location:** `src/lib/stores/auth.ts:76-82`, `src/lib/nostr/keys.ts:85-89`

**Description:** Private keys (nsec/hex) are stored directly in localStorage without encryption. Any XSS vulnerability or malicious browser extension can extract these keys.

```typescript
// auth.ts:76-82
localStorage.setItem('minimoonoir_keys', JSON.stringify({
  publicKey,
  privateKey,  // CRITICAL: Plain text private key
  mnemonic: mnemonic || null,
  nickname: existingData.nickname || null,
  avatar: existingData.avatar || null
}));
```

**Impact:** Complete account compromise if attacker gains any JavaScript execution context.

**Recommendation:**
1. Encrypt private keys with a user-derived key (PIN/password) using AES-256-GCM
2. Consider using Web Crypto API with non-extractable keys
3. Implement session timeouts that clear unencrypted key material
4. Add `encryptedPrivkey` field (already defined in `storage.ts` but not used by `auth.ts`)

---

### CRIT-02: Relay Write Policy Configuration

**Location:** Relay configuration (Cloudflare Workers)

**Description:** Write policies and authentication must be properly configured in the Cloudflare Workers relay implementation.

**Impact:** Any user can write any event to the relay without proper authentication controls.

**Recommendation:**
1. Implement write policy in the Cloudflare Workers relay handler
2. Enforce authentication using NIP-42 or similar
3. Add deployment checklist verifying production config is used

---

### CRIT-03: Hardcoded Admin Pubkey in Source Code

**Location:** `src/lib/stores/auth.ts:33`

**Description:** Admin pubkey is hardcoded, making it visible in client-side JavaScript bundle.

```typescript
const HARDCODED_ADMINS = ['55f6d852c8ecbf022be81be356b62fdeef09c900deaf2bd262dc6759427c2eb2'];
```

**Impact:** Attackers know which pubkey has admin privileges. Combined with relay policy bypass, could lead to privilege escalation.

**Recommendation:**
1. Load admin pubkeys from relay metadata (NIP-11) or authenticated server endpoint
2. Remove hardcoded values from client-side code
3. Consider relay-side admin validation rather than client-side

---

### CRIT-04: Write Policy Implementation Required

**Location:** Cloudflare Workers relay handler

**Description:** The relay implementation must include proper write policy and authentication logic in the Cloudflare Workers environment.

**Impact:** Without proper write policy implementation, the relay may accept unauthorized events.

**Recommendation:**
1. Implement auth-whitelist logic in the Cloudflare Workers relay handler
2. Add health check that verifies authentication is working
3. Document the authentication flow for the Workers environment

---

## High Severity Findings

### HIGH-01: No CSP Headers in nginx.conf

**Location:** `nginx.conf` (missing Content-Security-Policy)

**Description:** While nginx.conf has X-Frame-Options and X-XSS-Protection, it lacks Content-Security-Policy headers. The Caddyfile has CSP, but the active nginx config does not.

```nginx
# nginx.conf:46-49 - Has basic headers but NO CSP
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;  # Deprecated
# Missing: Content-Security-Policy
```

**Impact:** XSS vulnerabilities are not mitigated by browser CSP enforcement.

**Recommendation:**
Add to nginx.conf:
```nginx
add_header Content-Security-Policy "default-src 'self'; connect-src 'self' wss: ws:; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://api.dicebear.com; font-src 'self' https://fonts.gstatic.com; manifest-src 'self'; worker-src 'self';" always;
```

---

### HIGH-02: X-XSS-Protection Header is Deprecated

**Location:** `nginx.conf:48`, `relay/Caddyfile:17`

**Description:** The `X-XSS-Protection` header is deprecated and can introduce security issues in modern browsers. Chrome removed XSS Auditor in 2019.

**Recommendation:** Remove `X-XSS-Protection` header and rely on CSP instead.

---

### HIGH-03: @html Directive Usage

**Location:** `src/lib/components/chat/JoinRequestButton.svelte:87`

**Description:** Svelte's `{@html}` directive is used to render SVG icons. While the current code only renders hardcoded SVGs (safe), this pattern is risky.

```svelte
{@html getIcon(status)}  // status is derived from store, not user input
```

**Impact:** Currently low risk since icons are hardcoded, but pattern could be misused.

**Recommendation:**
1. Replace with Svelte component-based icons
2. If @html is needed, add eslint rule to flag usage for review

---

### HIGH-04: Mnemonic Stored in localStorage

**Location:** `src/lib/stores/auth.ts:79`

**Description:** The 12-word BIP39 mnemonic is stored in localStorage alongside the private key.

**Impact:** Mnemonic exposure is even more severe than private key exposure as it can derive keys for multiple accounts.

**Recommendation:**
1. Only store mnemonic temporarily during initial backup verification
2. After user confirms backup, delete mnemonic from storage
3. Use `hasMnemonicBeenShown()` flag that already exists in `storage.ts`

---

### HIGH-05: External Image Loading (Avatar)

**Location:** `src/lib/components/chat/MessageItem.svelte:55`

**Description:** Avatars load from external service without integrity checks.

```typescript
return `https://api.dicebear.com/7.x/identicon/svg?seed=${pubkey}`;
```

**Impact:**
- Privacy leak: Dicebear receives all user pubkeys
- If Dicebear is compromised, could serve malicious SVG (though CSP should block scripts)

**Recommendation:**
1. Self-host dicebear or generate avatars locally
2. Add Subresource Integrity (SRI) if using CDN
3. Proxy through backend to prevent pubkey leakage

---

## Medium Severity Findings

### MED-01: No Rate Limiting on Client Side

**Location:** `src/lib/components/chat/MessageInput.svelte`

**Description:** No client-side rate limiting for message sending. While relay has limits, aggressive clients could spam.

**Recommendation:** Add debounce/throttle to message sending.

---

### MED-02: Console Logging Sensitive Data

**Location:** Multiple files (`ndk.ts:46,65,90`, `channels.ts:87,126,159`)

**Description:** Console logs include relay connection info and potentially sensitive operation details.

```typescript
console.log('NDK configured with relays:', relayUrls);
console.log('NDK signer configured');
console.log('Channel created:', event.id);
```

**Recommendation:** Remove or guard with debug flag in production builds.

---

### MED-03: Missing HSTS in nginx.conf

**Location:** `nginx.conf`

**Description:** HTTP Strict Transport Security header is present in Caddyfile but not nginx.conf.

**Recommendation:** Add `Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"` to nginx.conf.

---

### MED-04: Sourcemaps Enabled in Production Build

**Location:** `vite.config.ts:100`

**Description:** `sourcemap: true` is set, exposing source code in production.

**Recommendation:** Set `sourcemap: false` or `'hidden'` for production builds.

---

### MED-05: Permissive Style-src CSP

**Location:** `relay/Caddyfile:33`

**Description:** CSP uses `'unsafe-inline'` for style-src, weakening protection.

**Recommendation:** Use nonces or hashes for inline styles where possible.

---

### MED-06: No CSRF Protection

**Location:** Application-wide

**Description:** No CSRF tokens for state-changing operations. Relies on same-origin policy.

**Recommendation:** While Nostr events are self-authenticated, add CSRF tokens for any server-side operations if added later.

---

## Low Severity Findings

### LOW-01: Missing Permissions-Policy in nginx.conf

**Location:** `nginx.conf`

**Description:** Caddyfile has Permissions-Policy but nginx.conf does not.

**Recommendation:** Add `Permissions-Policy "geolocation=(), microphone=(), camera=()"`.

---

### LOW-02: Insecure Context Warning Only

**Location:** `src/lib/utils/storage.ts:24-26`

**Description:** Non-secure context only logs a warning, doesn't prevent key storage.

```typescript
if (!window.isSecureContext && window.location.hostname !== 'localhost') {
  console.warn('Not running in a secure context. Key storage may be insecure.');
}
```

**Recommendation:** Consider blocking key operations on non-secure contexts.

---

### LOW-03: No Input Length Validation

**Location:** `src/lib/components/chat/MessageInput.svelte`

**Description:** No client-side validation of message length before sending.

**Recommendation:** Add max length check matching relay's `maxEventSize`.

---

### LOW-04: Missing Referrer-Policy for External Requests

**Location:** `src/app.html:16-17`

**Description:** Font preconnects don't have referrer policy control.

**Recommendation:** Add `referrerPolicy="no-referrer"` to external resource links.

---

## Positive Security Measures

The following security measures are already implemented:

1. **NIP-06 Key Derivation**: Proper BIP39/BIP32 implementation using audited @scure libraries
2. **Mnemonic Validation**: Uses `validateMnemonic` before accepting recovery phrases
3. **Secure Context Check**: Validates secure context (though only warns)
4. **X-Frame-Options**: Prevents clickjacking
5. **Nosniff Header**: Prevents MIME type sniffing
6. **Private Relay Mode**: Default to local-only relay connections
7. **Admin-Only Channel Creation**: Checks `isAdmin` before allowing channel operations
8. **Production Write Policy**: Production relay config has auth plugin (if deployed correctly)

---

## Remediation Priority

| Priority | Issue | Effort |
|----------|-------|--------|
| Immediate | CRIT-01: Encrypt private keys | High |
| Immediate | CRIT-04: Implement write policy in Workers | Medium |
| This Week | HIGH-01: Add CSP to nginx.conf | Low |
| This Week | CRIT-03: Remove hardcoded admin pubkey | Medium |
| This Week | HIGH-05: Self-host avatar generation | Medium |
| Next Sprint | CRIT-02: Configure write policy for Workers | Low |
| Next Sprint | HIGH-04: Clear mnemonic after backup | Low |
| Ongoing | MED-02: Remove console logs | Low |

---

## Testing Recommendations

1. **XSS Testing**: Run automated XSS scanner against all user input fields
2. **Key Extraction Test**: Verify browser extensions cannot access localStorage
3. **Relay Policy Test**: Attempt to publish unauthorized events
4. **CSP Testing**: Use browser devtools to verify CSP blocks inline scripts
5. **Authentication Bypass**: Attempt admin operations without valid pubkey

---

## Appendix: Files Reviewed

- src/lib/stores/auth.ts
- src/lib/stores/settings.ts
- src/lib/nostr/keys.ts
- src/lib/nostr/ndk.ts
- src/lib/nostr/channels.ts
- src/lib/nostr/groups.ts
- src/lib/utils/storage.ts
- src/lib/config.ts
- src/lib/components/auth/Login.svelte
- src/lib/components/chat/*.svelte
- src/routes/admin/+page.svelte
- nginx.conf
- relay/workers/handler.ts (Cloudflare Workers relay)
- vite.config.ts
- svelte.config.js
- .env.example

---

*This audit was conducted using static analysis. Dynamic testing and penetration testing are recommended for production deployments.*

---

## Fixes Applied (2025-12-13)

The following security issues were remediated:

### Fixed Issues

| Issue | Fix Applied |
|-------|-------------|
| CRIT-01: Plain text private keys | Added AES-256-GCM encryption with session keys (`src/lib/utils/key-encryption.ts`) |
| CRIT-03: Hardcoded admin pubkey | Removed from code, now env-only via `VITE_ADMIN_PUBKEY` |
| CRIT-04: Write policy implementation | Implemented in Cloudflare Workers relay handler |
| HIGH-01: No CSP headers | Added full CSP to `nginx.conf` |
| HIGH-02: Deprecated X-XSS-Protection | Removed, relying on CSP |
| HIGH-04: Mnemonic persisted | Added `confirmMnemonicBackup()` to clear after backup |
| MED-02: Console logging | Wrapped in `import.meta.env.DEV` checks |
| MED-03: Missing HSTS | Added (commented, enable after HTTPS) |
| MED-04: Sourcemaps in production | Disabled via `vite.config.ts` |
| LOW-01: Missing Permissions-Policy | Added to nginx.conf |

### Files Modified

- `src/lib/utils/key-encryption.ts` (new)
- `src/lib/stores/auth.ts` (encryption, async setKeys, mnemonic clearing)
- `src/lib/nostr/ndk.ts` (dev-only logging)
- `src/lib/nostr/channels.ts` (removed console.log)
- `src/routes/setup/+page.svelte` (async handler)
- `src/routes/signup/+page.svelte` (async handler, mnemonic backup)
- `src/lib/components/auth/AuthFlow.svelte` (async handlers)
- `nginx.conf` (security headers, CSP)
- `vite.config.ts` (production sourcemaps disabled)
- `relay/workers/handler.ts` (write policy implementation)
- `.env.example` (admin pubkey documentation)

### Remaining Recommendations

1. **Enable HSTS** after confirming HTTPS works (uncomment in nginx.conf)
2. **Set VITE_ADMIN_PUBKEY** in production environment
3. **Update whitelist.json** with actual admin/user pubkeys
4. **Consider self-hosting avatars** to prevent pubkey leakage to dicebear.com
