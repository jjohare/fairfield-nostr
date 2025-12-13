<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { generateNewIdentity } from '$lib/nostr/keys';
  import { authStore } from '$lib/stores/auth';
  import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';
  import WelcomeModal from '$lib/components/ui/WelcomeModal.svelte';

  const dispatch = createEventDispatcher<{ next: { mnemonic: string; publicKey: string; privateKey: string } }>();

  let isGenerating = false;

  async function handleCreateAccount() {
    isGenerating = true;
    authStore.clearError();

    try {
      await new Promise(resolve => setTimeout(resolve, 100));
      const { mnemonic, publicKey, privateKey } = await generateNewIdentity();

      dispatch('next', { mnemonic, publicKey, privateKey });
    } catch (error) {
      authStore.setError(error instanceof Error ? error.message : 'Failed to generate keys');
    } finally {
      isGenerating = false;
    }
  }
</script>

<WelcomeModal />

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-md bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl justify-center mb-4">Welcome to Minimoomaa Noir</h2>

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="flex items-center gap-2">
          <span class="text-sm">You'll receive a 12-word recovery phrase. Keep it safe!</span>
          <InfoTooltip
            text="A recovery phrase (also called a mnemonic or seed phrase) is a set of words that can restore your account. It's derived from your private key and provides a human-friendly backup method."
            position="top"
          />
        </div>
      </div>

      {#if $authStore.error}
        <div class="alert alert-error mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{$authStore.error}</span>
        </div>
      {/if}

      <div class="card-actions justify-center mt-4">
        <button
          class="btn btn-primary btn-lg w-full"
          on:click={handleCreateAccount}
          disabled={isGenerating}
        >
          {#if isGenerating}
            <span class="loading loading-spinner"></span>
            Generating...
          {:else}
            Create Account
          {/if}
        </button>
      </div>

      <div class="divider">OR</div>

      <button
        class="btn btn-ghost btn-sm"
        on:click={() => dispatch('next', { mnemonic: '', publicKey: '', privateKey: '' })}
      >
        Already have a recovery phrase?
      </button>
    </div>
  </div>
</div>
