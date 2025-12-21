---
title: Configuration Reference
description: Complete configuration schemas, environment variables, and application settings for Nostr-BBS
category: reference
tags: [setup, deployment, api]
---

# Configuration Reference

**Version:** 1.0.0
**Date:** 2025-12-20
**Status:** Production

[← Back to Documentation Hub](../INDEX.md) | [← Back to API Reference](api-reference.md)

---

## Overview

This document consolidates all configuration schemas, environment variables, and application settings used in Nostr-BBS.

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Section Configuration](#section-configuration)
3. [Permission System](#permission-system)
4. [Deployment Configuration](#deployment-configuration)
5. [Feature Flags](#feature-flags)

---

## Environment Variables

### Client Environment

**Location:** `.env` (development) or build configuration (production)

```bash
# Relay Configuration
PUBLIC_RELAY_URL=wss://relay.example.com
PUBLIC_RELAY_WS_URL=wss://relay.example.com

# API Endpoints
PUBLIC_EMBEDDING_API_URL=https://api.example.com/embed
PUBLIC_GCS_EMBEDDINGS_URL=https://storage.googleapis.com/bucket/embeddings

# Frontend URL (for redirects, OG tags, etc.)
PUBLIC_FRONTEND_URL=https://nostr-bbs.example.com

# Feature Flags
PUBLIC_ENABLE_SEMANTIC_SEARCH=true
PUBLIC_ENABLE_CALENDAR=true
PUBLIC_ENABLE_PWA=true

# Debug/Development
PUBLIC_DEBUG_MODE=false
PUBLIC_LOG_LEVEL=info
```

### Server Environment (Relay)

**Location:** `/services/nostr-relay/.env`

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/nostr_relay
DB_POOL_SIZE=20

# Relay Configuration
RELAY_NAME="Nostr BBS Relay"
RELAY_DESCRIPTION="Private relay for Nostr BBS"
RELAY_PUBKEY=<relay-admin-pubkey>
RELAY_CONTACT=admin@example.com

# Port Configuration
PORT=3000
WS_PORT=3000

# Security
ENABLE_AUTH=true
REQUIRE_AUTH_FOR_WRITE=true
REQUIRE_AUTH_FOR_READ=false

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_MAX_EVENTS_PER_MIN=30

# Whitelist
WHITELIST_MODE=strict
WHITELIST_FILE=/data/whitelist.json

# NIP Support
SUPPORTED_NIPS=1,9,11,17,29,42,44,50,52,59

# Storage
MAX_EVENT_SIZE=65536
MAX_EVENTS_PER_USER=10000
RETENTION_DAYS=365

# Performance
ENABLE_QUERY_CACHE=true
CACHE_TTL_SECONDS=300
```

### Embedding Service

**Location:** `/services/embedding-api/.env`

```bash
# Model Configuration
MODEL_NAME=all-MiniLM-L6-v2
MODEL_DIMENSIONS=384
MODEL_MAX_LENGTH=256

# API Configuration
PORT=8000
ENABLE_CORS=true

# Cache
ENABLE_MODEL_CACHE=true
CACHE_SIZE_MB=512

# Performance
BATCH_SIZE=32
MAX_CONCURRENT_REQUESTS=10
```

---

## Section Configuration

**Location:** `/config/sections.yaml`

### Schema Definition

```typescript
interface SectionsConfig {
  app: AppConfig;
  superuser?: SuperuserConfig;
  deployment?: DeploymentConfig;
  roles: RoleConfig[];
  cohorts: CohortConfig[];
  sections: SectionConfig[];
  calendarAccessLevels: CalendarAccessLevelConfig[];
  channelVisibility: ChannelVisibilityConfig[];
}
```

### App Configuration

```yaml
app:
  name: "Nostr BBS"
  version: "1.0.0"
  defaultSection: "general"
```

```typescript
interface AppConfig {
  name: string;
  version: string;
  defaultSection: SectionId;
}
```

---

### Superuser Configuration

```yaml
superuser:
  pubkey: "7f8e1c3a..." # Hex-encoded public key
  name: "Admin"
  relayUrl: "wss://relay.example.com"
```

```typescript
interface SuperuserConfig {
  pubkey: string;      // Admin's public key
  name: string;        // Display name
  relayUrl?: string;   // Optional relay override
}
```

**Superuser Privileges:**
- Bypass all whitelist checks
- Access all sections automatically
- Admin role in all channels
- Can modify section configuration
- Can manage all users

---

### Deployment Configuration

```yaml
deployment:
  relayUrl: "wss://relay.example.com"
  embeddingApiUrl: "https://api.example.com/embed"
  gcsEmbeddingsUrl: "https://storage.googleapis.com/bucket"
  frontendUrl: "https://nostr-bbs.example.com"
```

```typescript
interface DeploymentConfig {
  relayUrl?: string;
  embeddingApiUrl?: string;
  gcsEmbeddingsUrl?: string;
  frontendUrl?: string;
}
```

**Override Priority:**
1. Environment variables (highest)
2. sections.yaml deployment config
3. Default values (lowest)

---

### Role Configuration

```yaml
roles:
  - id: guest
    name: "Guest"
    level: 0
    description: "Unauthenticated user"
    capabilities: []

  - id: member
    name: "Member"
    level: 1
    description: "Regular authenticated user"
    capabilities:
      - read_messages
      - send_messages
      - react_to_messages

  - id: moderator
    name: "Moderator"
    level: 2
    description: "Can moderate content"
    capabilities:
      - read_messages
      - send_messages
      - react_to_messages
      - delete_messages
      - mute_users

  - id: section-admin
    name: "Section Admin"
    level: 3
    description: "Admin within specific section"
    capabilities:
      - read_messages
      - send_messages
      - react_to_messages
      - delete_messages
      - mute_users
      - manage_channels
      - manage_section_users

  - id: admin
    name: "Administrator"
    level: 4
    description: "Full system admin"
    capabilities:
      - "*" # All capabilities
```

```typescript
type RoleId = 'guest' | 'member' | 'moderator' | 'section-admin' | 'admin';

interface RoleConfig {
  id: RoleId;
  name: string;
  level: number;       // Hierarchy level (0-4)
  description: string;
  capabilities?: string[];
}
```

**Capability System:**
- Higher level roles inherit lower level capabilities
- `"*"` grants all capabilities
- Custom capabilities can be defined

---

### Cohort Configuration

```yaml
cohorts:
  - id: cohort-a
    name: "Cohort Alpha"
    description: "First group"

  - id: cohort-b
    name: "Cohort Beta"
    description: "Second group"

  - id: cohort-c
    name: "Cohort Charlie"
    description: "Third group"
```

```typescript
type CohortId = string;

interface CohortConfig {
  id: CohortId;
  name: string;
  description: string;
}
```

**Usage:**
- Restrict channel visibility to specific cohorts
- Grant section access by cohort membership
- Calendar event visibility based on cohort

---

### Section Configuration

```yaml
sections:
  - id: general
    name: "General"
    description: "Public discussion area"
    icon: "💬"
    order: 1
    access:
      requiresApproval: false
      defaultRole: member
      autoApprove: true
    features:
      showStats: true
      allowChannelCreation: true
      calendar:
        access: full
        canCreate: true
        cohortRestricted: false
    ui:
      color: "#3B82F6"

  - id: private
    name: "Private Section"
    description: "Members-only area"
    icon: "🔒"
    order: 2
    access:
      requiresApproval: true
      defaultRole: member
      autoApprove: false
      requiredCohorts:
        - cohort-a
    features:
      showStats: false
      allowChannelCreation: false
      calendar:
        access: cohort
        canCreate: true
        cohortRestricted: true
    ui:
      color: "#EF4444"
```

```typescript
type SectionId = string;

interface SectionConfig {
  id: SectionId;
  name: string;
  description: string;
  icon: string;           // Emoji or icon identifier
  order: number;          // Display order
  access: SectionAccessConfig;
  features: SectionFeaturesConfig;
  ui: SectionUIConfig;
}

interface SectionAccessConfig {
  requiresApproval: boolean;    // Require admin approval
  defaultRole: RoleId;          // Role granted on access
  autoApprove: boolean;         // Auto-approve requests
  requiredCohorts?: CohortId[]; // Required cohort membership
}

interface SectionFeaturesConfig {
  showStats: boolean;           // Show channel statistics
  allowChannelCreation: boolean; // Users can create channels
  calendar: SectionCalendarConfig;
}

interface SectionCalendarConfig {
  access: CalendarAccessLevel;
  canCreate: boolean;           // Users can create events
  cohortRestricted?: boolean;   // Restrict to cohort members
}

interface SectionUIConfig {
  color: string; // Hex color for theming
}
```

---

### Calendar Access Levels

```yaml
calendarAccessLevels:
  - id: full
    name: "Full Access"
    description: "Can view all event details"
    canView: true
    canViewDetails: true

  - id: availability
    name: "Availability Only"
    description: "Can see when events occur, not details"
    canView: true
    canViewDetails: false

  - id: cohort
    name: "Cohort Only"
    description: "Can view events for their cohort"
    canView: true
    canViewDetails: cohort-match

  - id: none
    name: "No Access"
    description: "Cannot view calendar"
    canView: false
    canViewDetails: false
```

```typescript
type CalendarAccessLevel = 'full' | 'availability' | 'cohort' | 'none';

interface CalendarAccessLevelConfig {
  id: CalendarAccessLevel;
  name: string;
  description: string;
  canView: boolean;
  canViewDetails: boolean | 'cohort-match';
}
```

**Access Level Behavior:**
- **full:** See all events with full details
- **availability:** See event times, but not titles/descriptions
- **cohort:** See only events for user's cohort(s)
- **none:** Calendar hidden entirely

---

### Channel Visibility

```yaml
channelVisibility:
  - id: public
    name: "Public"
    description: "Visible to all section members"

  - id: cohort
    name: "Cohort Only"
    description: "Visible only to specific cohorts"

  - id: invite
    name: "Invite Only"
    description: "Visible only to invited members"
```

```typescript
type ChannelVisibility = 'public' | 'cohort' | 'invite';

interface ChannelVisibilityConfig {
  id: ChannelVisibility;
  name: string;
  description: string;
}
```

**Visibility Rules:**
- **public:** All section members can see and join
- **cohort:** Only users in specified cohorts can see
- **invite:** Only explicitly invited users can see

---

## Permission System

### Permission Types

```typescript
interface UserPermissions {
  pubkey: string;
  cohorts: CohortId[];
  globalRole: RoleId;
  sectionRoles: UserSectionRole[];
}

interface UserSectionRole {
  sectionId: SectionId;
  role: RoleId;
  assignedAt: number;
  assignedBy?: string; // Pubkey of assigner
}
```

### Permission Resolution

```typescript
// Check capability
function hasCapability(
  user: UserPermissions,
  capability: string,
  sectionId?: SectionId
): boolean {
  // 1. Check superuser
  if (isSuperuser(user.pubkey)) return true;

  // 2. Check global admin
  if (user.globalRole === 'admin') return true;

  // 3. Check section role
  if (sectionId) {
    const sectionRole = user.sectionRoles.find(
      r => r.sectionId === sectionId
    );
    if (sectionRole && hasRoleCapability(sectionRole.role, capability)) {
      return true;
    }
  }

  // 4. Check global role
  return hasRoleCapability(user.globalRole, capability);
}
```

### Role Hierarchy

```
admin (4)
  ├─ All capabilities
  └─ Can manage all sections

section-admin (3)
  ├─ manage_channels
  ├─ manage_section_users
  ├─ delete_messages
  ├─ mute_users
  └─ Inherits moderator capabilities

moderator (2)
  ├─ delete_messages
  ├─ mute_users
  └─ Inherits member capabilities

member (1)
  ├─ read_messages
  ├─ send_messages
  └─ react_to_messages

guest (0)
  └─ No capabilities
```

---

## Deployment Configuration

### Production Build

**vite.config.ts:**

```typescript
export default defineConfig({
  build: {
    target: 'es2020',
    outDir: 'build',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['svelte', '@nostr-dev-kit/ndk'],
          'nostr': ['nostr-tools'],
          'crypto': ['@noble/curves', '@noble/hashes']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['@nostr-dev-kit/ndk'],
    esbuildOptions: {
      target: 'es2020'
    }
  }
});
```

---

### Docker Configuration

**Environment variables passed to container:**

```yaml
# docker-compose.yml
version: '3.8'
services:
  nostr-bbs:
    image: nostr-bbs:latest
    environment:
      - PUBLIC_RELAY_URL=wss://relay.example.com
      - PUBLIC_EMBEDDING_API_URL=https://api.example.com
      - NODE_ENV=production
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config:ro
```

---

### Relay Configuration

**relay.json (NIP-11):**

```json
{
  "name": "Nostr BBS Relay",
  "description": "Private relay for Nostr BBS application",
  "pubkey": "7f8e1c3a...",
  "contact": "admin@example.com",
  "supported_nips": [1, 9, 11, 17, 29, 42, 44, 50, 52, 59],
  "software": "nostr-rs-relay",
  "version": "0.8.0",
  "limitation": {
    "max_message_length": 65536,
    "max_subscriptions": 20,
    "max_filters": 10,
    "max_limit": 5000,
    "max_subid_length": 256,
    "max_event_tags": 2000,
    "max_content_length": 65536,
    "min_pow_difficulty": 0,
    "auth_required": true,
    "payment_required": false
  },
  "retention": [
    {"kinds": [0, 3], "time": null},
    {"kinds": [1, 9], "time": 31536000},
    {"time": 2592000}
  ],
  "relay_countries": ["US"],
  "language_tags": ["en"],
  "tags": ["private", "curated"],
  "posting_policy": "https://example.com/posting-policy"
}
```

---

## Feature Flags

### Client-Side Flags

**Location:** `/src/lib/config/features.ts`

```typescript
interface FeatureFlags {
  semanticSearch: boolean;
  calendar: boolean;
  pwa: boolean;
  notifications: boolean;
  linkPreviews: boolean;
  reactions: boolean;
  threading: boolean;
  encryption: boolean;
  debugging: boolean;
}

export const features: FeatureFlags = {
  semanticSearch: import.meta.env.PUBLIC_ENABLE_SEMANTIC_SEARCH === 'true',
  calendar: import.meta.env.PUBLIC_ENABLE_CALENDAR === 'true',
  pwa: import.meta.env.PUBLIC_ENABLE_PWA === 'true',
  notifications: true,
  linkPreviews: true,
  reactions: true,
  threading: true,
  encryption: true,
  debugging: import.meta.env.PUBLIC_DEBUG_MODE === 'true'
};
```

### Usage in Components

```svelte
<script>
import { features } from '$lib/config/features';
</script>

{#if features.semanticSearch}
  <SemanticSearch />
{/if}

{#if features.calendar}
  <CalendarView />
{/if}
```

---

## Configuration Validation

### Schema Validation

**Location:** `/src/lib/config/validation.ts`

```typescript
import Ajv from 'ajv';

const sectionsSchema = {
  type: 'object',
  required: ['app', 'roles', 'sections'],
  properties: {
    app: {
      type: 'object',
      required: ['name', 'version', 'defaultSection'],
      properties: {
        name: { type: 'string' },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
        defaultSection: { type: 'string' }
      }
    },
    roles: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'level', 'description'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          level: { type: 'number', minimum: 0, maximum: 4 },
          description: { type: 'string' },
          capabilities: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    },
    sections: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'description', 'icon', 'order', 'access', 'features', 'ui'],
        // ... full section schema
      }
    }
  }
};

const ajv = new Ajv();
const validate = ajv.compile(sectionsSchema);

export function validateSectionsConfig(config: unknown): boolean {
  const valid = validate(config);
  if (!valid) {
    console.error('Configuration errors:', validate.errors);
  }
  return valid;
}
```

---

## Runtime Configuration

### Configuration Loading

**Location:** `/src/lib/config/loader.ts`

```typescript
import { browser } from '$app/environment';
import yaml from 'js-yaml';

let cachedConfig: SectionsConfig | null = null;

export async function loadConfig(): Promise<SectionsConfig> {
  if (cachedConfig) return cachedConfig;

  const response = await fetch('/config/sections.yaml');
  const yamlText = await response.text();
  const config = yaml.load(yamlText) as SectionsConfig;

  // Validate
  if (!validateSectionsConfig(config)) {
    throw new Error('Invalid configuration');
  }

  // Merge with environment overrides
  if (browser) {
    config.deployment = {
      ...config.deployment,
      relayUrl: import.meta.env.PUBLIC_RELAY_URL || config.deployment?.relayUrl,
      embeddingApiUrl: import.meta.env.PUBLIC_EMBEDDING_API_URL || config.deployment?.embeddingApiUrl
    };
  }

  cachedConfig = config;
  return config;
}
```

---

## Best Practices

### 1. Environment-Specific Configuration

✅ **Use environment variables for deployment-specific values:**
```bash
# Development
PUBLIC_RELAY_URL=ws://localhost:8080

# Production
PUBLIC_RELAY_URL=wss://relay.production.com
```

---

### 2. Validation on Load

✅ **Always validate configuration:**
```typescript
const config = await loadConfig();
if (!validateSectionsConfig(config)) {
  throw new Error('Configuration failed validation');
}
```

---

### 3. Type Safety

✅ **Use TypeScript interfaces:**
```typescript
// Type-safe configuration access
const section: SectionConfig = config.sections.find(
  s => s.id === sectionId
);
```

---

### 4. Immutable Configuration

✅ **Freeze configuration objects:**
```typescript
export const config: Readonly<SectionsConfig> = Object.freeze(loadedConfig);
```

---

## Related Documentation

- [API Reference](api-reference.md) - API documentation
- [Deployment Guide](../deployment/DEPLOYMENT.md) - Deployment instructions
- [Architecture Overview](../architecture/02-architecture.md) - System architecture

---

**Document Version:** 1.0.0
**Last Updated:** 2025-12-20
**Maintained by:** Configuration Team
