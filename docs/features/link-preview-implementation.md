[← Back to Main README](../README.md)

# Link Preview Implementation (Phase 2.4)

## Overview

Comprehensive link preview and media embed system for Minimoonoir Nostr, featuring automatic URL detection, OpenGraph metadata fetching, rich media embeds, and user preferences.

## Components

### 1. URL Detection Utilities (`src/lib/utils/linkPreview.ts`)

**Functions:**
- `extractUrls(text)` - Extract all URLs from message text
- `isImageUrl(url)` - Detect direct image links (.jpg, .png, .gif, .webp, etc.)
- `isVideoUrl(url)` - Detect video links (.mp4, .webm, .mov, etc.)
- `isYouTubeUrl(url)` - Detect YouTube URLs
- `parseYouTubeId(url)` - Extract YouTube video ID
- `getDomain(url)` - Get clean domain name
- `getFaviconUrl(url)` - Generate favicon URL
- `getMediaType(url)` - Determine media type (image/video/youtube/link)

**Features:**
- Supports both http:// and https:// protocols
- Handles query parameters correctly
- Case-insensitive extension matching
- URL validation and deduplication
- Extracts YouTube IDs from various URL formats:
  - youtube.com/watch?v=ID
  - youtu.be/ID
  - youtube.com/embed/ID

### 2. Link Preview Store (`src/lib/stores/linkPreviews.ts`)

**Features:**
- Fetches OpenGraph metadata from URLs
- 7-day localStorage cache (max 100 entries)
- Automatic cache expiration
- Graceful error handling
- Fallback preview data
- 5-second fetch timeout

**Cache Management:**
- Stores preview data with timestamps
- Auto-removes expired entries
- LRU eviction when cache exceeds limit
- Persists across sessions

**OpenGraph Tags Parsed:**
- og:title (with fallback to `<title>`)
- og:description (with fallback to meta description)
- og:image
- og:site_name
- Favicon (via Google favicon service)

**API:**
```typescript
fetchPreview(url: string): Promise<LinkPreviewData>
getCachedPreview(url: string): LinkPreviewData | null
clearPreviewCache(): void
```

### 3. LinkPreview Component (`src/lib/components/chat/LinkPreview.svelte`)

**Features:**
- Loading skeleton animation
- Error state handling
- Lazy loading via Intersection Observer
- Click to open in new tab
- Responsive design
- Hover effects

**Display Modes:**
1. **Loading Skeleton** - Shimmer animation while fetching
2. **Full Preview Card** - With image, title, description, domain
3. **Minimal Preview** - Just domain and URL (for errors/no metadata)

**Styling:**
- Card-based layout
- Image preview (max 200px height)
- Truncated title (2 lines max)
- Truncated description (2 lines max)
- External link icon on hover
- Smooth transitions

### 4. MediaEmbed Component (`src/lib/components/chat/MediaEmbed.svelte`)

**Supported Media Types:**

1. **Images**
   - Inline display
   - Click to open lightbox
   - Full-screen view
   - Lazy loading
   - Expand/collapse button

2. **Videos**
   - Native HTML5 video player
   - Controls enabled
   - Preload metadata only
   - Expand/collapse button

3. **YouTube**
   - Privacy-respecting lite embed
   - Thumbnail preview (hqdefault)
   - Click to load iframe
   - No cookies until user interaction
   - YouTube-nocookie.com embed
   - Auto-play on load

**Features:**
- Intersection Observer for lazy loading
- Lightbox with ESC key support
- Expand/collapse controls
- 16:9 aspect ratio maintained
- Responsive design
- Accessibility support (ARIA labels, keyboard navigation)

### 5. User Preferences (`src/lib/stores/preferences.ts`)

**Preferences:**
- `linkPreviewsEnabled` - Toggle link previews
- `mediaAutoPlay` - Auto-play videos when visible
- `theme` - Color scheme (light/dark/auto)
- `notificationsEnabled` - Desktop notifications
- `soundEnabled` - Sound effects

**Storage:**
- Persisted in localStorage
- Defaults provided for all settings
- Type-safe interface
- Reactive updates

**API:**
```typescript
preferencesStore.toggleLinkPreviews()
preferencesStore.toggleMediaAutoPlay()
preferencesStore.setTheme('light' | 'dark' | 'auto')
preferencesStore.reset()
```

### 6. PreferencesPanel Component (`src/lib/components/settings/PreferencesPanel.svelte`)

**Features:**
- Toggle switches for boolean preferences
- Dropdown for theme selection
- Reset to defaults button
- Responsive layout
- DaisyUI styling

**User Controls:**
- Link Previews on/off
- Auto-Play Media on/off
- Notifications on/off
- Sound Effects on/off
- Theme selection (Auto/Light/Dark)

