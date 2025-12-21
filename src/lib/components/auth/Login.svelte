<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { restoreFromMnemonic, restoreFromNsecOrHex } from '$lib/nostr/keys';
  import { authStore } from '$lib/stores/auth';
  import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';

  const dispatch = createEventDispatcher<{ success: { publicKey: string; privateKey: string; keepSignedIn: boolean } }>();

  let inputMode: 'paste' | 'individual' | 'privatekey' = 'paste';
  let pastedMnemonic = '';
  let wordInputs: string[] = Array(12).fill('');
  let privateKeyInput = '';
  let isRestoring = false;
  let validationError = '';
  let keepSignedIn = true; // Default to yes

  onMount(() => {
    // Check if user previously opted out
    if (browser) {
      const savedPref = localStorage.getItem('nostr_bbs_keep_signed_in');
      if (savedPref !== null) {
        keepSignedIn = savedPref === 'true';
      }
    }
  });

  function switchMode(mode: 'paste' | 'individual' | 'privatekey') {
    inputMode = mode;
    validationError = '';
  }

  async function handleRestore() {
    isRestoring = true;
    validationError = '';
    authStore.clearError();

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      let publicKey: string;
      let privateKey: string;

      if (inputMode === 'privatekey') {
        // Handle nsec or hex private key
        if (!privateKeyInput.trim()) {
          validationError = 'Please enter your private key (nsec or hex format)';
          return;
        }
        const result = restoreFromNsecOrHex(privateKeyInput);
        publicKey = result.publicKey;
        privateKey = result.privateKey;
      } else {
        // Handle mnemonic (paste or individual words)
        const mnemonic = inputMode === 'paste'
          ? pastedMnemonic.trim()
          : wordInputs.map(w => w.trim().toLowerCase()).join(' ');

        if (!mnemonic || mnemonic.split(' ').length !== 12) {
          validationError = 'Please enter all 12 words';
          return;
        }

        const result = await restoreFromMnemonic(mnemonic);
        publicKey = result.publicKey;
        privateKey = result.privateKey;
      }

      // Save preference
      if (browser) {
        localStorage.setItem('nostr_bbs_keep_signed_in', String(keepSignedIn));
      }
      dispatch('success', { publicKey, privateKey, keepSignedIn });
    } catch (error) {
      validationError = error instanceof Error ? error.message : 'Invalid credentials';
      authStore.setError(validationError);
    } finally {
      isRestoring = false;
    }
  }

  function handlePaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text') || '';
    const words = text.trim().toLowerCase().split(/\s+/);

    if (words.length === 12) {
      wordInputs = words;
    }
  }
</script>

<div class="flex flex-col items-center justify-center min-h-screen p-4 bg-base-200 gradient-mesh">
  <div class="card w-full max-w-2xl bg-base-100 shadow-xl">
    <div class="card-body">
      <div class="flex items-center justify-center gap-2 mb-4">
        <h2 class="card-title text-2xl">Restore Your Account</h2>
        <InfoTooltip
          text="Restore your Nostr identity using your recovery phrase or private key (nsec). Your keys are never sent to any server - everything happens locally in your browser."
          position="bottom"
          maxWidth="400px"
        />
      </div>

      <div class="alert alert-info mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-sm">Enter your 12-word recovery phrase to restore your account</span>
      </div>

      <div class="tabs tabs-boxed mb-4">
        <button
          class="tab flex-1"
          class:tab-active={inputMode === 'paste'}
          on:click={() => switchMode('paste')}
        >
          Paste Phrase
        </button>
        <button
          class="tab flex-1"
          class:tab-active={inputMode === 'individual'}
          on:click={() => switchMode('individual')}
        >
          Enter Words
        </button>
        <button
          class="tab flex-1 gap-1"
          class:tab-active={inputMode === 'privatekey'}
          on:click={() => switchMode('privatekey')}
        >
          Private Key
          <InfoTooltip
            text="Your private key (nsec) is the secret credential that proves you own your account. It starts with 'nsec1' or can be 64 hex characters. NEVER share this with anyone."
            position="top"
            maxWidth="350px"
            inline={true}
          />
        </button>
      </div>

      {#if inputMode === 'paste'}
        <div class="form-control">
          <textarea
            class="textarea textarea-bordered h-32 font-mono"
            placeholder="Paste your 12-word recovery phrase here..."
            bind:value={pastedMnemonic}
            disabled={isRestoring}
          />
        </div>
      {:else if inputMode === 'privatekey'}
        <div class="form-control">
          <label class="label">
            <span class="label-text">Enter your nsec or hex private key</span>
          </label>
          <input
            type="password"
            class="input input-bordered font-mono"
            placeholder="nsec1... or 64-character hex"
            bind:value={privateKeyInput}
            disabled={isRestoring}
            autocomplete="off"
          />
          <label class="label">
            <span class="label-text-alt text-base-content/50">
              Supports nsec format (nsec1...) or raw 64-character hex
            </span>
          </label>
        </div>
      {:else}
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3" on:paste={handlePaste}>
          {#each wordInputs as word, i}
            <div class="form-control">
              <label class="label py-1">
                <span class="label-text text-xs">Word {i + 1}</span>
              </label>
              <input
                type="text"
                class="input input-bordered input-sm font-mono"
                placeholder={`Word ${i + 1}`}
                bind:value={wordInputs[i]}
                disabled={isRestoring}
                autocomplete="off"
              />
            </div>
          {/each}
        </div>
      {/if}

      {#if validationError || $authStore.error}
        <div class="alert alert-error mt-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{validationError || $authStore.error}</span>
        </div>
      {/if}

      <!-- Keep me signed in toggle -->
      <div class="form-control mt-4">
        <label class="label cursor-pointer justify-start gap-3">
          <input
            type="checkbox"
            class="toggle toggle-primary"
            bind:checked={keepSignedIn}
            disabled={isRestoring}
          />
          <div class="flex flex-col">
            <span class="label-text font-medium">Keep me signed in</span>
            <span class="label-text-alt text-base-content/60">
              Stay logged in on this browser using a secure cookie
            </span>
          </div>
        </label>
      </div>

      <div class="card-actions justify-center mt-4">
        <button
          class="btn btn-primary btn-lg w-full sm:w-auto px-8"
          on:click={handleRestore}
          disabled={isRestoring}
        >
          {#if isRestoring}
            <span class="loading loading-spinner"></span>
            Restoring...
          {:else}
            Restore Account
          {/if}
        </button>
      </div>

      <div class="divider">OR</div>

      <button
        class="btn btn-ghost btn-sm"
        on:click={() => dispatch('success', { publicKey: '', privateKey: '', keepSignedIn: true })}
      >
        Create a new account
      </button>
    </div>
  </div>
</div>
