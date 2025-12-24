---
title: Fairfield Calendar System - Comprehensive Design
description: Always-visible calendar sidebar with permission-based event visibility
category: reference
tags: [calendar, fairfield, events, cohorts, permissions]
date: 2025-12-24
status: planning
---

# Fairfield Calendar System

## Vision

A persistent, always-visible calendar sidebar that serves as the **central nervous system** for community coordination. Different groups with overlapping interests can see relevant events while maintaining privacy boundaries. The calendar becomes the physical-digital bridge connecting online communities to real-world gatherings.

---

## Core Principles

1. **Always Present** - Calendar visible on every page, not buried in menus
2. **Progressive Disclosure** - See more detail as your access level increases
3. **Visual Hierarchy** - Instantly recognise event types by colour and iconography
4. **Intersection Points** - Physical events create opportunities for different cohorts to connect
5. **Privacy by Design** - Only see what you're permitted to see; blocked events show as "busy" slots

---

## Event Type Taxonomy

### Primary Categories

| Category | Icon | Description | Typical Visibility |
|----------|------|-------------|-------------------|
| **Fairfield Venue** | 🏠 | On-site events at Fairfield | Varies by event |
| **Offsite Local** | 📍 | Events in the area (not at venue) | Section-based |
| **Remote/Online** | 💻 | Virtual events, webinars | Cohort-based |
| **External** | 🌍 | Festivals, conferences elsewhere | Public or cohort |

### Sub-Categories (Tags)

```yaml
venue_events:
  - workshop        # 🔧 Hands-on learning
  - seminar         # 📚 Talks/presentations
  - social          # 🥳 Parties, gatherings
  - ceremony        # 🌸 Rituals, special occasions
  - retreat         # 🧘 Multi-day immersions
  - work_session    # 💼 Co-working, build days
  - maintenance     # 🛠️ Site work, volunteering
  - accommodation   # 🛏️ Stays, residencies

offsite_events:
  - club_night      # 🎵 Music events
  - festival        # 🎪 Larger gatherings
  - market          # 🛍️ Markets, fairs
  - nature          # 🌲 Outdoor activities
  - exhibition      # 🎨 Art shows
  - meetup          # 🤝 Informal gatherings

online_events:
  - webinar         # 🎓 Educational
  - call            # 📞 Group calls
  - stream          # 📺 Live broadcasts
  - planning        # 📋 Coordination meetings
```

---

## Visibility Model

### The Visibility Stack

Events have **layered visibility** that stacks from most restrictive to least:

```
┌─────────────────────────────────────────────┐
│  LAYER 4: Event Details                     │
│  (title, description, location, attendees)  │
│  ↓ Requires: full access OR cohort match    │
├─────────────────────────────────────────────┤
│  LAYER 3: Event Type & Icon                 │
│  (category, duration, section colour)       │
│  ↓ Requires: availability access            │
├─────────────────────────────────────────────┤
│  LAYER 2: Time Block                        │
│  ("Something is happening" - greyed out)    │
│  ↓ Requires: basic section access           │
├─────────────────────────────────────────────┤
│  LAYER 1: Empty Calendar                    │
│  (no events shown)                          │
│  ↓ Base level - always visible              │
└─────────────────────────────────────────────┘
```

### Permission Matrix

| User Status | Public Events | Section Events | Cohort Events | Private Events |
|-------------|--------------|----------------|---------------|----------------|
| Guest (not logged in) | Layer 2 (busy) | Hidden | Hidden | Hidden |
| Guest (logged in) | Layer 3 | Layer 2 | Hidden | Hidden |
| Member (section) | Layer 4 | Layer 4 | Layer 2 | Hidden |
| Member (cohort match) | Layer 4 | Layer 4 | Layer 4 | Hidden |
| Moderator | Layer 4 | Layer 4 | Layer 4 | Layer 3 |
| Admin | Layer 4 | Layer 4 | Layer 4 | Layer 4 |

### Cohort-Based Visibility Rules

```typescript
interface EventVisibilityRules {
  // Who can see this event exists (Layer 2+)
  visibleTo: {
    sections: SectionId[];      // ['public-lobby', 'community-rooms']
    cohorts: CohortId[];        // ['moomaa-tribe', 'business']
    roles: RoleId[];            // ['member', 'moderator']
    specificUsers: string[];    // [pubkey1, pubkey2]
  };

  // Who can see full details (Layer 4)
  detailsVisibleTo: {
    sections: SectionId[];
    cohorts: CohortId[];
    roles: RoleId[];
    specificUsers: string[];
  };

  // Who can RSVP
  rsvpAllowedFor: {
    cohorts: CohortId[];
    maxAttendees?: number;
    requiresApproval: boolean;
  };
}
```

