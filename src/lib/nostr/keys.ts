import { generateMnemonic, mnemonicToSeed, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';
import { HDKey } from '@scure/bip32';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';
import { getPublicKey } from 'nostr-tools';
import { nip19 } from 'nostr-tools';

const NIP06_PATH = "m/44'/1237'/0'/0/0";

export interface KeyPair {
  mnemonic: string;
  privateKey: string;
  publicKey: string;
}

export async function generateNewIdentity(): Promise<KeyPair> {
  const mnemonic = generateMnemonic(wordlist, 128);
  const seed = await mnemonicToSeed(mnemonic, '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  const privateKey = bytesToHex(derived.privateKey);
  const publicKey = getPublicKey(hexToBytes(privateKey));

  return { mnemonic, privateKey, publicKey };
}

export async function restoreFromMnemonic(mnemonic: string): Promise<Omit<KeyPair, 'mnemonic'>> {
  if (!validateMnemonic(mnemonic.trim(), wordlist)) {
    throw new Error('Invalid mnemonic phrase');
  }

  const seed = await mnemonicToSeed(mnemonic.trim(), '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  const privateKey = bytesToHex(derived.privateKey);
  const publicKey = getPublicKey(hexToBytes(privateKey));

  return { privateKey, publicKey };
}

export function encodePubkey(pubkey: string): string {
  return nip19.npubEncode(pubkey);
}

export function encodePrivkey(privkey: string): string {
  return nip19.nsecEncode(hexToBytes(privkey));
}

export function restoreFromNsecOrHex(input: string): { privateKey: string; publicKey: string } {
  const trimmed = input.trim();
  let privateKey: string;

  if (trimmed.startsWith('nsec1')) {
    // Decode nsec bech32 format
    const decoded = nip19.decode(trimmed);
    if (decoded.type !== 'nsec') {
      throw new Error('Invalid nsec format');
    }
    privateKey = bytesToHex(decoded.data as Uint8Array);
  } else {
    // Assume hex format - validate it's 64 hex characters
    if (!/^[a-fA-F0-9]{64}$/.test(trimmed)) {
      throw new Error('Invalid private key: must be 64 hex characters or nsec format');
    }
    privateKey = trimmed.toLowerCase();
  }

  const publicKey = getPublicKey(hexToBytes(privateKey));
  return { privateKey, publicKey };
}

export function saveKeysToStorage(publicKey: string, privateKey: string): void {
  if (typeof localStorage === 'undefined') return;

  localStorage.setItem('fairfield_keys', JSON.stringify({
    publicKey,
    privateKey,
    timestamp: Date.now()
  }));
}

export function loadKeysFromStorage(): { publicKey: string; privateKey: string } | null {
  if (typeof localStorage === 'undefined') return null;

  const stored = localStorage.getItem('fairfield_keys');
  if (!stored) return null;

  try {
    const { publicKey, privateKey } = JSON.parse(stored);
    return { publicKey, privateKey };
  } catch {
    return null;
  }
}
