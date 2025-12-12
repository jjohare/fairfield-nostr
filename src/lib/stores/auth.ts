import { writable, derived } from 'svelte/store';
import type { Writable } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { base } from '$app/paths';

export interface AuthState {
  isAuthenticated: boolean;
  publicKey: string | null;
  privateKey: string | null;
  mnemonic: string | null;
  isPending: boolean;
  isAdmin: boolean;
  error: string | null;
}

const initialState: AuthState = {
  isAuthenticated: false,
  publicKey: null,
  privateKey: null,
  mnemonic: null,
  isPending: false,
  isAdmin: false,
  error: null
};

const ADMIN_PUBKEYS = ['npub1admin...']; // Configure admin pubkeys

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
        localStorage.setItem('fairfield_keys', JSON.stringify({
          publicKey,
          privateKey,
          mnemonic: mnemonic || null
        }));
      }

      update(state => ({ ...state, ...authData }));
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
    logout: () => {
      set(initialState);
      if (browser) {
        localStorage.removeItem('fairfield_keys');
        goto(`${base}/`);
      }
    },
    reset: () => set(initialState)
  };
}

export const authStore = createAuthStore();
export const isAuthenticated = derived(authStore, $auth => $auth.isAuthenticated);
export const isAdmin = derived(authStore, $auth => $auth.isAdmin);
