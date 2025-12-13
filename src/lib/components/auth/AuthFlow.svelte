<script lang="ts">
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
      await authStore.setKeys(tempKeys.publicKey, tempKeys.privateKey, tempKeys.mnemonic);
      saveKeysToStorage(tempKeys.publicKey, tempKeys.privateKey);
      // Confirm backup was shown to clear mnemonic from storage
      authStore.confirmMnemonicBackup();
      authStore.setPending(true);
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
