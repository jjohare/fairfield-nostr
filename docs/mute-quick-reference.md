# Mute System Quick Reference

## File Locations

```
src/lib/
├── stores/
│   └── mute.ts                    # Core mute store
├── components/
│   ├── chat/
│   │   ├── MuteButton.svelte      # Mute toggle component
│   │   ├── MessageList.svelte     # Modified: filters muted users
│   │   └── MessageItem.svelte     # Modified: adds mute button
│   ├── user/
│   │   └── ProfileModal.svelte    # User profile with mute option
│   └── dm/
│       └── MutedConversationsList.svelte  # Muted DM conversations

src/routes/
└── settings/
    └── muted/
        └── +page.svelte           # Muted users management page
```

## API Reference

### Mute Store Methods

```typescript
import { muteStore } from '$lib/stores/mute';

// Mute a user
muteStore.muteUser(pubkey: string, reason?: string): void

// Unmute a user
muteStore.unmuteUser(pubkey: string): void

// Check if user is muted
muteStore.isMuted(pubkey: string): boolean

// Get all muted users
muteStore.getMutedUsers(): MutedUser[]

// Clear all mutes
muteStore.clearAllMutes(): void

// Get count of muted users
muteStore.getMutedCount(): number
```

### Derived Stores

```typescript
import { mutedCount, mutedUsersList, createIsMutedStore } from '$lib/stores/mute';

// Reactive count of muted users
$: count = $mutedCount

// Reactive list of all muted users
$: users = $mutedUsersList

// Reactive mute status for specific user
$: isMuted = createIsMutedStore(pubkey)
```

### DM Store Integration

```typescript
import { sortedConversations, mutedConversations } from '$lib/stores/dm';

// Get active (non-muted) conversations
$: activeConversations = $sortedConversations

// Get muted conversations
$: muted = $mutedConversations
```

## Component Usage

### MuteButton

```svelte
<script>
  import MuteButton from '$lib/components/chat/MuteButton.svelte';
</script>

<!-- Full size with label -->
<MuteButton {pubkey} />

<!-- Compact without label -->
<MuteButton {pubkey} compact={true} showLabel={false} />
```

### ProfileModal

```svelte
<script>
  import ProfileModal from '$lib/components/user/ProfileModal.svelte';

  let showProfile = false;
</script>

<ProfileModal
  {pubkey}
  name="User Name"
  avatar="https://..."
  bind:show={showProfile}
  on:close={() => showProfile = false}
  on:startDM={handleStartDM}
/>
```

### MutedConversationsList

```svelte
<script>
  import MutedConversationsList from '$lib/components/dm/MutedConversationsList.svelte';
</script>

<MutedConversationsList />
```

## Data Types

```typescript
interface MutedUser {
  pubkey: string;      // User's public key
  mutedAt: number;     // Timestamp when muted
  reason?: string;     // Optional reason for muting
}

interface MuteState {
  mutedUsers: Map<string, MutedUser>;
}
```

## localStorage Structure

**Key:** `fairfield-muted-users`

**Value:** JSON array of MutedUser objects

```json
[
  {
    "pubkey": "npub1abc...",
    "mutedAt": 1702484820000,
    "reason": "Spam"
  },
  {
    "pubkey": "npub1def...",
    "mutedAt": 1702485000000
  }
]
```

## Common Patterns

### Filter Messages

```svelte
<script>
  import { muteStore } from '$lib/stores/mute';

  $: visibleMessages = messages.filter(msg =>
    !muteStore.isMuted(msg.authorPubkey)
  );
</script>
```

### Show Muted Indicator

```svelte
<script>
  import { createIsMutedStore } from '$lib/stores/mute';

  $: isMuted = createIsMutedStore(pubkey);
</script>

{#if $isMuted}
  <span class="badge badge-error">Muted</span>
{/if}
```

### Conditional Rendering

```svelte
<script>
  import { muteStore } from '$lib/stores/mute';

  function shouldShow(pubkey: string): boolean {
    return !muteStore.isMuted(pubkey);
  }
</script>

{#each messages as msg}
  {#if shouldShow(msg.authorPubkey)}
    <MessageItem {msg} />
  {/if}
{/each}
```

## User Actions

### To Mute a User

1. **From Message:**
   - Hover over message
   - Click mute icon (eye-slash)
   - Confirm in dialog

2. **From Profile:**
   - Click user's avatar/name
   - Click "Mute User" button
   - Confirm in dialog

3. **From DM:**
   - View muted conversations section
   - Shows already muted users

### To Unmute a User

1. **From Settings:**
   - Go to `/settings/muted`
   - Click "Unmute" next to user
   - Confirm

2. **From DM List:**
   - Expand "Muted Conversations"
   - Click unmute icon

3. **Clear All:**
   - Go to `/settings/muted`
   - Click "Clear All" button
   - Confirm

## Events

### MuteButton Events

```svelte
<MuteButton
  {pubkey}
  on:muted={() => console.log('User muted')}
  on:unmuted={() => console.log('User unmuted')}
/>
```

### ProfileModal Events

```svelte
<ProfileModal
  {pubkey}
  on:close={() => console.log('Modal closed')}
  on:startDM={({detail}) => console.log('Start DM with', detail.pubkey)}
/>
```

## Testing Examples

### Check Mute Functionality

```typescript
import { muteStore } from '$lib/stores/mute';

// Mute user
muteStore.muteUser('npub1abc...', 'Testing');

// Verify muted
console.assert(muteStore.isMuted('npub1abc...') === true);

// Unmute
muteStore.unmuteUser('npub1abc...');

// Verify unmuted
console.assert(muteStore.isMuted('npub1abc...') === false);
```

### Test Persistence

```typescript
// Mute user
muteStore.muteUser('npub1abc...');

// Reload page (simulated)
localStorage.getItem('fairfield-muted-users'); // Should contain data

// Check still muted after reload
import { muteStore } from '$lib/stores/mute';
console.assert(muteStore.isMuted('npub1abc...') === true);
```

## Troubleshooting

### Messages Still Showing

- Check if `showMutedMessages` flag is enabled
- Verify pubkey format is consistent
- Check browser console for errors
- Clear localStorage and try again

### Settings Page Not Loading

- Verify route exists: `/settings/muted`
- Check for TypeScript errors
- Ensure mute store is properly imported

### Mutes Not Persisting

- Check localStorage is enabled in browser
- Verify no errors in browser console
- Check localStorage quota not exceeded
- Try different browser/incognito mode

## Performance Notes

- Mute checks use Map for O(1) lookup
- Filtering happens reactively in Svelte
- localStorage operations are synchronous
- No network requests for mute operations
- Scales well to hundreds of muted users

## Security Notes

- All data stored locally only
- No server-side mute list
- Muted users unaware they're muted
- Can be circumvented by clearing localStorage
- Not a security/privacy feature
- For content filtering only
