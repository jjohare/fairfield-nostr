import { writable, derived } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';
import { encryptPrivateKey, decryptPrivateKey, isEncryptionAvailable } from '$lib/utils/key-encryption';

export interface AuthState {
  isAuthenticated: boolean;
  publicKey: string | null;
  privateKey: string | null;
  mnemonic: string | null;
  nickname: string | null;
  avatar: string | null;
  isPending: boolean;
  isAdmin: boolean;
  error: string | null;
  isEncrypted: boolean;
  mnemonicBackedUp: boolean;
  isReady: boolean;
}

const initialState: AuthState = {
  isAuthenticated: false,
  publicKey: null,
  privateKey: null,
  mnemonic: null,
  nickname: null,
  avatar: null,
  isPending: false,
  isAdmin: false,
  error: null,
  isEncrypted: false,
  mnemonicBackedUp: false,
  isReady: false
};

const STORAGE_KEY = 'fairfield_keys';
const SESSION_KEY = 'fairfield_session';

// Admin pubkeys loaded from environment only - no hardcoded values
const ADMIN_PUBKEY = import.meta.env.VITE_ADMIN_PUBKEY || '';
const ADMIN_PUBKEYS = ADMIN_PUBKEY ? ADMIN_PUBKEY.split(',').map((k: string) => k.trim()).filter(Boolean) : [];

function isAdminPubkey(pubkey: string): boolean {
  return ADMIN_PUBKEYS.includes(pubkey);
}

/**
 * Get or generate session encryption key
 * Session key is stored in sessionStorage (cleared on tab close)
 */
function getSessionKey(): string {
  if (!browser) return '';

  let sessionKey = sessionStorage.getItem(SESSION_KEY);
  if (!sessionKey) {
    // Generate a random session key
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    sessionKey = btoa(String.fromCharCode(...array));
    sessionStorage.setItem(SESSION_KEY, sessionKey);
  }
  return sessionKey;
}