---

## Colour Coding System

### Section Colours (Primary)

Using the existing section colours as base:

| Section | Colour | Use |
|---------|--------|-----|
| Public Lobby | `#6366f1` (Indigo) | Public events |
| Community Rooms | `#8b5cf6` (Purple) | Community events |
| DreamLab | `#ec4899` (Pink) | Creative/experimental |

### Event Type Colours (Secondary Overlay)

| Event Type | Colour | Opacity Pattern |
|------------|--------|-----------------|
| Workshop | `#10b981` (Emerald) | Solid left border |
| Social/Party | `#f59e0b` (Amber) | Gradient glow |
| Ceremony | `#8b5cf6` (Violet) | Dotted border |
| Work Session | `#6b7280` (Grey) | Striped pattern |
| External/Festival | `#ef4444` (Red) | Dashed border |

### Visual States

```css
/* Available - user can RSVP */
.event-available {
  opacity: 1;
  cursor: pointer;
}

/* Visible but restricted - can see details, can't RSVP */
.event-restricted {
  opacity: 0.9;
  border-style: dashed;
}

/* Busy slot - knows something exists, no details */
.event-busy {
  opacity: 0.5;
  background: repeating-linear-gradient(
    45deg,
    var(--section-color),
    var(--section-color) 2px,
    transparent 2px,
    transparent 8px
  );
}

/* Hidden entirely */
.event-hidden {
  display: none;
}
```

---

## Sidebar Component Design

### Layout Structure

```
┌──────────────────────────────────────┐
│ 📅 FAIRFIELD CALENDAR          [⚙️]  │
├──────────────────────────────────────┤
│  ◀ December 2025 ▶                   │
│  Mo Tu We Th Fr Sa Su                │
│  25 26 27 28 29 30  1                │
│   2  3  4  5  6  7  8                │
│   9 10 11 12 [13] 14 15              │  ← [13] = today
│  16 17 18 19 20 21 22                │
│  23 24 25 26 27 28 29                │
│  30 31  1  2  3  4  5                │
├──────────────────────────────────────┤
│ UPCOMING                        [+]  │
├──────────────────────────────────────┤
│ 🔧 TODAY                             │
│ ┌────────────────────────────────┐   │
│ │ 14:00 Workshop: Intro to...    │   │
│ │ 📍 Fairfield Main Room         │   │
│ │ 👥 8/12 attending              │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ 🎵 TOMORROW                          │
│ ┌────────────────────────────────┐   │
│ │ 20:00 Club Night @ [REDACTED]  │   │
│ │ 🔒 Cohort: moomaa-tribe        │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ 🎪 THIS WEEKEND                      │
│ ┌────────────────────────────────┐   │
│ │ ▓▓▓▓▓ Private Event ▓▓▓▓▓▓▓▓   │   │  ← Busy slot (no access)
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │ 🧘 Solstice Retreat            │   │
│ │ Dec 21-23 • 5 spots left       │   │
│ │ [RSVP]                         │   │
│ └────────────────────────────────┘   │
├──────────────────────────────────────┤
│ FILTERS                              │
│ ┌────────────────────────────────┐   │
│ │ [x] 🏠 Fairfield Venue         │   │
│ │ [x] 📍 Local Area              │   │
│ │ [ ] 💻 Online                  │   │
│ │ [ ] 🌍 External                │   │
│ └────────────────────────────────┘   │
│ ┌────────────────────────────────┐   │
│ │ [x] 👋 Public Lobby            │   │  ← Section filters
│ │ [x] 🌙 Community Rooms         │   │
│ │ [x] ✨ DreamLab                │   │
│ └────────────────────────────────┘   │
└──────────────────────────────────────┘
```

### Responsive Behaviour

| Breakpoint | Behaviour |
|------------|-----------|
| Desktop (>1200px) | Full sidebar, always visible |
| Tablet (768-1200px) | Collapsible sidebar, toggle button |
| Mobile (<768px) | Bottom sheet, swipe up to reveal |

### Sidebar States

1. **Expanded** (default desktop) - Full calendar + upcoming events
2. **Collapsed** - Just today's date + event count badge
3. **Mini** - Floating badge showing "3 events today"
4. **Hidden** - User preference to hide entirely

---

## Feature Set

### Phase 1: Core Calendar Sidebar (MVP)

