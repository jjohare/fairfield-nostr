# Authentication Components

Complete Svelte authentication flow for Fairfield Nostr with Tailwind CSS and DaisyUI styling.

## Components

### 1. Signup.svelte
Entry point for new users. Generates a 12-word mnemonic on button click.

**Features:**
- "Create Account" button
- Loading state during key generation
- Error display
- Link to login for existing users

**Events:**
- `on:next` - Emitted with `{ mnemonic, publicKey, privateKey }` or empty strings to switch to login

### 2. MnemonicDisplay.svelte
Displays the generated 12-word recovery phrase in a 4x3 grid.

**Props:**
- `mnemonic: string` - The 12-word mnemonic phrase

**Features:**
- Grid layout (4x3) for easy reading
- Copy-to-clipboard with success feedback
- "I've saved my recovery phrase" checkbox
- Continue button (disabled until checkbox checked)

**Events:**
- `on:continue` - Emitted when user confirms they've saved the phrase

### 3. Login.svelte
Restore account from mnemonic phrase.

**Features:**
- Dual input modes: paste or individual word entry
- 12 individual text inputs for word-by-word entry
- Single textarea for pasting complete phrase
- Validation with error feedback
- Auto-paste detection in individual mode

**Events:**
- `on:success` - Emitted with `{ publicKey, privateKey }` or empty strings to switch to signup

### 4. KeyBackup.svelte
Displays keys for backup with security warnings.

**Props:**
- `publicKey: string` - User's public key (hex)
- `mnemonic: string | null` - Optional recovery phrase

**Features:**
- Security warnings about key storage
- npub-encoded public key display
- Optional mnemonic display
- Copy buttons for both keys
- Success feedback on copy

**Events:**
- `on:continue` - Emitted when user continues to next step

### 5. PendingApproval.svelte
Waiting screen for admin approval.

**Props:**
- `publicKey: string` - User's public key (hex)

**Features:**
- Animated loading indicator with pulsing clock
- Rotating spinner border
- npub-encoded public key display
- Copy pubkey button
- Animated "..." loading text
- Status checklist

## Usage

### Individual Components

```svelte
<script>
  import { Signup, MnemonicDisplay, Login, KeyBackup, PendingApproval } from '$lib/components/auth';
  
  let publicKey = '';
  let privateKey = '';
  let mnemonic = '';
</script>

<Signup 
  on:next={(e) => {
    mnemonic = e.detail.mnemonic;
    publicKey = e.detail.publicKey;
    privateKey = e.detail.privateKey;
  }}
/>
```

### Complete Flow (AuthFlow.svelte)

```svelte
<script>
  import { AuthFlow } from '$lib/components/auth';
</script>

<AuthFlow />
```

The orchestrator component handles the complete signup/login flow:
1. Signup → Mnemonic Display → Key Backup → Pending Approval
2. Login → Pending Approval

## State Management

Uses `$lib/stores/auth.ts`:

```typescript
interface AuthState {
  isAuthenticated: boolean;
  publicKey: string | null;
  privateKey: string | null;
  mnemonic: string | null;
  isPending: boolean;
  error: string | null;
}
```

## Dependencies

Required packages (already in package.json):
- `bip39` - Mnemonic generation/validation
- `@scure/bip32` - HD key derivation
- `@noble/hashes` - Cryptographic utilities
- `nostr-tools` - Nostr key operations
- `tailwindcss` + `daisyui` - Styling

## Styling

All components use:
- DaisyUI component classes (btn, card, alert, etc.)
- Tailwind utility classes for layout
- Mobile-responsive design with breakpoints
- Dark mode compatible (DaisyUI theme system)

## Security Features

- Client-side key generation (no server transmission)
- NIP-06 standard key derivation path
- localStorage for key persistence
- Copy-to-clipboard for secure backup
- Visual warnings about key security
- Validation for mnemonic phrases
