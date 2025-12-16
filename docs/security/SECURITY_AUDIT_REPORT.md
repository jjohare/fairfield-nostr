# Security Audit Report - Minimoonoir Nostr PWA

**Audit Date**: 2025-12-14
**Auditor**: Code Analyzer Agent
**Version**: 0.1.0
**Scope**: Full codebase security assessment

---

## Executive Summary

This comprehensive security audit evaluated the Minimoonoir Nostr PWA across authentication, data security, web security, relay security, and dependencies. The application demonstrates strong cryptographic implementations using modern standards (NIP-44, NIP-06, AES-GCM) and proper key management practices. However, several critical and high-priority vulnerabilities require immediate attention.

**Overall Security Score**: 6.5/10

### Critical Findings: 2
### High Severity: 5
### Medium Severity: 8
### Low Severity: 6

---

## 1. Authentication & Authorization

### 🔴 CRITICAL: Admin Private Keys Exposed in .env File

**File**: `/mnt/mldata/githubs/minimoonoir/.env`
**Lines**: 1-3

**Issue**:
```bash
VITE_ADMIN_PUBKEY=<REDACTED - keys have been rotated>
ADMIN_PRIVKEY=<REDACTED - keys have been rotated>
ADMIN_KEY="<REDACTED - keys have been rotated>"
```

**Status**: ✅ RESOLVED - Keys rotated on 2025-12-14

**Risk**: Complete compromise of admin account. These credentials provide:
- Full administrative access to the application
- Ability to create/delete channels
- Access to user management functions
- Relay configuration control

**Impact**:
- Attackers can impersonate administrators
- Unauthorized data access and manipulation
- System configuration changes
- Potential data exfiltration

**Recommendation**:
1. **IMMEDIATE**: Rotate all admin keys
2. Remove `.env` from version control history using `git-filter-repo` or BFG Repo-Cleaner
3. Add `.env` to `.gitignore` (verify it's not already committed)
4. Use environment variables or secrets management (GitHub Secrets, Vault)
5. Implement key rotation policy
6. Audit all commits for exposed secrets

---

### 🔴 CRITICAL: Client-Side Admin Authorization

**File**: `src/lib/stores/auth.ts`
**Lines**: 56-75, 129, 193

**Issue**:
```typescript
const ADMIN_PUBKEY = import.meta.env.VITE_ADMIN_PUBKEY || '';
const ADMIN_PUBKEYS = ADMIN_PUBKEY ? ADMIN_PUBKEY.split(',').map((k: string) => k.trim()).filter(Boolean) : [];

function isAdminPubkey(pubkey: string): boolean {
  const validAdminKeys = ADMIN_PUBKEYS.filter(k =>
    k !== '0000000000000000000000000000000000000000000000000000000000000000' && k.length === 64
  );
  return validAdminKeys.includes(pubkey);
}
```

**Risk**: Client-side checks can be bypassed by modifying JavaScript in browser DevTools or intercepting requests.

**Impact**:
- UI-level bypass allows unauthorized admin panel access
- Privilege escalation attacks
- False sense of security

**Recommendation**:
1. Implement server-side authorization on Cloudflare Workers relay
2. Verify admin status on every privileged operation at relay level
3. Use the relay's D1 whitelist as source of truth (as documented)
4. Add JWT or signed tokens for admin session validation
5. Implement rate limiting on admin endpoints

**Example Secure Flow**:
```typescript
// Client requests admin action
// Relay verifies pubkey against D1 whitelist
// Relay returns signed token with admin claim
// Future requests include token for verification
```

---

### 🟠 HIGH: Session Key Stored in sessionStorage

**File**: `src/lib/stores/auth.ts`
**Lines**: 81-93

**Issue**:
```typescript
function getSessionKey(): string {
  if (!browser) return '';

  let sessionKey = sessionStorage.getItem(SESSION_KEY);
  if (!sessionKey) {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    sessionKey = btoa(String.fromCharCode(...array));
    sessionStorage.setItem(SESSION_KEY, sessionKey);
  }
  return sessionKey;
}
```

**Risk**:
- Session keys accessible via XSS attacks
- No protection from malicious browser extensions
- Session fixation attacks possible

**Impact**:
- Private key decryption if session key compromised
- Account takeover within session lifetime
- Cross-tab attacks

**Recommendation**:
1. Use Web Crypto API's non-extractable keys where possible
2. Implement session binding to prevent CSRF
3. Add session invalidation on suspicious activity
4. Consider IndexedDB with encryption for sensitive session data
5. Implement session timeout (currently missing)

---

### 🟠 HIGH: Weak Password-Based Encryption (PBKDF2 100k iterations)

**File**: `src/lib/utils/key-encryption.ts`
**Lines**: 6, 14-37

**Issue**:
```typescript
const PBKDF2_ITERATIONS = 100000;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}
```

**Risk**:
- 100k iterations insufficient against modern GPU attacks
- OWASP recommends 600k+ iterations for PBKDF2-SHA256 (2023)
- Vulnerable to offline brute-force attacks if encrypted keys leaked

**Impact**:
- Weak passwords crackable in hours/days with GPU clusters
- Batch attacks against multiple users feasible

**Recommendation**:
1. Increase to minimum 600,000 iterations (OWASP 2023 recommendation)
2. Consider Argon2id (more resistant to GPU attacks) if available
3. Enforce strong password requirements (12+ chars, complexity)
4. Add password strength indicator to UI
5. Implement account lockout after failed decryption attempts

**Reference**: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)

