import { writable, derived } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { base } from '$app/paths';

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
  error: null
};

// Admin pubkey from environment config (hex format)
const ADMIN_PUBKEY = import.meta.env.VITE_ADMIN_PUBKEY || '';
const ADMIN_PUBKEYS = ADMIN_PUBKEY ? [ADMIN_PUBKEY] : [];

function createAuthStore() {
  const { subscribe, set, update }: Writable<AuthState> = writable(initialState);

  if (browser) {
    const stored = localStorage.getItem('fairfield_keys');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        update(state => ({
          ...state,
          ...parsed,
          isAuthenticated: true,
          isAdmin: ADMIN_PUBKEYS.includes(parsed.publicKey || '')
        }));
      } catch (e) {
        localStorage.removeItem('fairfield_keys');
      }
    }
  }

  return {
    subscribe,
    setKeys: (publicKey: string, privateKey: string, mnemonic?: string) => {
      const authData = {
        publicKey,
        privateKey,
        mnemonic: mnemonic || null,
        isAuthenticated: true,
        isAdmin: ADMIN_PUBKEYS.includes(publicKey),
        isPending: false,
        error: null
      };

      if (browser) {
        // Preserve existing nickname/avatar if present
        const existing = localStorage.getItem('fairfield_keys');
        let existingData: { nickname?: string; avatar?: string } = {};
        if (existing) {
          try { existingData = JSON.parse(existing); } catch {}
        }
        localStorage.setItem('fairfield_keys', JSON.stringify({
          publicKey,
          privateKey,
          mnemonic: mnemonic || null,
          nickname: existingData.nickname || null,
          avatar: existingData.avatar || null
        }));
      }

      update(state => ({ ...state, ...authData }));
    },
    setProfile: (nickname: string | null, avatar: string | null) => {
      if (browser) {
        const stored = localStorage.getItem('fairfield_keys');
        if (stored) {
          const data = JSON.parse(stored);
          data.nickname = nickname;
          data.avatar = avatar;
          localStorage.setItem('fairfield_keys', JSON.stringify(data));
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
        localStorage.removeItem('fairfield_keys');
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
