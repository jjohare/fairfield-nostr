/**
 * Cryptographic utilities for Fairfield Nostr
 * Provides low-level crypto operations for key management
 */

import { validateMnemonic as bip39Validate, mnemonicToSeedSync } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

/**
 * Validate a BIP-39 mnemonic phrase
 * @param mnemonic - Space-separated mnemonic words
 * @returns true if valid, false otherwise
 */
export function validateMnemonic(mnemonic: string): boolean {
  try {
    return bip39Validate(mnemonic, wordlist);
  } catch {
    return false;
  }
}

/**
 * Convert mnemonic to seed bytes
 * @param mnemonic - BIP-39 mnemonic phrase
 * @param passphrase - Optional passphrase for additional security
 * @returns 64-byte seed
 */
export function mnemonicToSeed(mnemonic: string, passphrase: string = ''): Uint8Array {
  return mnemonicToSeedSync(mnemonic, passphrase);
}

/**
 * Convert hex string to Uint8Array
 * @param hex - Hex string (with or without 0x prefix)
 * @returns Byte array
 */
export function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  if (cleanHex.length % 2 !== 0) {
    throw new Error('Invalid hex string: odd length');
  }
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error('Invalid hex string: contains non-hex characters');
  }

  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 * @param bytes - Byte array
 * @param prefix - Whether to include '0x' prefix (default: false)
 * @returns Hex string
 */
export function bytesToHex(bytes: Uint8Array, prefix: boolean = false): string {
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  return prefix ? `0x${hex}` : hex;
}

/**
 * Securely clear sensitive data from memory
 * @param data - Array to clear
 */
export function secureWipe(data: Uint8Array): void {
  data.fill(0);
}