- [ ] Always-visible sidebar component
- [ ] Mini month calendar view
- [ ] Upcoming events list (next 7 days)
- [ ] Basic section-based colour coding
- [ ] Click to expand/view full calendar page
- [ ] Permission-based visibility (full/busy/hidden)
- [ ] Mobile responsive (bottom sheet)

### Phase 2: Enhanced Visibility

- [ ] Cohort-based event filtering
- [ ] Visual states for access levels (available/restricted/busy)
- [ ] Event type icons and categorisation
- [ ] "Busy" slot display for hidden events
- [ ] Quick RSVP from sidebar
- [ ] Event count badges per section

### Phase 3: Event Creation & Management

- [ ] Create event modal from sidebar [+] button
- [ ] Event type selector with templates
- [ ] Visibility rule builder (who can see/RSVP)
- [ ] Location picker (Fairfield rooms, external venues)
- [ ] Recurring event support
- [ ] Linked chatroom creation

### Phase 4: Advanced Features

- [ ] Calendar sync (iCal export per section)
- [ ] Email/push notifications for upcoming events
- [ ] Conflict detection (double-booking)
- [ ] Capacity management and waitlists
- [ ] Event check-in (for on-site events)
- [ ] Analytics (attendance patterns, popular times)

### Phase 5: Community Features

- [ ] Event discovery feed
- [ ] "Events you might like" recommendations
- [ ] Event series/programmes
- [ ] Co-hosting (multiple cohorts)
- [ ] Event templates library
- [ ] Integration with booking/payment systems

---

## Data Model Extensions

### Extended CalendarEvent

```typescript
interface FairfieldEvent extends CalendarEvent {
  // Location specifics
  venue: {
    type: 'fairfield' | 'offsite' | 'online' | 'external';
    room?: string;           // 'main-room', 'garden', 'kitchen'
    address?: string;        // For offsite events
    coordinates?: [number, number];
    virtualLink?: string;    // Zoom/Meet/etc.
  };

  // Event categorisation
  category: {
    primary: EventCategory;  // workshop, social, ceremony, etc.
    tags: string[];          // Additional tags
    isPublicListing: boolean; // Show in public feed
  };

  // Visibility rules (extended)
  visibility: EventVisibilityRules;

  // Attendance
  attendance: {
    maxCapacity?: number;
    currentCount: number;
    waitlistEnabled: boolean;
    requiresApproval: boolean;
    ticketPrice?: number;    // 0 = free
  };

  // Recurrence
  recurrence?: {
    pattern: RecurrencePattern;
    endDate?: number;
    exceptions: number[];    // Dates to skip
  };

  // Links
  linkedResources: {
    chatRoomId?: string;
    channelId: string;
    externalLinks: string[];
    documents: string[];     // Attached files
  };

  // Metadata
  meta: {
    createdAt: number;
    updatedAt: number;
    createdBy: string;
    lastModifiedBy: string;
    status: 'draft' | 'published' | 'cancelled';
  };
}
```

### Extended Cohorts for Events

```yaml
# New cohorts to add
cohorts:
  # Existing
  - id: 'admin'
  - id: 'approved'
  - id: 'business'
  - id: 'moomaa-tribe'

  # Event-specific cohorts
  - id: 'venue-access'
    name: 'Venue Access'
    description: 'Has physical access to Fairfield'

  - id: 'workshop-facilitators'
    name: 'Workshop Facilitators'
    description: 'Can create and run workshops'

  - id: 'event-hosts'
    name: 'Event Hosts'
    description: 'Can create social events'

  - id: 'residents'
    name: 'Residents'
    description: 'Currently staying at Fairfield'

  - id: 'neighbours'
    name: 'Local Neighbours'
    description: 'Local community members'
```

---

## Integration Points

### With Existing Sections

1. **Public Lobby Calendar**
   - Shows all public events
   - Layer 3+ for all users
   - No creation rights for guests

2. **Community Rooms Calendar**
   - Section-specific events
   - Members see Layer 4
   - Members can create

3. **DreamLab Calendar**
   - Cohort-restricted by default
   - Outsiders see only "busy" slots
   - Full details for cohort members

### With Chat System

- Every event can have a linked chatroom
- Auto-create discussion channel on event creation
- Archive chat after event ends (optional)
- Event reminders posted to relevant channels

### With User Profiles

- "My Events" tab showing RSVPs
- Event history
- Hosting history
- Availability preferences

---

## Configuration Example

### Extended sections.yaml

