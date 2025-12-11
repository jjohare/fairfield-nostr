import { writable } from 'svelte/store';

interface User {
  pubkey: string;
  npub: string;
  name?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  privateKey: string | null;
}

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>({
    user: null,
    isAuthenticated: false,
    privateKey: null
  });

  return {
    subscribe,
    login: (user: User, privateKey: string) => {
      set({
        user,
        isAuthenticated: true,
        privateKey
      });
    },
    logout: () => {
      set({
        user: null,
        isAuthenticated: false,
        privateKey: null
      });
    },
    updateProfile: (updates: Partial<User>) => {
      update(state => ({
        ...state,
        user: state.user ? { ...state.user, ...updates } : null
      }));
    }
  };
}

export const authStore = createAuthStore();
