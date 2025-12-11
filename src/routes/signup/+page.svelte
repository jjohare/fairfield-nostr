<script lang="ts">
  import Signup from '$lib/components/auth/Signup.svelte';
  import MnemonicDisplay from '$lib/components/auth/MnemonicDisplay.svelte';
  import { goto } from '$app/navigation';
  import { authStore } from '$lib/stores/auth';

  let step = 1;
  let mnemonic = '';
  let publicKey = '';
  let privateKey = '';

  function handleNext(event: CustomEvent<{ mnemonic: string; publicKey: string; privateKey: string }>) {
    const data = event.detail;
    if (data.mnemonic) {
      mnemonic = data.mnemonic;
      publicKey = data.publicKey;
      privateKey = data.privateKey;
      step = 2;
    } else {
      goto('/setup');
    }
  }

  function handleContinue() {
    authStore.setKeys(publicKey, privateKey, mnemonic);
    goto('/chat');
  }
</script>

<svelte:head>
  <title>Sign Up - Fairfield Nostr</title>
</svelte:head>

{#if step === 1}
  <Signup on:next={handleNext} />
{:else if step === 2}
  <MnemonicDisplay {mnemonic} on:continue={handleContinue} />
{/if}