function createAuthStore() {
  const { subscribe, set, update }: Writable<AuthState> = writable(initialState);

  // Promise that resolves when session restore is complete
  let readyPromise: Promise<void> | null = null;

  // Restore from localStorage on init
  async function restoreSession() {
    if (!browser) {
      update(state => ({ ...state, isReady: true }));
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      update(state => ({ ...state, isReady: true }));
      return;
    }

    try {
      const parsed = JSON.parse(stored);

      // Check if data is encrypted
      if (parsed.encryptedPrivateKey && isEncryptionAvailable()) {
        const sessionKey = getSessionKey();
        try {
          const privateKey = await decryptPrivateKey(parsed.encryptedPrivateKey, sessionKey);
          update(state => ({
            ...state,
            publicKey: parsed.publicKey,
            privateKey,
            nickname: parsed.nickname || null,
            avatar: parsed.avatar || null,
            isAuthenticated: true,
            isAdmin: isAdminPubkey(parsed.publicKey || ''),
            isEncrypted: true,
            mnemonicBackedUp: parsed.mnemonicBackedUp || false,
            isReady: true
          }));
        } catch {
          // Session key changed (new session) - need to re-authenticate
          update(state => ({
            ...state,
            publicKey: parsed.publicKey,
            nickname: parsed.nickname || null,
            avatar: parsed.avatar || null,
            isAuthenticated: false,
            isEncrypted: true,
            error: 'Session expired. Please enter your password to unlock.',
            isReady: true
          }));
        }
      } else if (parsed.privateKey) {
        // Legacy unencrypted data - migrate on next save
        update(state => ({
          ...state,
          ...parsed,
          isAuthenticated: true,
          isAdmin: isAdminPubkey(parsed.publicKey || ''),
          isEncrypted: false,
          mnemonicBackedUp: parsed.mnemonicBackedUp || false,
          isReady: true
        }));
      } else {
        update(state => ({ ...state, isReady: true }));
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      update(state => ({ ...state, isReady: true }));
    }
  }

  // Initialize restoration
  if (browser) {
    readyPromise = restoreSession();
  } else {
    readyPromise = Promise.resolve();
  }

  return {
    subscribe,

    /**
     * Wait for the auth store to be ready (session restored)
     */
    waitForReady: () => readyPromise || Promise.resolve(),

    /**
     * Set keys with encryption
     */
    setKeys: async (publicKey: string, privateKey: string, mnemonic?: string) => {
      const sessionKey = getSessionKey();

      const authData: Partial<AuthState> = {
        publicKey,
        privateKey,
        mnemonic: mnemonic || null,
        isAuthenticated: true,
        isAdmin: isAdminPubkey(publicKey),
        isPending: false,
        error: null,
        isEncrypted: isEncryptionAvailable(),
        mnemonicBackedUp: false
      };

      if (browser) {
        const existing = localStorage.getItem(STORAGE_KEY);
        let existingData: { nickname?: string; avatar?: string; mnemonicBackedUp?: boolean } = {};
        if (existing) {
          try { existingData = JSON.parse(existing); } catch { /* ignore */ }
        }

        const storageData: Record<string, unknown> = {
          publicKey,
          nickname: existingData.nickname || null,
          avatar: existingData.avatar || null,
          mnemonicBackedUp: existingData.mnemonicBackedUp || false
        };

        // Encrypt private key if available
        if (isEncryptionAvailable()) {
          storageData.encryptedPrivateKey = await encryptPrivateKey(privateKey, sessionKey);
          // Don't store mnemonic at all after encryption is set up
        } else {
          // Fallback for environments without Web Crypto (shouldn't happen in modern browsers)
          storageData.privateKey = privateKey;
          if (mnemonic) {
            storageData.mnemonic = mnemonic;
          }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(storageData));
      }

      update(state => ({ ...state, ...authData }));
    },

    /**
     * Mark mnemonic as backed up and clear it from memory
     */
    confirmMnemonicBackup: () => {
      update(state => ({
        ...state,
        mnemonic: null, // Clear mnemonic from memory
        mnemonicBackedUp: true
      }));

      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            delete data.mnemonic; // Remove mnemonic from storage
            data.mnemonicBackedUp = true;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
    },

    /**
     * Unlock with password (for encrypted storage)
     */
    unlock: async (password: string) => {
      if (!browser) return false;

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return false;

      try {
        const parsed = JSON.parse(stored);
        if (!parsed.encryptedPrivateKey) return false;

        const privateKey = await decryptPrivateKey(parsed.encryptedPrivateKey, password);

        // Re-encrypt with session key for this session
        const sessionKey = getSessionKey();
        const newEncrypted = await encryptPrivateKey(privateKey, sessionKey);
        parsed.encryptedPrivateKey = newEncrypted;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));

        update(state => ({
          ...state,
          privateKey,
          isAuthenticated: true,
          isAdmin: isAdminPubkey(parsed.publicKey || ''),
          error: null
        }));

        return true;
      } catch {
        update(state => ({ ...state, error: 'Invalid password' }));
        return false;
      }
    },

    setProfile: (nickname: string | null, avatar: string | null) => {
      if (browser) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            data.nickname = nickname;
            data.avatar = avatar;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch { /* ignore */ }
        }
      }
      update(state => ({ ...state, nickname, avatar }));
    },

    setPending: (isPending: boolean) => {
      update(state => ({ ...state, isPending }));
    },

    setError: (error: string) => {
      update(state => ({ ...state, error }));
    },

    clearError: () => {
      update(state => ({ ...state, error: null }));
    },

    logout: async () => {
      set(initialState);
      if (browser) {
        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        const { goto } = await import('$app/navigation');
        goto(`${base}/`);
      }
    },

    reset: () => set(initialState)
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated);
export const isAdmin = derived(authStore, $auth => $auth.isAdmin);
export const isReady = derived(authStore, $auth => $auth.isReady);
