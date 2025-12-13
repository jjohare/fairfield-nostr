# Message Drafts Auto-Save Implementation (Phase 3.2)

## Overview
Complete implementation of auto-save drafts for both channel messages and direct messages in Fairfield Nostr.

## Implementation Details

### 1. Draft Store (`/src/lib/stores/drafts.ts`)

**Features:**
- Persistent storage using localStorage (key: `fairfield-drafts`)
- Draft management for both channels and DMs
- Auto-save with debouncing
- Draft preview generation

**API Methods:**
```typescript
draftStore.saveDraft(channelId, content, isDM?)     // Save draft
draftStore.getDraft(channelId)                      // Get draft content
draftStore.clearDraft(channelId)                    // Clear after send
draftStore.hasDraft(channelId)                      // Check if draft exists
draftStore.getDraftPreview(channelId)               // Get preview (50 chars)
draftStore.getDraftChannels()                       // Get all channel IDs with drafts
draftStore.clearAllDrafts()                         // Clear all drafts
```

**Data Structure:**
```typescript
interface Draft {
  channelId: string;
  content: string;
  updatedAt: number;
  isDM?: boolean;
}
```

### 2. Draft Indicator Component (`/src/lib/components/chat/DraftIndicator.svelte`)

**Features:**
- Pencil icon for visual indication
- Tooltip showing draft preview
- Configurable tooltip position
- Warning color badge

**Usage:**
```svelte
<DraftIndicator
  draftPreview={draftStore.getDraftPreview(channelId)}
  tooltipPosition="right"
/>
```

### 3. Channel Integration

#### MessageInput.svelte
**Enhanced Features:**
- Auto-load draft on mount
- Debounced save (1 second delay)
- Save on blur
- Save on beforeunload
- Clear draft on successful send
- Visual "Draft saved" indicator

**Key Functions:**
```typescript
loadDraft(channelId)           // Load draft when channel changes
saveDraftDebounced()           // Debounced save (1s delay)
saveDraftImmediately()         // Immediate save
handleBeforeUnload()           // Save before page close
```

#### ChannelList.svelte
**Enhanced Features:**
- Draft indicator icon on channels with drafts
- Tooltip showing draft preview
- Real-time updates when drafts change

### 4. DM Integration

#### DMView.svelte
**Enhanced Features:**
- Auto-load draft on conversation change
- Debounced save (1 second delay)
- Save on blur and beforeunload
- Clear draft on successful send
- Visual "Draft saved" badge

**Key Functions:**
```typescript
loadDraft(pubkey)              // Load draft for recipient
saveDraftDebounced()           // Debounced save
saveDraftImmediately()         // Immediate save
handleInputChange()            // Trigger on input
handleBlur()                   // Save on blur
```

#### ConversationList.svelte
**Enhanced Features:**
- Draft indicator on conversations with unsaved drafts
- Draft preview tooltip
- Real-time draft updates

## User Experience

### Auto-Save Behavior
1. **Debounced Save**: Saves 1 second after user stops typing
2. **Save on Blur**: Saves immediately when user clicks away
3. **Save on Navigation**: Saves before leaving page/switching channels
4. **Clear on Send**: Removes draft after successful message send

### Visual Indicators
1. **In Message Input**: Yellow "Draft saved" badge below textarea
2. **In Channel/Conversation List**: Pencil icon with preview tooltip
3. **Tooltip Preview**: First 50 characters of draft content

## Data Persistence

### LocalStorage Structure
```json
{
  "fairfield-drafts": {
    "channel-id-1": {
      "channelId": "channel-id-1",
      "content": "Draft message content...",
      "updatedAt": 1234567890,
      "isDM": false
    },
    "pubkey-dm-1": {
      "channelId": "pubkey-dm-1",
      "content": "Draft DM content...",
      "updatedAt": 1234567891,
      "isDM": true
    }
  }
}
```