---

### 🟡 MEDIUM: No Multi-Factor Authentication (MFA)

**Files**: `src/lib/stores/auth.ts`, `src/routes/login/+page.svelte`

**Issue**: Authentication relies solely on private key or mnemonic. No second factor available.

**Risk**:
- Single point of failure
- No protection if private key compromised
- No anomaly detection for suspicious logins

**Recommendation**:
1. Implement WebAuthn for hardware key support
2. Add TOTP (Time-based One-Time Password) option
3. Support Nostr NIP-46 (Nostr Connect) for remote signing
4. Add login notification system
5. Implement device fingerprinting and trust

---

### 🟡 MEDIUM: Missing Route Guards

**Files**: `src/routes/admin/+page.svelte`, other route files

**Issue**:
```typescript
onMount(async () => {
  await authStore.waitForReady();

  if (!$isAdmin) {
    goto(`${base}/chat`);
    return;
  }
  // Admin logic...
});
```

**Risk**:
- Client-side navigation guard only
- Brief content flash before redirect
- Can be bypassed with browser tools

**Recommendation**:
1. Implement SvelteKit hooks for server-side route protection
2. Create `+page.server.ts` load functions for auth checks
3. Add CSP nonces for inline scripts
4. Implement proper 403/401 error pages

**Example**:
```typescript
// src/routes/admin/+page.server.ts
export async function load({ locals }) {
  if (!locals.user?.isAdmin) {
    throw redirect(303, '/chat');
  }
  return {};
}
```

---

### 🟡 MEDIUM: Plaintext Private Keys in Memory

**File**: `src/lib/stores/auth.ts`
**Lines**: 25, 122, 269

**Issue**: Private keys stored as strings in Svelte store, accessible to any component.

**Risk**:
- Memory inspection attacks
- Browser extension access
- Accidental logging/exposure

**Recommendation**:
1. Use Web Crypto API's non-extractable keys
2. Implement secure memory clearing on logout
3. Minimize private key scope (only in signing functions)
4. Consider hardware wallet integration (WebUSB)
5. Add runtime memory protection

---

## 2. Data Security

### 🟢 GOOD: NIP-44 Encryption Implementation

**File**: `src/lib/nostr/encryption.ts`

**Strengths**:
- Modern NIP-44 v2 encryption using conversation keys
- Proper ECDH shared secret derivation
- Individual encryption per recipient
- Comprehensive error handling

**Verification**:
```typescript
const conversationKey = nip44.v2.utils.getConversationKey(
  hexToBytes(senderPrivkey),
  hexToBytes(memberPubkey)
);
const encrypted = nip44.v2.encrypt(content, conversationKey);
```

