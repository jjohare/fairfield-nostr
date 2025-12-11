import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from 'bip39';
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

export function generateNewIdentity(): KeyPair {
  const mnemonic = generateMnemonic(128);
  const seed = mnemonicToSeedSync(mnemonic, '');
  const hdKey = HDKey.fromMasterSeed(seed);
  const derived = hdKey.derive(NIP06_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key');
  }

  const privateKey = bytesToHex(derived.privateKey);
  const publicKey = getPublicKey(hexToBytes(privateKey));

  return { mnemonic, privateKey, publicKey };
}

export function restoreFromMnemonic(mnemonic: string): Omit<KeyPair, 'mnemonic'> {
  if (!validateMnemonic(mnemonic.trim())) {
    throw new Error('Invalid mnemonic phrase');
  }

  const seed = mnemonicToSeedSync(mnemonic.trim(), '');
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
