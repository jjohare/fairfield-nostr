[← Back to Main README](../../README.md)

# Minimoonoir - SPARC Specification

> **Project:** Private Chatroom System for Residential Retreat & Course Booking
> **Version:** 0.1.0-draft
> **Date:** 2024-12-11
> **Status:** Discovery Phase
> **[Back to Main README](../../README.md)**

---

## 1. Executive Summary

Minimoonoir is a closed, self-hosted chat system built on Nostr protocol for a residential retreat community. It provides:

- **Cohort-segregated channels** (Business vs Moomaa-tribe)
- **Admin-gated membership** with request-to-join workflow
- **E2E encrypted private rooms** for course participants
- **PWA-based mobile access**
- **Local relay with deletion capability** (no federation by default)

---

## 2. Business Requirements

### 2.1 User Cohorts

| Cohort | Description | Typical Size |
|--------|-------------|--------------|
| **Moomaa-tribe** | Friends, community members | ~50-100 |
| **Business** | Course participants, retreat guests | ~100-200 |
| **Dual-cohort** | Rare users in both (separate views) | <10 |

### 2.2 Channel Types

| Type | Visibility | Encryption | Admin In Room | Max Members |
|------|------------|------------|---------------|-------------|
| **Common Rooms** | Listed to cohort | Transport only | Yes | 100 |
| **Event Channels** | Toggleable visibility | Transport only | Yes | 100 |
| **Private Course Rooms** | Listed to cohort | E2E (NIP-44) | Yes (implicit read) | 40-100 |
| **Direct Messages** | Private | E2E (NIP-44) | No | 2 |

### 2.3 Scale Parameters

- **Total users:** Low hundreds (max ~300 lifetime)
- **Concurrent users:** ~12 peak
- **Messages/day:** Tens (10-50)
- **Storage:** Small footprint, cloud-backupable

---

## 3. Functional Requirements

### 3.1 User Onboarding

```
FR-001: Instant signup with BIP-39 mnemonic generation (12 words)
FR-002: Copy-to-clipboard mnemonic backup (no verification required)
FR-003: Browser localStorage for key persistence
FR-004: New account creation available (loses old identity)
FR-005: Progressive feature disclosure (3 tiers)
```

### 3.2 Channel Management

```
FR-010: Cohort-based channel listing (business vs moomaa-tribe)
FR-011: Channel discovery with name + description preview
FR-012: Request-to-join workflow for private channels
FR-013: Admin approval required for all channel joins
FR-014: New members see full message history
FR-015: Event channels can toggle "visible to non-members" (preview only)
FR-016: Channel archival/visibility toggle (hide from listing)
```

### 3.3 Messaging

```
FR-020: Real-time message delivery via WebSocket
FR-021: Message history persistence on local relay
FR-022: User message deletion (local relay respects NIP-09)
FR-023: Admin message deletion capability
FR-024: E2E encryption for private rooms (NIP-44)
FR-025: Gift-wrapped DMs for metadata protection (NIP-59)
```

### 3.4 Administration

```
FR-030: Admin portal for user/channel management
FR-031: Approve/reject join requests
FR-032: Kick user from channel
FR-033: Ban user from channel (persistent)
FR-034: Revoke pubkey from entire system
FR-035: View pending join requests queue
FR-036: No automated moderation required
```

### 3.5 Direct Messages

```
FR-040: E2E encrypted DMs between any two users
FR-041: DMs route through local relay by default
FR-042: Optional: Users MAY use external Nostr clients for DMs
FR-043: Admin has NO access to DM content
```

---

## 4. Non-Functional Requirements

### 4.1 Security

```
NFR-001: All channel messages E2E encrypted (private rooms)
NFR-002: Transport encryption (WSS) for all relay communication
NFR-003: No user PII stored (pubkey only)
NFR-004: Local relay does NOT federate to public relays
NFR-005: Mnemonic never transmitted to server
```

### 4.2 Performance

```
NFR-010: Message delivery <500ms (local network)
NFR-011: Support 12 concurrent WebSocket connections
NFR-012: Relay storage <1GB for first 2 years
```

### 4.3 Availability

```
NFR-020: PWA with offline message queue
NFR-021: Graceful degradation on connectivity loss
NFR-022: Daily incremental backups to cloud storage
```

### 4.4 Compatibility

```
NFR-030: Mobile-responsive PWA (iOS Safari, Android Chrome)
NFR-031: Desktop browsers (Chrome, Firefox, Safari)
NFR-032: Optional push notifications (nice-to-have)
```

---

## 5. NIP Mapping

| Requirement | NIP | Notes |
|-------------|-----|-------|
| Key derivation | NIP-06 | BIP-39 mnemonic → secp256k1 |
| Basic events | NIP-01 | Event structure, relay protocol |
| Channel messages | NIP-29 | Relay-enforced groups |
| E2E encryption | NIP-44 | Versioned encryption |
| Gift-wrap DMs | NIP-59 | Metadata protection |
| Private groups | NIP-17 | Alternative for small encrypted groups |
| Message deletion | NIP-09 | Deletion events |
| Relay auth | NIP-42 | Challenge-response auth |
| Relay info | NIP-11 | Relay metadata |