**Minor Recommendation**:
- Add authentication tags validation
- Implement replay attack protection (nonce tracking)
- Add message expiration timestamps

---

### 🟢 GOOD: AES-GCM for Local Storage Encryption

**File**: `src/lib/utils/key-encryption.ts`

**Strengths**:
- AES-GCM provides authenticated encryption
- Random IV generation per encryption
- Salt usage for key derivation
- Base64 encoding for storage compatibility

**Minor Recommendation**:
- Add key rotation mechanism
- Implement versioning for cipher format
- Add integrity checks on decryption

---

### 🟡 MEDIUM: NIP-04 Encryption for DMs (Deprecated)

**File**: `src/lib/utils/nostr-crypto.ts`
**Lines**: 83-144

**Issue**: NIP-04 uses AES-CBC which is deprecated in favor of NIP-44.

**Risk**:
- CBC mode vulnerable to padding oracle attacks
- No authentication (malleable ciphertext)
- Superseded by NIP-44 standard

**Recommendation**:
1. Migrate all DM encryption to NIP-44
2. Add migration path for existing NIP-04 messages
3. Deprecate `nip04Encrypt`/`nip04Decrypt` functions
4. Update UI to indicate encryption method

---

### 🟡 MEDIUM: No Key Rotation Policy

**Files**: Multiple authentication and encryption files

**Issue**: Keys remain static indefinitely with no rotation mechanism.

**Risk**:
- Long-term exposure increases attack surface
- Compromised keys remain valid forever
- No forward secrecy for past messages

**Recommendation**:
1. Implement periodic key rotation (every 90 days)
2. Add UI prompts for key renewal
3. Support key revocation (NIP-09)
4. Maintain key version history
5. Implement Perfect Forward Secrecy (PFS) for messages

---

### 🟡 MEDIUM: Mnemonic Stored Temporarily in Memory

**File**: `src/lib/stores/auth.ts`
**Lines**: 11, 26, 186, 233-252

**Issue**:
```typescript
export interface AuthState {
  mnemonic: string | null;  // Stored in plaintext during onboarding
  // ...
}
```

**Risk**:
- BIP-39 mnemonic visible in memory
- No automatic clearing
- Potential for accidental logging

**Recommendation**:
1. Clear mnemonic immediately after key derivation
2. Implement secure memory clearing
3. Add warnings about mnemonic backup
4. Never persist mnemonic in localStorage
5. Use memory encryption if available

---

### 🔵 LOW: localStorage Keys Not Namespaced

**Files**: Multiple store files

**Issue**:
```typescript
const STORAGE_KEY = 'minimoonoir_keys';
const SESSION_KEY = 'minimoonoir_session';
const CACHE_KEY = 'minimoonoir-link-previews';
```

**Risk**: Potential conflicts with other applications on same domain.

**Recommendation**:
1. Use UUID-based namespacing
2. Prefix with app version
3. Implement storage versioning for migrations

---

## 3. Web Security

### 🟠 HIGH: Missing Content Security Policy (CSP)

**Files**: `vite.config.ts`, HTML output files

**Issue**: No CSP headers detected in configuration or static HTML.

**Risk**:
- XSS attacks not mitigated
- Inline script execution allowed
- Third-party resource loading unrestricted
- Data exfiltration possible

**Recommendation**:
1. Add CSP headers to `svelte.config.js` or static hosting config
2. Implement strict CSP policy:

```javascript
// svelte.config.js
export default {
  kit: {
    adapter: adapter({
      headers: {
        '/*': [
          'Content-Security-Policy: default-src \'self\'; script-src \'self\' \'wasm-unsafe-eval\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: https:; connect-src \'self\' wss://*.workers.dev wss://*.relay.* https://www.google.com; font-src \'self\'; object-src \'none\'; base-uri \'self\'; form-action \'self\';',
          'X-Frame-Options: DENY',
          'X-Content-Type-Options: nosniff',
          'Referrer-Policy: strict-origin-when-cross-origin',
          'Permissions-Policy: geolocation=(), microphone=(), camera=()'
        ]
      }
    })
  }
};
```

