<script lang="ts">
  /**
   * AuthFlow - Multi-step authentication flow for signup and login
   *
   * Flow steps:
   * 1. Signup - Generate new keys with mnemonic
   * 2. MnemonicDisplay - Show mnemonic with copy option (first display)
   * 3. KeyBackup - Show mnemonic again with npub (second display)
   * 4. PendingApproval - Wait for admin whitelist approval
   *
   * NOTE: Mnemonic is intentionally shown twice (in MnemonicDisplay and KeyBackup)
   * for the private server. This high-friction design ensures users properly backup
   * their recovery phrase. For public deployments, consider consolidating to one step.
   */
  import { authStore } from '$lib/stores/auth';
  import { saveKeysToStorage } from '$lib/nostr/keys';
  import Signup from './Signup.svelte';
  import MnemonicDisplay from './MnemonicDisplay.svelte';
  import Login from './Login.svelte';
  import KeyBackup from './KeyBackup.svelte';
  import PendingApproval from './PendingApproval.svelte';

  type FlowStep = 'signup' | 'mnemonic-display' | 'login' | 'key-backup' | 'pending-approval';

  let currentStep: FlowStep = 'signup';
  let tempKeys: {
    mnemonic: string;
    publicKey: string;
    privateKey: string;
  } | null = null;

  function handleSignupNext(event: CustomEvent<{ mnemonic: string; publicKey: string; privateKey: string }>) {
    const { mnemonic, publicKey, privateKey } = event.detail;

    if (mnemonic && publicKey && privateKey) {
      tempKeys = { mnemonic, publicKey, privateKey };
      currentStep = 'mnemonic-display';
    } else {
      currentStep = 'login';
    }
  }

  function handleMnemonicContinue() {
    if (tempKeys) {
      currentStep = 'key-backup';
    }
  }

  async function handleLoginSuccess(event: CustomEvent<{ publicKey: string; privateKey: string }>) {
    const { publicKey, privateKey } = event.detail;

    if (publicKey && privateKey) {
      tempKeys = { mnemonic: '', publicKey, privateKey };
      await authStore.setKeys(publicKey, privateKey);
      saveKeysToStorage(publicKey, privateKey);
      currentStep = 'pending-approval';
    } else {
      currentStep = 'signup';
    }
  }

  async function handleKeyBackupContinue() {
    if (tempKeys) {
      const { publicKey, privateKey, mnemonic } = tempKeys;
      await authStore.setKeys(publicKey, privateKey, mnemonic);
      saveKeysToStorage(publicKey, privateKey);
      // Confirm backup was shown to clear mnemonic from storage
      authStore.confirmMnemonicBackup();
      authStore.setPending(true);

      // Clear mnemonic from memory immediately after key derivation is complete
      // This prevents the sensitive mnemonic from lingering in memory
      tempKeys = { mnemonic: '', publicKey, privateKey };

      currentStep = 'pending-approval';
    }
  }
</script>

{#if currentStep === 'signup'}
  <Signup on:next={handleSignupNext} />
{:else if currentStep === 'mnemonic-display' && tempKeys}
  <MnemonicDisplay
    mnemonic={tempKeys.mnemonic}
    on:continue={handleMnemonicContinue}
  />
{:else if currentStep === 'login'}
  <Login on:success={handleLoginSuccess} />
{:else if currentStep === 'key-backup' && tempKeys}
  <KeyBackup
    publicKey={tempKeys.publicKey}
    mnemonic={tempKeys.mnemonic}
    on:continue={handleKeyBackupContinue}
  />
{:else if currentStep === 'pending-approval' && tempKeys}
  <PendingApproval publicKey={tempKeys.publicKey} />
{/if}
