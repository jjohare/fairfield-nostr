[← Back to Main README](../README.md)

# Notification System - Phase 1.1 Implementation

## Overview
In-app notification system for Minimoonoir Nostr that alerts users to new messages, DMs, and mentions.

## Implemented Features

### 1. Notification Store (`src/lib/stores/notifications.ts`)
- **NotificationStore**: Writable store managing notification state
- **Notification Types**: message, dm, mention, join-request, system
- **Persistence**: localStorage with 7-day retention
- **Derived Stores**:
  - `unreadNotifications`: Filtered unread notifications
  - `unreadCount`: Total unread count for badge
  - `recentNotifications`: Last 10 notifications for dropdown

#### Key Functions:
- `addNotification(type, message, options)`: Add new notification
- `markAsRead(id)`: Mark single notification as read
- `markAllAsRead()`: Mark all as read
- `clearAll()`: Clear all notifications
- `requestPermission()`: Request browser notification permission

### 2. Notification Bell Component (`src/lib/components/ui/NotificationBell.svelte`)
- Bell icon with unread count badge
- Dropdown showing recent notifications
- Click to navigate to relevant channel/DM
- Mark all read / Clear all actions
- Responsive design (mobile-friendly)
- Auto-close on outside click

### 3. Notification Integration (`src/lib/utils/notificationIntegration.ts`)
- Hooks into message store to trigger notifications
- Tracks active channel to prevent duplicate notifications
- Prevents notification spam (tracks processed message IDs)
- Prepared for Phase 2 @mention detection

#### Key Functions:
- `initializeNotificationListeners()`: Initialize message listeners
- `setActiveChannel(channelId)`: Set currently viewed channel
- `notifyNewDM()`: Trigger DM notification
- `notifyJoinRequest()`: Trigger join request notification (for admins)
- `notifySystem()`: Trigger system notification

### 4. Navigation Integration
- NotificationBell added to Navigation component
- Shows between Admin link and Logout button
- Only visible when authenticated

### 5. Layout Integration (`src/routes/+layout.svelte`)
- Initializes notification listeners on app mount
- Requests browser notification permission
- Browser notifications shown when tab not focused

## How It Works

### Message Flow:
1. New message arrives via message store subscription
2. `notificationIntegration` checks if notification should be shown:
   - Skip if from current user
   - Skip if viewing the channel where message was sent
   - Skip if already processed
3. Retrieve channel information from database
4. Check for @mentions (basic @ detection for now)
5. Create notification with appropriate type and message
6. Add to notification store
7. Show browser notification if permitted
8. Display in NotificationBell dropdown

### Active Channel Tracking:
- When user navigates to a channel, `setActiveChannel(channelId)` is called
- When user leaves channel, `setActiveChannel(null)` is called
- Prevents notifications for messages in currently viewed channel

### Storage:
- Notifications persisted to localStorage
- Auto-cleanup of notifications older than 7 days
- Survives page refreshes

## Usage

### For Users:
1. Bell icon in navigation shows unread count
2. Click bell to see recent notifications
3. Click notification to navigate to channel/DM
4. Use "Mark all read" to clear unread status
5. Use "Clear all" to remove all notifications

### For Developers:

#### Add Custom Notification:
```typescript
import { notificationStore } from '$lib/stores/notifications';

notificationStore.addNotification('system', 'Custom message', {
  url: '/path/to/page'
});
```

#### Notify DM:
```typescript
import { notifyNewDM } from '$lib/utils/notificationIntegration';

notifyNewDM(senderPubkey, senderName, 'Message preview');
```

#### Track Active Page:
```typescript
import { setActiveChannel } from '$lib/utils/notificationIntegration';

// On page mount
setActiveChannel(channelId);

// On page destroy
setActiveChannel(null);
```

## Phase 2 Enhancements (Planned)

1. **@Mention Detection**:
   - Parse message content for @username mentions
   - Match against user's name/pubkey
   - Different notification style for mentions

2. **Enhanced Browser Notifications**:
   - Rich notifications with actions
   - Click notification to focus tab and navigate

3. **Notification Settings**:
   - User preferences for notification types
   - Do Not Disturb mode
   - Notification sounds

4. **Notification History**:
   - Searchable notification log
   - Filter by type
   - Archive old notifications

5. **Real-time Indicators**:
   - Unread message counts per channel
   - Typing indicators with notifications

## Files Modified/Created

### Created:
- `src/lib/stores/notifications.ts` - Notification store
- `src/lib/components/ui/NotificationBell.svelte` - Bell component
- `src/lib/utils/notificationIntegration.ts` - Integration logic
- `docs/notification-system-phase1.md` - This documentation

### Modified:
- `src/lib/stores/index.ts` - Export notification store
- `src/lib/components/Navigation.svelte` - Add NotificationBell
- `src/routes/+layout.svelte` - Initialize notifications
- `src/routes/chat/[channelId]/+page.svelte` - Track active channel

## Testing

### Manual Testing:
1. Open app in two browser windows with different users
2. Send message in channel from window 1
3. Verify notification appears in window 2 (if not viewing that channel)
4. Click notification to navigate to channel
5. Verify notification marked as read
6. Test "Mark all read" and "Clear all" buttons
7. Verify localStorage persistence across page refresh

### Browser Notification Testing:
1. Grant notification permission when prompted
2. Send message while tab is not focused
3. Verify browser notification appears
4. Click browser notification (should focus tab)

## Known Limitations

1. Phase 1 @mention detection is basic (just checks for @ symbol)
2. No notification sound
3. No per-channel notification settings
4. Browser notifications require permission (user must grant)
5. Notifications only work when app is open (no service worker push yet)

## Performance Considerations

- Notifications auto-cleanup after 7 days
- Processed message IDs limited to last 1000
- Minimal re-renders (derived stores)
- localStorage used for persistence (async)

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Notification API support required for browser notifications
- localStorage required for persistence
- Falls back gracefully if features unavailable