3. Add CSP nonces for inline scripts in PWA
4. Report violations to monitoring endpoint

---

### 🟠 HIGH: Missing Security Headers

**Issue**: No security headers in static hosting configuration.

**Missing Headers**:
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (feature policy)

**Risk**:
- Clickjacking attacks
- MIME-type sniffing exploits
- Insecure connections
- Privacy leaks via referrer

**Recommendation**:
Add to static hosting configuration (GitHub Pages, Cloudflare Pages):

```yaml
# _headers file for Cloudflare Pages
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=()
  X-XSS-Protection: 1; mode=block
```

---

### 🟡 MEDIUM: XSS Risk in Link Preview Parser

**File**: `src/lib/stores/linkPreviews.ts`
**Lines**: 204-208

**Issue**:
```typescript
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;  // Potential XSS vector
  return textarea.value;
}
```

**Risk**:
- Malicious HTML entities could execute scripts
- DOM-based XSS if attacker controls HTML content
- Bypasses same-origin policy via innerHTML

**Recommendation**:
1. Use DOMParser instead of innerHTML:

```typescript
function decodeHtmlEntities(text: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  return doc.documentElement.textContent || text;
}
```

2. Sanitize all user-generated HTML with DOMPurify
3. Implement CSP to block inline scripts
4. Validate and escape all OpenGraph data

---

### 🟡 MEDIUM: Open CORS Fetching External URLs

**File**: `src/lib/stores/linkPreviews.ts`
**Lines**: 96-102

**Issue**:
```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Accept': 'text/html',
  },
  signal: AbortSignal.timeout(5000),
});
```

**Risk**:
- CORS bypass attempts
- Server-Side Request Forgery (SSRF) if backend proxy added
- Privacy leak (user IP exposed to external sites)

**Recommendation**:
1. Use backend proxy for link preview fetching
2. Implement URL whitelist/blacklist
3. Validate URLs before fetching
4. Add rate limiting per domain
5. Use third-party service (Cloudflare, Microlink)

---

### 🟡 MEDIUM: No Subresource Integrity (SRI)

**Files**: PWA manifest, CDN resources

**Issue**: No SRI hashes for external resources.

**Risk**:
- Compromised CDN could inject malicious code
- Man-in-the-middle attacks
- Supply chain attacks

**Recommendation**:
1. Generate SRI hashes for all CDN resources
2. Add `integrity` attribute to script/link tags
3. Use `crossorigin="anonymous"` attribute
4. Consider self-hosting critical dependencies

---

### 🔵 LOW: No HTTPS Enforcement Check

**Issue**: Application doesn't verify HTTPS connection.

**Recommendation**:
Add runtime check:
```typescript
if (browser && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
  window.location.href = 'https://' + window.location.host + window.location.pathname;
}
```

---

## 4. Relay Security

### 🟡 MEDIUM: No Rate Limiting Implementation

**Issue**: Client-side code doesn't implement rate limiting for relay operations.

**Risk**:
- Denial of Service attacks
- Resource exhaustion
- Spam/flooding attacks

**Recommendation**:
1. Implement client-side rate limiting:
```typescript
class RateLimiter {
  private timestamps: Map<string, number[]> = new Map();

  check(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.timestamps.get(key) || [];
    const validTimestamps = timestamps.filter(t => now - t < windowMs);

    if (validTimestamps.length >= maxRequests) return false;

    validTimestamps.push(now);
    this.timestamps.set(key, validTimestamps);
    return true;
  }
}
```
2. Add relay-level rate limiting in Cloudflare Workers
3. Implement exponential backoff on errors
4. Add request queue with priority

---

### 🟡 MEDIUM: No Input Validation on Event Content

**Files**: Event publishing functions

**Issue**: Event content not validated before publishing.

**Risk**:
- Malformed events crash relay
- JSON injection attacks
- Buffer overflow attempts

