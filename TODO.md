# Minimoonoir Project To-Do List

This document consolidates all current tasks, issues, and planned improvements for the Minimoonoir project.

## 🚨 Critical Security Fixes
- [x] **Relay Access Control Bypass** (`relay/plugins/auth-whitelist.js`):
    - [x] Fix logic to verify `authedPubkey` against the whitelist.
    - [x] Currently accepts *any* authenticated user, bypassing the whitelist check.

## ⚠️ High Priority
- [x] **Enable PWA in Production** (`vite.config.ts`):
    - [x] Resolve `@noble/hashes` dependency conflict.
    - [x] Re-enable `VitePWA` plugin for production builds to ensure offline support and installability.
- [ ] **Consolidate Admin Configuration**:
    - [ ] Synchronize admin definitions between `.env` (Client UI) and `relay/whitelist.json` (Relay Permissions).
    - [ ] Rotate the default hardcoded placeholder key in `whitelist.json`.

## 🔸 Medium Priority
- [x] **Relay-Synced Pinned Messages**:
    - [x] Move pinned messages from `localStorage` to Relay events (NIP-51 or similar).
    - [x] Ensure pins are synchronized across all users in a channel.
- [x] **UI/UX Improvements**:
    - [x] Evaluate current UI/UX against modern standards.
    - [x] Create a prioritized list of visual and functional improvements.
    - **QX Score: 68/100 (Grade: C+)** - See `docs/qx-analysis-report.md` for full analysis
    - **23 issues identified** across accessibility, UX, mobile, design consistency, error handling
    - **Prioritized action plan** with effort estimates (100-150 hours total)

## ℹ️ Low Priority / Enhancements
- [x] **Clarify "Database Backup"**:
    - [x] Rename "Database Backup" in Admin panel to "Local Cache Export" to avoid confusion.
    - [ ] Consider implementing a true server-side backup mechanism via the Controller.
- [ ] **Cleanup Testing Values**:
    - [ ] Remove hardcoded ports (e.g., `8081`) and test mnemonics from production-adjacent code.
    - [ ] Ensure test fixtures are strictly separated from production code.

## 📝 Documentation & Process
- [ ] **Update Documentation**: Reflect changes in `IMPLEMENTATION.md` and other docs.
- [ ] **Verify CI/CD**: Ensure tests pass with the new changes.

## 🎯 UI/UX Improvement Roadmap

Based on QX analysis (`docs/qx-analysis-report.md`), prioritized improvements:

### Immediate (0-2 weeks) - Critical
- [ ] **Accessibility Fixes** (20-30 hours):
    - [ ] Add ARIA landmarks (navigation, main, log roles)
    - [ ] Fix color contrast in navigation (#667eea → #5568d3)
    - [ ] Implement keyboard focus management in modals
    - [ ] Add screen reader announcements
- [ ] **Security UX** (8-13 hours):
    - [ ] Move private key warning before reveal button
    - [ ] Add mnemonic backup confirmation flow
    - [ ] Improve nsec/npub educational tooltips
- [ ] **Error Messaging** (10-14 hours):
    - [ ] Replace generic alerts with actionable toast messages
    - [ ] Add retry mechanisms for network failures
    - [ ] Provide specific error guidance

### Short-term (2-4 weeks) - High Priority
- [ ] **Mobile Optimization** (18-26 hours):
    - [ ] Implement hamburger menu for mobile navigation
    - [ ] Fix touch target sizes (minimum 44x44px)
    - [ ] Improve textarea keyboard handling on iOS
    - [ ] Test responsive layouts on real devices
- [ ] **Onboarding Education** (12-18 hours):
    - [ ] Add contextual tooltips for Nostr concepts
    - [ ] Create first-time user tutorial
    - [ ] Explain npub/nsec in user-friendly terms
    - [ ] Add progressive disclosure for advanced features

### Long-term (1-3 months) - Medium Priority
- [ ] **Design System Consolidation** (30-40 hours):
    - [ ] Merge dual navigation systems into one component
    - [ ] Standardize button usage across app
    - [ ] Unify modal implementations
    - [ ] Create comprehensive component library docs
- [ ] **Performance Optimization** (10-15 hours):
    - [ ] Implement virtual scrolling for message lists
    - [ ] Optimize draft auto-save debouncing
    - [ ] Add lazy loading for images/media
- [ ] **Enhanced Features**:
    - [ ] Better offline experience with queue visibility
    - [ ] Form validation with user-friendly feedback
    - [ ] Loading state consistency across components

**Target QX Score After Implementation:** 85-90/100 (Grade: A-)

---
*Last Updated: 2025-12-13*