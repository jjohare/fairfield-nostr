/**
 * Secure localStorage utilities for Nostr key management
 */

const STORAGE_KEYS = {
  PUBKEY: 'fairfield_nostr_pubkey',
  ENCRYPTED_PRIVKEY: 'fairfield_nostr_encrypted_privkey',
  MNEMONIC_SHOWN: 'fairfield_nostr_mnemonic_shown'
} as const;

export interface StoredKeys {
  pubkey: string;
  encryptedPrivkey: string;
}

/**
 * Validates that we're running in a secure context
 */
function validateSecureContext(): void {
  if (typeof window === 'undefined') {
    return; // SSR context
  }

  if (!window.isSecureContext && window.location.hostname !== 'localhost') {
    console.warn('Not running in a secure context. Key storage may be insecure.');
  }
}

/**
 * Saves Nostr keys to localStorage
 */
export function saveKeys(pubkey: string, encryptedPrivkey: string): void {
  validateSecureContext();

  try {
    localStorage.setItem(STORAGE_KEYS.PUBKEY, pubkey);
    localStorage.setItem(STORAGE_KEYS.ENCRYPTED_PRIVKEY, encryptedPrivkey);
  } catch (error) {
    console.error('Failed to save keys to localStorage:', error);
    throw new Error('Failed to save keys. localStorage may be disabled.');
  }
}

/**
 * Loads Nostr keys from localStorage
 */
export function loadKeys(): StoredKeys | null {
  if (typeof window === 'undefined') {
    return null; // SSR context
  }

  validateSecureContext();

  try {
    const pubkey = localStorage.getItem(STORAGE_KEYS.PUBKEY);
    const encryptedPrivkey = localStorage.getItem(STORAGE_KEYS.ENCRYPTED_PRIVKEY);

    if (!pubkey || !encryptedPrivkey) {
      return null;
    }

    return { pubkey, encryptedPrivkey };
  } catch (error) {
    console.error('Failed to load keys from localStorage:', error);
    return null;
  }
}

/**
 * Clears all stored keys from localStorage
 */
export function clearKeys(): void {
  if (typeof window === 'undefined') {
    return; // SSR context
  }

  try {
    localStorage.removeItem(STORAGE_KEYS.PUBKEY);
    localStorage.removeItem(STORAGE_KEYS.ENCRYPTED_PRIVKEY);
    localStorage.removeItem(STORAGE_KEYS.MNEMONIC_SHOWN);
  } catch (error) {
    console.error('Failed to clear keys from localStorage:', error);
  }
}

/**
 * Marks that the user has been shown their mnemonic
 */
export function setMnemonicShown(): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEYS.MNEMONIC_SHOWN, 'true');
  } catch (error) {
    console.error('Failed to set mnemonic shown flag:', error);
  }
}

/**
 * Checks if the user has been shown their mnemonic
 */
export function hasMnemonicBeenShown(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return localStorage.getItem(STORAGE_KEYS.MNEMONIC_SHOWN) === 'true';
  } catch (error) {
    console.error('Failed to check mnemonic shown flag:', error);
    return false;
  }
}

/**
 * Checks if keys exist in storage
 */
export function hasStoredKeys(): boolean {
  return loadKeys() !== null;
}

/**
 * Gets just the public key from storage
 */
export function getStoredPubkey(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return localStorage.getItem(STORAGE_KEYS.PUBKEY);
  } catch (error) {
    console.error('Failed to get pubkey from localStorage:', error);
    return null;
  }
}