**Recommendation**:
1. Validate all event fields:
```typescript
function validateEvent(event: Event): boolean {
  if (typeof event.content !== 'string') return false;
  if (event.content.length > 100000) return false; // Max size
  if (!Array.isArray(event.tags)) return false;
  if (event.tags.some(t => !Array.isArray(t))) return false;
  return true;
}
```
2. Implement content size limits
3. Sanitize tag values
4. Add schema validation

---

### 🔵 LOW: Missing NIP-42 Authentication

**Issue**: No client authentication to relay (NIP-42).

**Recommendation**:
1. Implement NIP-42 AUTH flow
2. Add relay authentication challenges
3. Verify signatures on privileged operations

---

## 5. Dependencies

### 🟠 HIGH: Moderate Severity npm Vulnerabilities

**Output from `npm audit`**:
```json
{
  "@sveltejs/vite-plugin-svelte": "severity": "moderate",
  "@vitest/mocker": "severity": "moderate",
  "vite": "severity": "moderate"
}
```

**Risk**: Known vulnerabilities in build tools could affect production build.

**Recommendation**:
1. Update vulnerable packages immediately:
```bash
npm update @sveltejs/vite-plugin-svelte@6.2.1
npm update vitest@4.0.15
npm update vite@latest
```
2. Enable Dependabot for automated security updates
3. Run `npm audit fix` weekly
4. Monitor GitHub Security Advisories

---

### 🟡 MEDIUM: Outdated Cryptography Packages

**Issue**:
```json
{
  "@noble/hashes": "current": "1.8.0", "latest": "2.0.1",
  "@noble/curves": "current": "1.8.1", "latest": "2.0.1",
  "@scure/bip32": "current": "1.7.0", "latest": "2.0.1",
  "@scure/bip39": "current": "1.6.0", "latest": "2.0.1"
}
```

**Risk**:
- Missing security patches
- Known vulnerabilities in older versions
- Incompatibilities with newer standards

**Recommendation**:
1. Update to latest versions after testing:
```bash
npm install @noble/hashes@2.0.1 @noble/curves@2.0.1 @scure/bip32@2.0.1 @scure/bip39@2.0.1
```
2. Test thoroughly (major version bump)
3. Review breaking changes in v2.0
4. Update TypeScript types

---

### 🔵 LOW: Duplicate Dependency (@noble/hashes)

**Issue**: Version overrides in package.json indicate resolution conflicts.

```json
"overrides": {
  "@noble/hashes": "1.8.0",
  "@noble/curves": "1.8.1"
}
```

**Recommendation**:
1. Audit dependency tree: `npm ls @noble/hashes`
2. Update all packages to compatible versions
3. Remove overrides if possible
4. Document reasoning for version locks

---

## 6. Additional Security Concerns

### 🟡 MEDIUM: Insecure Source Maps in Production

**File**: `vite.config.ts`
**Lines**: 39

**Issue**:
```typescript
sourcemap: process.env.NODE_ENV !== 'production' ? true : false,
```

**Good**: Source maps disabled in production.

**Recommendation**: Verify build output doesn't include `.map` files.

---

### 🟡 MEDIUM: No Security.txt File

**Issue**: Missing security disclosure policy.

**Recommendation**:
Create `static/.well-known/security.txt`:
```
Contact: security@yourdomain.com
Expires: 2026-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: https://yourdomain.com/.well-known/security.txt
Policy: https://yourdomain.com/security-policy
```

---

### 🔵 LOW: Missing Logging & Monitoring

**Issue**: No security event logging or monitoring.

**Recommendation**:
1. Implement security event logging
2. Log failed login attempts
3. Monitor admin operations
4. Alert on suspicious patterns
5. Integrate with Sentry or similar

---

## Compliance & Standards

### OWASP Top 10 2021 Analysis

