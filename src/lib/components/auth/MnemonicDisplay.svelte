<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';

  export let mnemonic: string;

  const dispatch = createEventDispatcher<{ continue: void }>();

  let hasSaved = false;
  let copied = false;

  const words = mnemonic.split(' ');

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(mnemonic);
      copied = true;
      setTimeout(() => { copied = false; }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  function handleContinue() {
    if (hasSaved) {
      dispatch('continue');
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-2xl bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-center gap-2 mb-2">
        <h2 class="card-title text-2xl">Your Recovery Phrase</h2>
        <InfoTooltip
          text="This 12-word phrase is the backup for your Nostr account. Anyone with this phrase can access your account, so keep it secret and secure. Write it on paper and store it safely."
          position="bottom"
          maxWidth="400px"
        />
      </div>

      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="text-sm">
          <p class="font-bold">Write this down and keep it safe!</p>
          <p>This is the ONLY way to recover your account. Never share it with anyone.</p>
        </div>
      </div>

      <div class="bg-base-200 rounded-lg p-6 mb-4">
        <div class="grid grid-cols-3 gap-4 sm:grid-cols-4">
          {#each words as word, i}
            <div class="flex items-center gap-2 bg-base-100 rounded px-3 py-2 shadow">
              <span class="text-xs text-base-content/50 font-mono">{i + 1}.</span>
              <span class="font-medium font-mono">{word}</span>
            </div>
          {/each}
        </div>
      </div>

      <div class="flex justify-center mb-4">
        <button
          class="btn btn-outline btn-sm gap-2"
          on:click={copyToClipboard}
        >
          {#if copied}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy to Clipboard
          {/if}
        </button>
      </div>

      <div class="form-control mb-4">
        <label class="label cursor-pointer justify-center gap-3">
          <input
            type="checkbox"
            class="checkbox checkbox-primary"
            bind:checked={hasSaved}
          />
          <span class="label-text text-base">I have saved my recovery phrase in a secure location</span>
        </label>
      </div>

      <div class="card-actions justify-center">
        <button
          class="btn btn-primary btn-lg w-full sm:w-auto px-8"
          on:click={handleContinue}
          disabled={!hasSaved}
        >
          Continue
        </button>
      </div>
    </div>
  </div>
</div>
