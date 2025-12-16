# Lucide Icons Integration Guide

## Overview

Lucide Icons is now integrated into Fairfield Nostr. This guide shows how to use icons throughout the application.

## Installation

```bash
npm install lucide-svelte
```

## Basic Usage

### Import Icons

```svelte
<script lang="ts">
  import { Lock, Eye, EyeOff, Key, Shield, AlertTriangle } from 'lucide-svelte';
</script>

<Lock size={24} />
<Eye size={20} strokeWidth={2} />
<Shield class="text-primary" />
```

### Props

- `size` - Icon size in pixels (default: 24)
- `strokeWidth` - Stroke width (default: 2)
- `color` - Icon color
- `class` - Tailwind classes
- `absoluteStrokeWidth` - Use absolute stroke width

## Icon Categories for This Application

### Security & Authentication
```svelte
import {
  Lock, Unlock, Key, Shield, ShieldCheck, ShieldAlert,
  Eye, EyeOff, Fingerprint, AlertTriangle, AlertCircle
} from 'lucide-svelte';
```

**Usage:**
- Login/Signup: `Lock`, `Key`, `Shield`
- Password visibility: `Eye`, `EyeOff`
- Security warnings: `ShieldAlert`, `AlertTriangle`
- Success states: `ShieldCheck`

### Chat & Messaging
```svelte
import {
  MessageCircle, MessageSquare, Send, Reply, Edit, Trash2,
  Pin, Bookmark, Search, MoreVertical, Smile, Image, File
} from 'lucide-svelte';
```

**Usage:**
- Send message: `Send`
- Reply/Quote: `Reply`
- Edit/Delete: `Edit`, `Trash2`
- Pin/Bookmark: `Pin`, `Bookmark`
- Reactions: `Smile`
- Media: `Image`, `File`

### Navigation
```svelte
import {
  Home, Users, Settings, Bell, Menu, X, ChevronLeft,
  ChevronRight, ChevronDown, ChevronUp, Search, Calendar
} from 'lucide-svelte';
```

**Usage:**
- Main nav: `Home`, `Users`, `Settings`, `Bell`
- Mobile menu: `Menu`, `X`
- Dropdowns: `ChevronDown`, `ChevronUp`
- Events: `Calendar`

### User & Profile
```svelte
import {
  User, UserPlus, UserMinus, UserCheck, UserX,
  Mail, Phone, MapPin, Globe, Link2, Copy
} from 'lucide-svelte';
```

**Usage:**
- Profile: `User`
- Follow/Unfollow: `UserPlus`, `UserMinus`
- Contact info: `Mail`, `Phone`
- Social links: `Globe`, `Link2`

### Status & Feedback
```svelte
import {
  Check, CheckCircle, X, XCircle, AlertCircle,
  AlertTriangle, Info, HelpCircle, Loader2
} from 'lucide-svelte';
```

**Usage:**
- Success: `CheckCircle`, `Check`
- Error: `XCircle`, `AlertTriangle`
- Info: `Info`, `AlertCircle`
- Loading: `Loader2` (with animation)

### Actions
```svelte
import {
  Download, Upload, Copy, Share2, ExternalLink,
  RefreshCw, RotateCw, Trash2, Archive, Star
} from 'lucide-svelte';
```

**Usage:**
- Export: `Download`
- Upload: `Upload`
- Copy: `Copy`
- Share: `Share2`
- Refresh: `RefreshCw`

## Component Examples

### Button with Icon

```svelte
<script lang="ts">
  import { Send } from 'lucide-svelte';
  import Button from '$lib/components/ui/Button.svelte';
</script>

<Button>
  <Send size={20} class="mr-2" />
  Send Message
</Button>
```

### Icon Button

```svelte
<script lang="ts">
  import { Trash2 } from 'lucide-svelte';
</script>

<button
  class="btn btn-ghost btn-sm btn-circle"
  aria-label="Delete"
>
  <Trash2 size={18} />
</button>
```

### Loading Spinner

```svelte
<script lang="ts">
  import { Loader2 } from 'lucide-svelte';
</script>

<Loader2
  size={24}
  class="animate-spin text-primary"
/>
```

### Security Warning

```svelte
<script lang="ts">
  import { ShieldAlert } from 'lucide-svelte';
</script>

<div class="alert alert-warning">
  <ShieldAlert size={24} />
  <span>Secure your keys properly!</span>
</div>
```

## Accessibility

### Always Include Labels

```svelte
<!-- Good -->
<button aria-label="Delete message">
  <Trash2 size={18} />
</button>

<!-- Better -->
<button>
  <Trash2 size={18} />
  <span class="sr-only">Delete message</span>
</button>
```

### Use Semantic Colors

```svelte
<!-- Success -->
<CheckCircle class="text-success" />

<!-- Error -->
<AlertTriangle class="text-error" />

<!-- Warning -->
<AlertCircle class="text-warning" />

<!-- Info -->
<Info class="text-info" />
```

## Animation Examples

### Rotate on Hover

```svelte
<style>
  .icon-rotate {
    transition: transform 0.3s ease;
  }
  .icon-rotate:hover {
    transform: rotate(90deg);
  }
</style>

<Settings class="icon-rotate" />
```

### Pulse Animation

```svelte
<Bell class="animate-pulse text-error" />
```

### Spin (for loading)

```svelte
<Loader2 class="animate-spin" />
<RefreshCw class="animate-spin" />
```

## Performance Tips

1. **Import only what you need**
   ```svelte
   // Good
   import { Lock, Key } from 'lucide-svelte';

   // Bad (imports entire library)
   import * as Icons from 'lucide-svelte';
   ```

2. **Use consistent sizes**
   - Small icons: 16px
   - Medium icons: 20-24px
   - Large icons: 32px

3. **Reuse icon components**
   ```svelte
   <!-- Create reusable wrapper -->
   <script lang="ts">
     import { Lock } from 'lucide-svelte';
     export let size = 20;
   </script>

   <Lock {size} class="text-primary" />
   ```

## Migration from Current Setup

If you have existing icon usage (emoji, unicode, or other), replace:

```svelte
<!-- Before -->
<span>🔒</span>
<span>✓</span>
<span>⚠️</span>

<!-- After -->
<Lock size={20} />
<Check size={20} />
<AlertTriangle size={20} />
```

## Common Icon Mappings

| Purpose | Icon |
|---------|------|
| Login | `Lock`, `LogIn` |
| Signup | `UserPlus` |
| Logout | `LogOut` |
| Send | `Send` |
| Edit | `Edit`, `Edit2`, `Edit3` |
| Delete | `Trash2` |
| Search | `Search` |
| Filter | `Filter` |
| Settings | `Settings` |
| Notifications | `Bell` |
| User | `User` |
| Menu | `Menu` |
| Close | `X` |
| Check | `Check`, `CheckCircle` |
| Error | `XCircle`, `AlertTriangle` |
| Info | `Info`, `AlertCircle` |
| Copy | `Copy` |
| Link | `Link2` |
| External | `ExternalLink` |
| Download | `Download` |
| Upload | `Upload` |
| Refresh | `RefreshCw` |
| Star | `Star` |
| Pin | `Pin` |
| Bookmark | `Bookmark` |

## Resources

- **Official Docs**: https://lucide.dev/guide/packages/lucide-svelte
- **Icon Directory**: https://lucide.dev/icons/
- **GitHub**: https://github.com/lucide-icons/lucide

## Next Steps

1. Update existing components with Lucide icons
2. Create icon size/color standards in design system
3. Add icon usage to component documentation
4. Test accessibility with screen readers
