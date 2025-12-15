/**
 * Test cryptographic keys and identities
 */
import { schnorr } from '@noble/curves/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export interface TestIdentity {
  privateKey: string;
  publicKey: string;
  npub?: string;
}

/**
 * Generate a test keypair
 */
export function generateTestKey(): TestIdentity {
  const privateKeyBytes = schnorr.utils.randomPrivateKey();
  const publicKeyBytes = schnorr.getPublicKey(privateKeyBytes);

  return {
    privateKey: bytesToHex(privateKeyBytes),
    publicKey: bytesToHex(publicKeyBytes),
  };
}

/**
 * Sign a Nostr event
 */
export function signEvent(event: any, privateKey: string): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  const hash = sha256(new TextEncoder().encode(serialized));
  const privateKeyBytes = new Uint8Array(
    privateKey.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
  );

  const signature = schnorr.sign(hash, privateKeyBytes);
  return bytesToHex(signature);
}

/**
 * Generate event ID
 */
export function generateEventId(event: any): string {
  const serialized = JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]);

  const hash = sha256(new TextEncoder().encode(serialized));
  return bytesToHex(hash);
}

// Pre-generated test identities
export const TEST_ADMIN: TestIdentity = {
  privateKey: 'd2508ff0e0f4f0791d25fac8a8e400fa2930086c2fe50c7dbb7f265aeffe2031',
  publicKey: '8d70f935c1a795588306a1a4ae36b44a378ec00acfbfcf428d198b4575f7e3d3',
};

export const TEST_USER_1: TestIdentity = generateTestKey();
export const TEST_USER_2: TestIdentity = generateTestKey();
export const TEST_USER_3: TestIdentity = generateTestKey();

/**
 * Create a test Nostr event
 */
export function createTestEvent(
  identity: TestIdentity,
  kind: number = 1,
  content: string = 'Test event',
  tags: string[][] = []
): any {
  const event = {
    pubkey: identity.publicKey,
    created_at: Math.floor(Date.now() / 1000),
    kind,
    tags,
    content,
  };

  const id = generateEventId(event);
  const sig = signEvent(event, identity.privateKey);

  return {
    ...event,
    id,
    sig,
  };
}
