<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { encodePubkey } from '$lib/nostr/keys';

  export let publicKey: string;
  export let mnemonic: string | null = null;

  const dispatch = createEventDispatcher<{ continue: void }>();

  let copiedPubkey = false;
  let copiedMnemonic = false;

  const npub = encodePubkey(publicKey);

  async function copyPubkey() {
    try {
      await navigator.clipboard.writeText(npub);
      copiedPubkey = true;
      setTimeout(() => { copiedPubkey = false; }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  async function copyMnemonic() {
    if (!mnemonic) return;
    try {
      await navigator.clipboard.writeText(mnemonic);
      copiedMnemonic = true;
      setTimeout(() => { copiedMnemonic = false; }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-lg bg-base-100 shadow-xl">
    <div class="card-body">
      <h2 class="card-title text-2xl justify-center mb-2">Important: Backup Your Keys</h2>

      <div class="alert alert-warning mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div class="text-sm">
          <p class="font-bold">Store your keys securely!</p>
          <p>Without your recovery phrase, you cannot restore access to your account.</p>
        </div>
      </div>

      {#if mnemonic}
        <div class="mb-4">
          <h3 class="font-semibold mb-2">Recovery Phrase</h3>
          <div class="bg-base-200 rounded-lg p-4 mb-2">
            <p class="font-mono text-sm break-all">{mnemonic}</p>
          </div>
          <button
            class="btn btn-outline btn-sm btn-block gap-2"
            on:click={copyMnemonic}
          >
            {#if copiedMnemonic}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
              Copy Recovery Phrase
            {/if}
          </button>
        </div>

        <div class="divider"></div>
      {/if}

      <div class="mb-4">
        <h3 class="font-semibold mb-2">Your Public Key</h3>
        <p class="text-sm text-base-content/70 mb-2">
          Share this with others to receive messages. Never share your private key or recovery phrase!
        </p>
        <div class="bg-base-200 rounded-lg p-4 mb-2">
          <p class="font-mono text-sm break-all">{npub}</p>
        </div>
        <button
          class="btn btn-outline btn-sm btn-block gap-2"
          on:click={copyPubkey}
        >
          {#if copiedPubkey}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy Public Key
          {/if}
        </button>
      </div>

      <div class="card-actions justify-center mt-4">
        <button
          class="btn btn-primary btn-lg w-full"
          on:click={() => dispatch('continue')}
        >
          Continue
        </button>
      </div>
    </div>
  </div>
</div>
