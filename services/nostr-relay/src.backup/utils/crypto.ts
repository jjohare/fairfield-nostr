/**
 * Cryptographic utilities for Nostr event verification
 */
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { NostrEvent } from '../types.js';

/**
 * Verify event signature using Schnorr
 */
export async function verifyEventSignature(event: NostrEvent): Promise<boolean> {
  try {
    const signatureBytes = hexToBytes(event.sig);
    const serializedEventData = serializeEventForSigning(event);
    const messageHash = sha256(new TextEncoder().encode(serializedEventData));
    const publicKeyBytes = hexToBytes(event.pubkey);

    return schnorr.verify(signatureBytes, messageHash, publicKeyBytes);
  } catch (error) {
    console.error('Error verifying event signature:', error);
    return false;
  }
}

/**
 * Serialize event for signing (NIP-01)
 */
function serializeEventForSigning(event: NostrEvent): string {
  return JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);
}

/**
 * Convert hex string to bytes
 */
function hexToBytes(hexString: string): Uint8Array {
  if (hexString.length % 2 !== 0) {
    throw new Error('Invalid hex string');
  }
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hexString.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Generate random challenge for NIP-42 auth
 */
export function generateChallenge(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute event ID
 */
export function computeEventId(event: Omit<NostrEvent, 'id' | 'sig'>): string {
  const serialized = serializeEventForSigning(event as NostrEvent);
  const hash = sha256(new TextEncoder().encode(serialized));
  return Array.from(hash, (b) => b.toString(16).padStart(2, '0')).join('');
}
