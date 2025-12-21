# Nostr-BBS Documentation Index

**Master documentation hub for Nostr-BBS** - A decentralised community bulletin board system built on the Nostr protocol with NIP-52 calendar events, NIP-28 public chat channels, NIP-17/59 encrypted direct messages, and AI-powered semantic search.

**Version:** 1.0.0
**Last Updated:** 2025-12-21

---

## Table of Contents

- [Getting Started](#getting-started)
- [Architecture](#architecture)
- [Features](#features)
- [Development](#development)
- [Deployment](#deployment)
- [Reference](#reference)
- [Maintenance & Quality](#maintenance--quality)

---

## Getting Started

### Quick Start Guides

**[PWA Quick Start](features/pwa-quick-start.md)**
Install Nostr-BBS as a Progressive Web App with offline support. Learn about installation, offline message queue, and background sync.

**[Search Usage Guide](features/search-usage-guide.md)**
How to use semantic vector search and keyword search to find messages by meaning, not just text matching.

**[Threading Quick Reference](features/threading-quick-reference.md)**
Quick reference for using threaded conversations in channels and direct messages.

**[Mute Quick Reference](features/mute-quick-reference.md)**
Quick guide for blocking users and managing blocked user lists.

### Tutorials

**[Icon Integration Guide](features/icon-integration-guide.md)**
Tutorial for integrating custom icons and PWA assets into the application.

**[Channel Stats Usage](features/channel-stats-usage.md)**
How to view and interpret channel statistics and metrics for community management.

---

## Architecture

### System Design (SPARC Methodology)

**[01 - Specification](architecture/01-specification.md)**
Requirements analysis, functional specifications, and project scope definition.

**[02 - Architecture](architecture/02-architecture.md)**
System architecture overview including frontend, backend, relay, and cloud services integration.

**[03 - Pseudocode](architecture/03-pseudocode.md)**
Algorithm design and pseudocode for core protocols and data flows.

**[04 - Refinement](architecture/04-refinement.md)**
Implementation refinement, optimisations, and architectural improvements.

**[05 - Completion](architecture/05-completion.md)**
Integration testing, deployment procedures, and production readiness checklist.

### Semantic Search Architecture

**[06 - Semantic Search Specification](architecture/06-semantic-search-spec.md)**
Requirements for AI-powered semantic vector search with HNSW indexing.

**[07 - Semantic Search Architecture](architecture/07-semantic-search-architecture.md)**
Embedding pipeline design using sentence-transformers and Google Cloud Run.

**[08 - Semantic Search Pseudocode](architecture/08-semantic-search-pseudocode.md)**
HNSW index algorithms, quantisation, and client-side WASM search implementation.

**[09 - Semantic Search Risks](architecture/09-semantic-search-risks.md)**
Integration risks, privacy considerations, and mitigation strategies.

### Protocol Implementation

**[Encryption Flows](architecture/encryption-flows.md)**
NIP-44 encryption, NIP-17/59 gift-wrapped DMs, and key management flows.

**[NIP Interactions](architecture/nip-interactions.md)**
How different Nostr Improvement Proposals interact in the system architecture.

---

## Features

### Messaging & Communication

**[Direct Messages Implementation](features/dm-implementation.md)**
NIP-17/59 encrypted direct messaging with gift wrap for metadata privacy.

**[Threading Implementation](features/threading-implementation.md)**
Threaded conversation system for organised discussions in channels.

**[NIP-25 Reactions Implementation](features/nip-25-reactions-implementation.md)**
Emoji reaction system for messages following NIP-25 specification.

**[Pinned Messages Implementation](features/pinned-messages-implementation.md)**
Pin important messages to channel tops for visibility.

**[Mute Implementation Summary](features/mute-implementation-summary.md)**
User blocking and muting system for controlling visible content.

### Search & Discovery

**[Search Implementation](features/search-implementation.md)**
Comprehensive search system with semantic vector search and keyword filtering.

**[Search Implementation Summary](features/search-implementation-summary.md)**
Executive summary of search capabilities and technical implementation.

**[Link Preview Implementation](features/link-preview-implementation.md)**
Automatic URL preview generation with Open Graph and metadata extraction.

### Progressive Web App

**[PWA Implementation](features/pwa-implementation.md)**
Complete Progressive Web App features including offline support, service worker, and installation.

**[Notification System Phase 1](features/notification-system-phase1.md)**
Push notification system for new messages, mentions, and events.

### Content Management

**[Drafts Implementation](features/drafts-implementation.md)**
Message draft persistence and auto-save functionality.

**[Export Implementation](features/export-implementation.md)**
Data export system for messages, profiles, and user content.

### Accessibility

**[Accessibility Improvements](features/accessibility-improvements.md)**
WCAG 2.1 Level AA compliance, keyboard navigation, and screen reader support.

---

## Development

### Development Guides

**[Mentions Patch](development/mentions-patch.md)**
Implementation details for user mention system with `@` syntax and autocomplete.

### Store Architecture

**[Store Dependency Analysis](store-dependency-analysis.md)**
Analysis of Svelte store dependencies, data flow, and state management architecture.

**[Store Reference](reference/store-reference.md)**
Complete reference for all Svelte stores including auth, channels, messages, and DM state.

---

## Deployment

### Production Deployment

**[Deployment Guide](deployment/DEPLOYMENT.md)**
Comprehensive serverless deployment guide for GitHub Pages and Google Cloud Platform.

**[GCP Deployment](deployment/GCP_DEPLOYMENT.md)**
Step-by-step Google Cloud Platform deployment for Cloud Run, Cloud Storage, and Firestore.

**[GCP Architecture](deployment/gcp-architecture.md)**
Google Cloud Platform architecture diagrams and infrastructure design.

**[GitHub Workflows](deployment/github-workflows.md)**
CI/CD pipeline configuration with GitHub Actions for automated deployments.

---

## Reference

### API Documentation

**[API Reference](reference/api-reference.md)**
Complete API documentation for all public interfaces, components, and utilities.

**[Configuration Reference](reference/configuration-reference.md)**
Environment variables, build configuration, and runtime settings reference.

**[NIP Protocol Reference](reference/nip-protocol-reference.md)**
Nostr Improvement Proposals (NIPs) implemented in the system with usage examples.

**[Store Reference](reference/store-reference.md)**
Svelte store API reference including auth, channels, messages, DM, PWA, bookmarks, drafts, and mute stores.

---

## Maintenance & Quality

### Project Maintenance

**[CONTRIBUTION.md](CONTRIBUTION.md)**
Contributing guidelines, code style, pull request process, and development workflow.

**[MAINTENANCE.md](MAINTENANCE.md)**
Maintenance procedures, dependency updates, security patches, and operational guidelines.

### Quality Assurance

**[Link Validation Summary](link-validation-summary.md)**
Executive summary of documentation link validation results (489 broken links identified).

**[Link Validation Report](link-validation-report.md)**
Detailed link validation report with broken links categorised by type.

**[Link Validation Index](link-validation-index.md)**
Index of all documentation links with validation status and recommendations.

**[Link Validation Actionable](link-validation-actionable.md)**
Actionable remediation plan for fixing broken documentation links.

**[Diagram Audit Report](diagram-audit-report.md)**
Audit of Mermaid diagrams for correctness, accessibility, and documentation alignment.

---

## Working Documents

These documents track ongoing documentation improvement efforts:

### Quality Improvement Process

**[CLEANING_SUMMARY.md](working/CLEANING_SUMMARY.md)**
Summary of documentation cleaning, validation, and quality improvement efforts.

**[Cleaning Actions Applied](working/cleaning-actions-applied.md)**
Detailed log of specific cleaning actions performed on documentation files.

**[Content Audit](working/content-audit.md)**
Content quality audit results including spelling, grammar, and consistency checks.

**[Content Cleaning Report](working/content-cleaning-report.md)**
Report on content cleaning operations with before/after metrics.

**[Corpus Analysis](working/corpus-analysis.md)**
Analysis of documentation corpus structure, coverage, and completeness.

**[Final Quality Report](working/final-quality-report.md)**
Final comprehensive quality assessment after all improvements applied.

### Infrastructure Improvements

**[Automation Setup Report](working/automation-setup-report.md)**
Setup and configuration of automated documentation quality checks.

**[Diagram Modernisation Report](working/diagram-modernisation-report.md)**
Report on upgrading Mermaid diagrams to latest syntax and best practices.

**[Metadata Implementation Report](working/metadata-implementation-report.md)**
Implementation of YAML frontmatter and metadata in documentation files.

**[Spelling Audit Report](working/spelling-audit-report.md)**
UK English spelling audit and standardisation report.

**[Structure Normalisation Report](working/structure-normalisation-report.md)**
Report on normalising document structure following Diataxis framework.

### Documentation Architecture

**[IA Architecture Spec](working/ia-architecture-spec.md)**
Information architecture specification defining documentation structure and taxonomy.

**[Link Infrastructure Spec](working/link-infrastructure-spec.md)**
Specification for link management, validation, and automated checking infrastructure.

**[Navigation Design Spec](working/navigation-design-spec.md)**
Navigation design patterns and wayfinding improvements for documentation.

**[Reference Consolidation Report](working/reference-consolidation-report.md)**
Report on consolidating and organising reference documentation.

**[Tag Vocabulary](working/tag-vocabulary.md)**
Controlled vocabulary for document tags and metadata classification.

---

## Documentation Standards

### Diataxis Framework

This documentation follows the [Diataxis framework](https://diataxis.fr/) for systematic documentation:

- **Tutorials** - Learning-oriented, step-by-step guides for beginners
- **How-to Guides** - Task-oriented, practical solutions to specific problems
- **Reference** - Information-oriented, technical descriptions of APIs and configuration
- **Explanation** - Understanding-oriented, discussion of architecture and design decisions

### Quality Standards

- **UK English** spelling and grammar throughout
- **Mermaid diagrams** for all architecture and flow visualisations
- **YAML frontmatter** with title, description, tags, and last_updated metadata
- **100% link coverage** with automated validation
- **Accessibility** - WCAG 2.1 Level AA compliance for diagrams and content

### File Organisation

```
docs/
├── INDEX.md                    # This file - master hub
├── CONTRIBUTION.md            # Contributing guidelines
├── MAINTENANCE.md             # Maintenance procedures
├── architecture/              # System design (SPARC)
├── deployment/                # Production deployment
├── development/               # Development guides
├── features/                  # Feature documentation
├── reference/                 # API and configuration
└── working/                   # Quality improvement tracking
```

---

## Quick Links

- **[Project README](../README.md)** - Main project overview with screenshots and quick start
- **[Contributing](CONTRIBUTION.md)** - How to contribute to the project
- **[License](../LICENSE)** - MIT License details
- **[GitHub Repository](https://github.com/jjohare/Nostr-BBS)** - Source code and issue tracking

---

## Support & Community

- **Documentation Issues** - Report broken links or unclear documentation via [GitHub Issues](https://github.com/jjohare/Nostr-BBS/issues)
- **Discussions** - Join community discussions at [GitHub Discussions](https://github.com/jjohare/Nostr-BBS/discussions)
- **Security** - Report security issues privately to [@jjohare](https://github.com/jjohare)

---

**Last validated:** 2025-12-21
**Link validation status:** 489 broken links identified, remediation in progress
**Documentation version:** 1.0.0