```yaml
# Calendar feature configuration
calendar:
  enabled: true

  # Global settings
  settings:
    defaultView: 'week'
    weekStartsOn: 'monday'
    timezone: 'Europe/London'
    showWeekNumbers: true

  # Venue configuration
  venues:
    fairfield:
      name: 'Fairfield'
      rooms:
        - id: 'main-room'
          name: 'Main Room'
          capacity: 30
          color: '#6366f1'
        - id: 'garden'
          name: 'Garden'
          capacity: 50
          color: '#10b981'
        - id: 'kitchen'
          name: 'Kitchen/Dining'
          capacity: 15
          color: '#f59e0b'
        - id: 'meditation'
          name: 'Meditation Space'
          capacity: 12
          color: '#8b5cf6'

  # Event type templates
  eventTypes:
    - id: 'workshop'
      name: 'Workshop'
      icon: '🔧'
      defaultDuration: 180  # 3 hours
      defaultVisibility:
        sections: ['community-rooms']
        cohorts: []
      allowedVenues: ['main-room', 'garden']

    - id: 'social'
      name: 'Social Gathering'
      icon: '🥳'
      defaultDuration: 240  # 4 hours
      defaultVisibility:
        sections: ['public-lobby', 'community-rooms']
        cohorts: []
      allowedVenues: ['main-room', 'garden', 'kitchen']

    - id: 'ceremony'
      name: 'Ceremony/Ritual'
      icon: '🌸'
      defaultDuration: 120
      defaultVisibility:
        sections: ['dreamlab']
        cohorts: ['moomaa-tribe']
      allowedVenues: ['meditation', 'garden']

    - id: 'club-night'
      name: 'Club Night'
      icon: '🎵'
      defaultDuration: 360
      defaultVisibility:
        sections: []
        cohorts: ['moomaa-tribe', 'approved']
      allowedVenues: []  # External only

    - id: 'work-session'
      name: 'Work Session'
      icon: '💼'
      defaultDuration: 480  # 8 hours
      defaultVisibility:
        sections: ['community-rooms']
        cohorts: ['business']
      allowedVenues: ['main-room']
```

---

## UI/UX Considerations

### Colour Accessibility

- All colour combinations pass WCAG AA contrast
- Patterns used alongside colours for differentiation
- Icon-first design for event types
- Tooltips explain visibility restrictions

### Interaction Patterns

1. **Hover on event** → Quick preview popup
2. **Click on event** → Full event modal
3. **Click on date** → Day view with all events
4. **Drag on calendar** → Quick event creation (if permitted)
5. **Right-click** → Context menu (edit, delete, duplicate)

### Empty States

- "No events this week" with suggestion to explore or create
- "Events hidden" message when cohort-restricted
- "Login to see more events" for guests

### Loading States

- Skeleton calendar during fetch
- Spinner on event cards
- Optimistic updates for RSVP

---

## Implementation Order

### Sprint 1: Foundation (1 week)

1. Create `CalendarSidebar.svelte` component
2. Add to `+layout.svelte` with toggle
3. Implement mini month view
4. Fetch and display upcoming events
5. Basic section colour coding

### Sprint 2: Visibility (1 week)

1. Extend event schema with visibility rules
2. Implement permission checking for events
3. Create "busy slot" display
4. Add cohort-based filtering
5. Visual states for access levels

### Sprint 3: Event Management (1 week)

1. Event creation modal
2. Event type templates
3. Venue/room selection
4. Visibility rule builder
5. RSVP from sidebar

### Sprint 4: Polish (1 week)

1. Mobile responsive design
2. Calendar preferences (user settings)
3. Section/type filters
4. Quick actions
5. Performance optimisation

---

## Success Metrics

- **Visibility**: 80%+ of users interact with calendar weekly
- **Event Creation**: 3+ events created per week by community
- **RSVP Rate**: 50%+ of viewed events get RSVPs
- **Cross-Cohort**: 20%+ of events visible to multiple cohorts
- **Engagement**: Average 5+ calendar interactions per session

---

## Open Questions

1. **iCal Sync**: Personal calendar integration priority?
2. **Booking System**: Integrate payments for ticketed events?
3. **Approval Workflow**: Who approves event creation?
4. **Conflict Resolution**: How to handle room double-booking?
5. **Historical Data**: Show past events? Archive after how long?
6. **External Calendars**: Pull events from external sources?

---

## Next Steps

1. Review and approve this plan
2. Create Figma mockups for sidebar component
3. Extend TypeScript types for FairfieldEvent
4. Implement Phase 1 (MVP)
5. User testing with core community
6. Iterate based on feedback
