<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { dmStore, sortedConversations } from '$lib/stores/dm';
  import { toast } from '$lib/stores/toast';

  /**
   * Whether dialog is open
   */
  export let open = false;

  const dispatch = createEventDispatcher<{
    close: void;
    start: { pubkey: string; name?: string };
  }>();

  let searchInput = '';
  let selectedPubkey = '';
  let customName = '';

  /**
   * Recent contacts from existing conversations
   */
  $: recentContacts = $sortedConversations.slice(0, 5);

  /**
   * Validate pubkey format (hex string, 64 characters)
   */
  $: isValidPubkey = /^[0-9a-f]{64}$/i.test(searchInput.trim());

  /**
   * Handle starting a new conversation
   */
  function handleStart() {
    const pubkey = selectedPubkey || searchInput.trim();
    if (!pubkey) return;

    if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
      toast.error('Invalid public key format. Must be 64 hex characters.');
      return;
    }

    dmStore.startConversation(pubkey, customName || undefined);
    dispatch('start', { pubkey, name: customName || undefined });
    toast.success('Conversation started');
    handleClose();
  }

  /**
   * Handle selecting a recent contact
   */
  function handleSelectContact(pubkey: string, name: string) {
    selectedPubkey = pubkey;
    searchInput = pubkey;
    customName = name;
  }

  /**
   * Handle close
   */
  function handleClose() {
    open = false;
    searchInput = '';
    selectedPubkey = '';
    customName = '';
    dispatch('close');
  }

  /**
   * Format pubkey for display
   */
  function formatPubkey(pubkey: string): string {
    if (pubkey.length <= 16) return pubkey;
    return `${pubkey.substring(0, 8)}...${pubkey.substring(pubkey.length - 8)}`;
  }

  /**
   * Get avatar placeholder
   */
  function getAvatarPlaceholder(name: string): string {
    const initials = name
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    return initials || name.substring(0, 2).toUpperCase();
  }
</script>

<!-- Modal -->
{#if open}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-bold text-lg">New Message</h3>
        <button
          class="btn btn-sm btn-circle btn-ghost"
          on:click={handleClose}
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Search Input -->
      <div class="form-control mb-4">
        <label class="label">
          <span class="label-text">Public Key (hex)</span>
        </label>
        <input
          type="text"
          bind:value={searchInput}
          placeholder="Enter 64-character hex public key..."
          class="input input-bordered w-full font-mono text-sm"
          class:input-success={isValidPubkey}
          class:input-error={searchInput.length > 0 && !isValidPubkey}
        />
        {#if searchInput.length > 0 && !isValidPubkey}
          <label class="label">
            <span class="label-text-alt text-error">
              Invalid format. Public key must be 64 hex characters.
            </span>
          </label>
        {/if}
      </div>

      <!-- Optional Custom Name -->
      <div class="form-control mb-6">
        <label class="label">
          <span class="label-text">Display Name (optional)</span>
        </label>
        <input
          type="text"
          bind:value={customName}
          placeholder="Give this contact a friendly name..."
          class="input input-bordered w-full"
        />
      </div>

      <!-- Recent Contacts -->
      {#if recentContacts.length > 0 && !searchInput}
        <div class="mb-6">
          <h4 class="text-sm font-semibold mb-3 text-base-content/70">Recent Contacts</h4>
          <div class="space-y-2">
            {#each recentContacts as contact (contact.pubkey)}
              <button
                class="w-full p-3 rounded-lg hover:bg-base-200 active:bg-base-300 transition-colors flex items-center gap-3 text-left"
                on:click={() => handleSelectContact(contact.pubkey, contact.name)}
              >
                <div class="avatar placeholder">
                  <div class="w-10 h-10 rounded-full bg-primary text-primary-content">
                    {#if contact.avatar}
                      <img src={contact.avatar} alt={contact.name} />
                    {:else}
                      <span class="text-xs font-semibold">
                        {getAvatarPlaceholder(contact.name)}
                      </span>
                    {/if}
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold text-base-content truncate">{contact.name}</p>
                  <p class="text-xs text-base-content/60 font-mono truncate">
                    {formatPubkey(contact.pubkey)}
                  </p>
                </div>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="w-5 h-5 text-base-content/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Help Text -->
      {#if !searchInput && recentContacts.length === 0}
        <div class="alert alert-info mb-6">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="w-6 h-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <div class="text-sm">
            <p>Enter a Nostr public key to start a private conversation.</p>
            <p class="mt-1">
              Public keys are 64-character hexadecimal strings starting with npub or in raw hex format.
            </p>
          </div>
        </div>
      {/if}

      <!-- Actions -->
      <div class="modal-action">
        <button class="btn btn-ghost" on:click={handleClose}>Cancel</button>
        <button
          class="btn btn-primary"
          on:click={handleStart}
          disabled={!isValidPubkey && !selectedPubkey}
        >
          Start Conversation
        </button>
      </div>
    </div>

    <!-- Backdrop -->
    <div class="modal-backdrop" on:click={handleClose}></div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: -1;
  }
</style>