### 7. MessageItem Integration

**Updated Features:**
- Automatically detects URLs in messages
- Renders appropriate component (LinkPreview or MediaEmbed)
- Max 3 previews per message
- Only shows for decrypted messages
- Respects user preference setting

**Rendering Logic:**
1. Extract URLs from message content
2. Determine media type for each URL
3. Render MediaEmbed for images/videos/YouTube
4. Render LinkPreview for regular links
5. Limit to first 3 URLs

## Performance Optimizations

1. **Lazy Loading**
   - Components use Intersection Observer
   - 100px rootMargin for preloading
   - Media only loads when visible

2. **Caching**
   - 7-day preview cache
   - LRU eviction strategy
   - localStorage persistence

3. **Debouncing**
   - Single fetch per URL
   - Cache checks before fetching
   - 5-second timeout prevents hanging

4. **Bundle Size**
   - No external dependencies
   - Native browser APIs only
   - Minimal CSS

## CORS Considerations

**Current Implementation:**
- Direct fetch to target URL
- May fail due to CORS restrictions
- Graceful fallback to minimal preview

**Production Recommendations:**
1. Implement backend proxy endpoint
2. Use OpenGraph parser service
3. Cache results server-side
4. Or use service like:
   - LinkPreview.net
   - Microlink.io
   - OpenGraph.io

## Security Considerations

1. **URL Validation**
   - Only http/https protocols
   - URL constructor validation
   - XSS prevention via sanitization

2. **Privacy**
   - YouTube embeds use youtube-nocookie.com
   - No tracking until user interaction
   - User can disable previews entirely

3. **Content Safety**
   - Images/videos from user-shared URLs
   - Consider content moderation
   - Report/block functionality recommended

## User Experience

**Progressive Enhancement:**
1. Loading skeleton shown immediately
2. Preview fetched in background
3. Content streams in when ready
4. Errors handled gracefully

**Accessibility:**
- Keyboard navigation support
- ARIA labels on interactive elements
- Focus management in lightbox
- Screen reader friendly

**Mobile Responsive:**
- Touch-friendly controls
- Optimized for smaller screens
- Reduced media sizes
- Gesture support (tap to expand)

## Testing

**Unit Tests:** `tests/unit/linkPreview.test.ts`
- URL extraction
- Media type detection
- YouTube ID parsing
- Domain extraction
- Favicon URL generation

**Test Coverage:**
- ✓ Single URL extraction
- ✓ Multiple URL extraction
- ✓ URL deduplication
- ✓ Image detection
- ✓ Video detection
- ✓ YouTube detection
- ✓ Media type priority

## Usage Example

```svelte
<!-- MessageItem.svelte automatically handles this -->
<script>
  import { extractUrls, getMediaType } from '$lib/utils/linkPreview';
  import LinkPreview from './LinkPreview.svelte';
  import MediaEmbed from './MediaEmbed.svelte';

  const content = "Check this out: https://example.com/image.jpg";
  const urls = extractUrls(content);
  const mediaUrls = urls.map(url => getMediaType(url));
</script>

{#each mediaUrls as media}
  {#if media.type === 'link'}
    <LinkPreview url={media.url} />
  {:else}
    <MediaEmbed {media} />
  {/if}
{/each}
```

## Future Enhancements

1. **Backend Integration**
   - Server-side OpenGraph fetching
   - Metadata caching
   - Content moderation

2. **Additional Media Types**
   - Twitter embeds
   - Vimeo videos
   - Audio files (MP3, WAV)
   - PDF previews

3. **Advanced Features**
   - Custom preview templates
   - Preview editing
   - Thumbnail generation
   - Video transcoding

4. **Analytics**
   - Track preview clicks
   - Monitor fetch errors
   - Cache hit rates

## Files Modified/Created

**New Files:**
- `src/lib/utils/linkPreview.ts`
- `src/lib/stores/linkPreviews.ts`
- `src/lib/stores/preferences.ts`
- `src/lib/components/chat/LinkPreview.svelte`
- `src/lib/components/chat/MediaEmbed.svelte`
- `src/lib/components/settings/PreferencesPanel.svelte`
- `tests/unit/linkPreview.test.ts`
- `docs/link-preview-implementation.md`

**Modified Files:**
- `src/lib/components/chat/MessageItem.svelte`

## Configuration

No additional configuration required. All settings are user-controlled via PreferencesPanel.

## Browser Support

- Modern browsers with ES2020+ support
- Intersection Observer API
- Fetch API
- localStorage
- CSS Grid/Flexbox

**Fallbacks:**
- No Intersection Observer: Loads immediately
- No localStorage: In-memory cache only
- No Fetch: Shows URL without preview