---

## 6. User Stories

### 6.1 Onboarding

```gherkin
US-001: New User Signup
AS A new visitor
I WANT TO create an account instantly
SO THAT I can start chatting without friction

GIVEN I am on the signup page
WHEN I click "Create Account"
THEN a 12-word mnemonic is generated and displayed
AND I am prompted to copy it to a safe place
AND my keys are stored in browser localStorage
AND I am redirected to channel discovery
```

### 6.2 Channel Discovery

```gherkin
US-010: Discover Channels
AS A logged-in user
I WANT TO see available channels for my cohort
SO THAT I can find relevant conversations

GIVEN I am authenticated with cohort "moomaa-tribe"
WHEN I view the channel list
THEN I see only channels tagged for moomaa-tribe
AND each channel shows name and description
AND I see a "Request to Join" button for non-member channels
```

### 6.3 Join Request

```gherkin
US-020: Request Channel Access
AS A user
I WANT TO request access to a private channel
SO THAT an admin can approve my membership

GIVEN I am viewing a channel I'm not a member of
WHEN I click "Request to Join"
THEN my request is queued for admin approval
AND I see "Pending Approval" status
AND the admin receives a notification
```

### 6.4 Admin Approval

```gherkin
US-030: Approve Join Request
AS AN admin
I WANT TO review and approve join requests
SO THAT I control channel membership

GIVEN I am in the admin portal
WHEN I view pending requests
THEN I see user pubkey, requested channel, timestamp
AND I can approve or reject each request
AND approved users immediately gain channel access
```

---

## 7. Cohort Visibility Matrix

| Channel | Moomaa-tribe | Business | Dual-cohort |
|---------|--------------|----------|-------------|
| General Chat | ✓ Listed | ✗ Hidden | ✓ (moomaa) |
| Retreat Updates | ✓ Listed | ✓ Listed | ✓ (both) |
| Course: Batch 2024A | ✗ Hidden | ✓ Listed | ✓ (business) |
| Private: Founders | ✓ Listed | ✗ Hidden | ✓ (moomaa) |
| Event: Summer 2025 | ✓ Preview* | ✓ Preview* | ✓ (both) |

*Preview = visible but read-only until approved member*

---

## 8. Open Questions (Requiring Answers)

### Q1: DM Routing Architecture
DMs route through local relay but are E2E encrypted. If a user wants to use an external Nostr client:
- **(a)** Do they connect to YOUR relay with external client?
- **(b)** Do they federate to public relays entirely outside your system?
- **(c)** Is external client usage explicitly unsupported?

**Recommendation:** Option (a) - allow external clients connecting to your relay only.

### Q2: Cohort Switching UX
For rare dual-cohort users:
- **(a)** Single UI with combined channel list?
- **(b)** Toggle/dropdown to switch cohort view?
- **(c)** Separate "workspaces" like Slack?

**Recommendation:** Option (b) - simple dropdown toggle.

### Q3: Admin Structure
- **(a)** Single super-admin?
- **(b)** Multiple equal admins?
- **(c)** Per-channel moderators + global admin?

**Recommendation:** Start with (a), design for (b).

### Q4: Channel Description Preview
For "request to join" channels:
- **(a)** Name only?
- **(b)** Name + description?
- **(c)** Name + description + member count?

**Recommendation:** Option (c) for informed decisions.

---

## 9. Out of Scope (v1.0)

- SSO with booking system
- Automated enrollment from course registration
- Bitcoin/Lightning payments (future: LNbits integration)
- RGB protocol stablecoins
- Native mobile apps (PWA only)
- Public relay federation
- Automated moderation/spam detection
- Voice/video chat
- File sharing beyond images

---

## 10. Success Criteria

| Metric | Target |
|--------|--------|
| Signup completion rate | >90% |
| Message delivery latency | <500ms |
| Admin approval turnaround | <24 hours |
| PWA install rate | >50% of mobile users |
| System uptime | 99% (self-hosted) |

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Cohort** | User group determining channel visibility (business/moomaa-tribe) |
| **Pubkey** | User's public key (Nostr identity) |
| **Mnemonic** | 12-word backup phrase for key recovery |
| **NIP** | Nostr Implementation Possibility (protocol standard) |
| **E2E** | End-to-end encryption |
| **PWA** | Progressive Web App |
| **Gift-wrap** | NIP-59 metadata protection for messages |

---

## Appendix B: Reference Documents

- [NIP-06: Key Derivation](https://github.com/nostr-protocol/nips/blob/master/06.md)
- [NIP-17: Private Direct Messages](https://github.com/nostr-protocol/nips/blob/master/17.md)
- [NIP-29: Relay-based Groups](https://github.com/nostr-protocol/nips/blob/master/29.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [NIP-59: Gift Wrap](https://github.com/nostr-protocol/nips/blob/master/59.md)

---

*Next Phase: Architecture Document (02-architecture.md)*