### Storage Key
- **Key**: `fairfield-drafts`
- **Scope**: Per browser/device
- **Persistence**: Survives page refresh and app restart
- **Cleanup**: Manual via `clearAllDrafts()` or automatic on send

## Implementation Files

### Created Files
1. `/src/lib/stores/drafts.ts` - Draft management store
2. `/src/lib/components/chat/DraftIndicator.svelte` - Visual indicator component

### Modified Files
1. `/src/lib/components/chat/MessageInput.svelte` - Channel message input
2. `/src/lib/components/chat/ChannelList.svelte` - Channel list with indicators
3. `/src/lib/components/dm/DMView.svelte` - DM message input
4. `/src/lib/components/dm/ConversationList.svelte` - DM list with indicators

## Testing Recommendations

### Manual Testing
1. **Draft Creation**
   - Type message in channel
   - Wait 1 second
   - Verify "Draft saved" badge appears
   - Refresh page
   - Verify draft is restored

2. **Draft Clearing**
   - Create draft
   - Send message
   - Verify draft is cleared
   - Verify indicator disappears from list

3. **Multiple Drafts**
   - Create drafts in multiple channels
   - Switch between channels
   - Verify each channel loads correct draft

4. **DM Drafts**
   - Create draft in DM conversation
   - Switch conversations
   - Verify draft persists
   - Verify indicator in conversation list

5. **Navigation**
   - Create draft
   - Switch channels
   - Return to original channel
   - Verify draft is preserved

6. **Preview Tooltip**
   - Hover over draft indicator in list
   - Verify tooltip shows preview
   - Verify preview is limited to 50 chars

### Edge Cases
1. Empty draft (should not save)
2. Very long draft (should save completely)
3. Special characters in draft
4. Multiple rapid changes (debouncing)
5. Browser storage full
6. LocalStorage disabled

## Performance Considerations

### Optimization Features
1. **Debouncing**: Prevents excessive writes (1s delay)
2. **Conditional Saves**: Only saves if content changed
3. **Lazy Loading**: Drafts loaded only when needed
4. **Efficient Storage**: JSON serialization with Map structure

### Memory Management
- Drafts stored in localStorage (not RAM)
- Store updates are reactive
- No memory leaks from event listeners (proper cleanup in onDestroy)

## Future Enhancements

### Potential Improvements
1. **Draft Expiration**: Auto-delete drafts older than X days
2. **Draft Sync**: Sync across devices (requires backend)
3. **Draft Recovery**: Restore accidentally cleared drafts
4. **Rich Text**: Support for formatting in drafts
5. **Draft Versioning**: Undo/redo for drafts
6. **Cloud Backup**: Backup to Nostr relay
7. **Draft Analytics**: Track draft usage patterns

### Known Limitations
1. **Per-Device**: Drafts don't sync across devices
2. **Storage Limit**: Subject to browser localStorage limits (~5-10MB)
3. **No Encryption**: Drafts stored in plain text locally
4. **No Conflict Resolution**: Last write wins

## Security Considerations

### Current Implementation
- Drafts stored in browser localStorage (unencrypted)
- No transmission over network
- Cleared on user logout (if implemented)

### Recommendations
1. Encrypt drafts for sensitive channels
2. Clear drafts on logout
3. Add user preference for draft retention
4. Implement draft expiration

## Accessibility

### Features
- Keyboard navigation maintained
- Screen reader friendly indicators
- Tooltip accessible via keyboard
- No impact on existing keyboard shortcuts

## Browser Compatibility

### Supported Features
- localStorage (all modern browsers)
- Svelte reactivity (all browsers)
- Event listeners (all browsers)

### Fallback Behavior
- If localStorage unavailable, drafts disabled silently
- No errors thrown to user
- Graceful degradation

## Documentation

### User Documentation
Add to user guide:
1. Drafts auto-save every second
2. Drafts persist across sessions
3. How to identify channels with drafts
4. How drafts are cleared

### Developer Documentation
- API reference in code comments
- Type definitions included
- Example usage in components