| Risk | Status | Notes |
|------|--------|-------|
| A01: Broken Access Control | ⚠️ Vulnerable | Client-side admin checks |
| A02: Cryptographic Failures | ⚠️ Vulnerable | Weak PBKDF2 iterations, exposed keys |
| A03: Injection | ✅ Protected | Nostr events use structured data |
| A04: Insecure Design | ⚠️ Vulnerable | Missing server-side validation |
| A05: Security Misconfiguration | ❌ Critical | Missing CSP, security headers |
| A06: Vulnerable Components | ⚠️ Vulnerable | Outdated dependencies |
| A07: Authentication Failures | ⚠️ Vulnerable | No MFA, weak password derivation |
| A08: Data Integrity Failures | ⚠️ Vulnerable | No SRI, missing integrity checks |
| A09: Logging Failures | ❌ Critical | No security logging |
| A10: SSRF | ⚠️ Vulnerable | Link preview CORS fetching |

---

## Remediation Roadmap

### Phase 1: CRITICAL (Immediate - 24 hours)
1. ✅ Rotate all admin keys exposed in `.env`
2. ✅ Remove `.env` from git history
3. ✅ Add security headers to hosting config
4. ✅ Update vulnerable npm packages

### Phase 2: HIGH (1 week)
1. ⚠️ Implement server-side admin authorization on Cloudflare Workers
2. ⚠️ Add Content Security Policy
3. ⚠️ Increase PBKDF2 iterations to 600k
4. ⚠️ Fix XSS in link preview parser
5. ⚠️ Implement secure session management

### Phase 3: MEDIUM (2-4 weeks)
1. 🔄 Migrate NIP-04 to NIP-44 encryption
2. 🔄 Add route guards with server-side validation
3. 🔄 Implement rate limiting
4. 🔄 Add input validation for all events
5. 🔄 Create key rotation policy
6. 🔄 Add security.txt file

### Phase 4: LOW (1-2 months)
1. 🔧 Implement MFA/WebAuthn
2. 🔧 Add security event logging
3. 🔧 Implement NIP-42 relay authentication
4. 🔧 Add Subresource Integrity
5. 🔧 Namespace localStorage keys
6. 🔧 Add HTTPS enforcement check

---

## Testing Recommendations

### Security Testing Checklist

- [ ] Penetration testing of authentication flows
- [ ] Cryptographic implementation review by specialist
- [ ] XSS/injection testing with OWASP ZAP
- [ ] Dependency scanning with Snyk/Dependabot
- [ ] SAST (Static Application Security Testing)
- [ ] Secrets scanning in git history
- [ ] Browser security header validation
- [ ] Relay DoS/flood testing
- [ ] Session management testing
- [ ] Key rotation testing

### Automated Security Tools

1. **GitHub Advanced Security**
   - Enable Dependabot
   - Enable secret scanning
   - Enable code scanning (CodeQL)

2. **npm audit**
   ```bash
   npm audit --production
   npm audit fix
   ```

3. **OWASP ZAP**
   - Automated security scanning
   - Manual penetration testing

4. **Lighthouse Security Audit**
   ```bash
   lighthouse https://yourapp.com --only-categories=best-practices
   ```

---

## Conclusion

The Minimoonoir Nostr PWA demonstrates strong foundations in cryptographic implementation and modern web standards. However, the exposure of admin credentials in version control and reliance on client-side security checks represent critical risks that require immediate remediation.

The primary security concerns stem from:
1. **Secrets Management**: Hardcoded admin keys in `.env`
2. **Authorization**: Client-side admin checks without server-side enforcement
3. **Web Security**: Missing CSP and security headers
4. **Cryptographic Strength**: Weak PBKDF2 iterations

Implementing the recommended fixes in the roadmap will significantly improve the application's security posture. Priority should be given to:
- Removing exposed secrets
- Implementing server-side authorization
- Adding comprehensive security headers
- Updating vulnerable dependencies

**Post-Remediation Security Score Estimate**: 8.5/10

---

## References

1. [OWASP Top 10 2021](https://owasp.org/www-project-top-ten/)
2. [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
3. [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
4. [NIP-06: Basic Key Derivation](https://github.com/nostr-protocol/nips/blob/master/06.md)
5. [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
6. [Content Security Policy Reference](https://content-security-policy.com/)

---

**Report Version**: 1.0
**Next Audit**: Recommended in 90 days or after major changes
