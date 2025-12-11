/**
 * Example: NIP-06 Key Generation
 * Demonstrates generating and restoring Nostr identities
 */

import {
  generateNewIdentity,
  restoreFromMnemonic,
  deriveIdentityAtIndex,
  isValidPrivateKey,
  isValidPublicKey,
  NOSTR_DERIVATION_PATH,
} from '../src/lib/nostr/keys.js';

// Example 1: Generate a new identity
console.log('=== Generate New Identity ===');
const identity = generateNewIdentity();
console.log('Mnemonic:', identity.mnemonic);
console.log('Private Key:', identity.privateKey);
console.log('Public Key:', identity.publicKey);
console.log('Derivation Path:', NOSTR_DERIVATION_PATH);
console.log();

// Example 2: Restore from mnemonic
console.log('=== Restore from Mnemonic ===');
const restored = restoreFromMnemonic(identity.mnemonic);
console.log('Keys match:',
  restored.privateKey === identity.privateKey &&
  restored.publicKey === identity.publicKey
);
console.log();

// Example 3: Derive multiple identities
console.log('=== Derive Multiple Identities ===');
const identity0 = deriveIdentityAtIndex(identity.mnemonic, 0);
const identity1 = deriveIdentityAtIndex(identity.mnemonic, 1);
const identity2 = deriveIdentityAtIndex(identity.mnemonic, 2);

console.log('Account 0 Public Key:', identity0.publicKey);
console.log('Account 1 Public Key:', identity1.publicKey);
console.log('Account 2 Public Key:', identity2.publicKey);
console.log('All different:',
  identity0.publicKey !== identity1.publicKey &&
  identity1.publicKey !== identity2.publicKey
);
console.log();

// Example 4: Validate keys
console.log('=== Validate Keys ===');
console.log('Valid private key:', isValidPrivateKey(identity.privateKey));
console.log('Valid public key:', isValidPublicKey(identity.publicKey));
console.log('Invalid private key:', isValidPrivateKey('invalid'));
console.log('Invalid public key:', isValidPublicKey('invalid'));
