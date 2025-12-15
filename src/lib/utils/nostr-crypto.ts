/**
 * Nostr cryptographic utilities
 * Simplified implementations compatible with nostr-tools
 */

import { sha256 } from '@noble/hashes/sha256.js';
import { secp256k1 } from '@noble/curves/secp256k1';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

/**
 * Get public key from private key
 */
export function getPublicKey(privkey: string): string {
  const privkeyBytes = hexToBytes(privkey);
  const pubkeyBytes = secp256k1.getPublicKey(privkeyBytes, true);
  return bytesToHex(pubkeyBytes.slice(1)); // Remove prefix
}

/**
 * Get event hash
 */
export function getEventHash(event: {
  pubkey: string;
  created_at: number;
  kind: number;
  tags: string[][];
  content: string;
}): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content
  ]);

  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

/**
 * Sign event
 */
export function signEvent(
  event: {
    id: string;
    pubkey: string;
    created_at: number;
    kind: number;
    tags: string[][];
    content: string;
  },
  privkey: string
): string {
  const signature = secp256k1.sign(event.id, privkey);
  return bytesToHex(signature.toCompactRawBytes());
}

/**
 * Verify event signature
 */
export function verifySignature(event: {
  id: string;
  pubkey: string;
  sig: string;
}): boolean {
  try {
    const signature = secp256k1.Signature.fromCompact(hexToBytes(event.sig));
    return secp256k1.verify(
      signature,
      hexToBytes(event.id),
      hexToBytes('02' + event.pubkey)
    );
  } catch {
    return false;
  }
}

/**
 * NIP-04 encrypt (simplified)
 *
 * @deprecated NIP-04 is deprecated. Use NIP-44 for new implementations.
 * This function remains for backward compatibility with existing messages.
 */
export async function nip04Encrypt(
  privkey: string,
  pubkey: string,
  text: string
): Promise<string> {
  console.warn('[DEPRECATED] nip04Encrypt is deprecated. Use NIP-44 for new messages.');
  const sharedPoint = secp256k1.getSharedSecret(privkey, '02' + pubkey);
  const sharedX = sharedPoint.slice(1, 33);

  const iv = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw',
    sharedX,
    { name: 'AES-CBC', length: 256 },
    false,
    ['encrypt']
  );

  const encoded = new TextEncoder().encode(text);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    encoded
  );

  const ctb64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
  const ivb64 = btoa(String.fromCharCode(...iv));

  return `${ctb64}?iv=${ivb64}`;
}

/**
 * NIP-04 decrypt (simplified)
 *
 * @deprecated NIP-04 is deprecated. Use NIP-44 for new implementations.
 * This function remains for backward compatibility with existing messages.
 */
export async function nip04Decrypt(
  privkey: string,
  pubkey: string,
  data: string
): Promise<string> {
  const [ctb64, ivb64] = data.split('?iv=');

  const sharedPoint = secp256k1.getSharedSecret(privkey, '02' + pubkey);
  const sharedX = sharedPoint.slice(1, 33);

  const key = await crypto.subtle.importKey(
    'raw',
    sharedX,
    { name: 'AES-CBC', length: 256 },
    false,
    ['decrypt']
  );

  const ciphertext = Uint8Array.from(atob(ctb64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivb64), c => c.charCodeAt(0));

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-CBC', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(plaintext);
}
