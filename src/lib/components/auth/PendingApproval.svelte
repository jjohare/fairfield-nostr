<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { encodePubkey } from '$lib/nostr/keys';
  import { checkWhitelistStatus } from '$lib/nostr/whitelist';

  export let publicKey: string;

  const dispatch = createEventDispatcher<{ approved: void }>();

  let copiedPubkey = false;
  let dots = 0;
  let intervalId: number;
  let pollIntervalId: number;
  let checkingStatus = false;

  const npub = encodePubkey(publicKey);

  onMount(() => {
    // Animate loading dots
    intervalId = setInterval(() => {
      dots = (dots + 1) % 4;
    }, 500) as unknown as number;

    // Poll for approval status every 10 seconds
    pollIntervalId = setInterval(async () => {
      await checkApprovalStatus();
    }, 10000) as unknown as number;

    // Initial check
    checkApprovalStatus();
  });

  onDestroy(() => {
    if (intervalId) clearInterval(intervalId);
    if (pollIntervalId) clearInterval(pollIntervalId);
  });

  async function checkApprovalStatus() {
    if (checkingStatus) return;
    checkingStatus = true;

    try {
      const status = await checkWhitelistStatus(publicKey);
      if (status.isApproved || status.isAdmin) {
        dispatch('approved');
      }
    } catch (error) {
      console.error('Failed to check approval status:', error);
    } finally {
      checkingStatus = false;
    }
  }

  async function copyPubkey() {
    try {
      await navigator.clipboard.writeText(npub);
      copiedPubkey = true;
      setTimeout(() => { copiedPubkey = false; }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  const loadingText = () => '.'.repeat(dots);
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200">
  <div class="card w-full max-w-lg bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex justify-center mb-4">
        <div class="relative">
          <div class="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div class="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
        </div>
      </div>

      <h2 class="card-title text-2xl justify-center mb-2">
        Pending Admin Approval{loadingText()}
      </h2>

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <div class="text-sm">
          <p class="font-bold">Your account has been created!</p>
          <p>An administrator needs to approve your access before you can join. This usually takes a few minutes.</p>
        </div>
      </div>

      <div class="bg-base-200 rounded-lg p-4 mb-4">
        <h3 class="font-semibold text-sm mb-2">Your Public Key:</h3>
        <div class="bg-base-100 rounded p-3 mb-3 break-all font-mono text-xs">
          {npub}
        </div>
        <button
          class="btn btn-outline btn-sm btn-block gap-2"
          on:click={copyPubkey}
        >
          {#if copiedPubkey}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
            Copy Public Key
          {/if}
        </button>
      </div>

      <div class="flex flex-col gap-2 text-sm text-base-content/70">
        <p class="flex items-center gap-2">
          <span class="loading loading-ring loading-xs"></span>
          Waiting for admin approval
        </p>
        <p class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Your keys are saved locally
        </p>
        <p class="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Keep your recovery phrase safe
        </p>
      </div>

      <div class="divider"></div>

      <p class="text-center text-sm text-base-content/70">
        You can close this page and check back later. Your account will be ready once approved.
      </p>
    </div>
  </div>
</div>

<style>
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
