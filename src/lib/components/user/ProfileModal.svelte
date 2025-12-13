<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import MuteButton from '$lib/components/chat/MuteButton.svelte';
  import { nip19 } from 'nostr-tools';
  import { getAvatarUrl } from '$lib/utils/identicon';

  export let pubkey: string;
  export let name: string | null = null;
  export let avatar: string | null = null;
  export let about: string | null = null;
  export let nip05: string | null = null;
  export let show = false;

  const dispatch = createEventDispatcher<{ close: void; startDM: { pubkey: string } }>();

  $: npub = nip19.npubEncode(pubkey);
  $: displayName = name || `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
  $: avatarUrl = avatar || getAvatarUrl(pubkey, 80);

  function handleClose() {
    show = false;
    dispatch('close');
  }

  function handleStartDM() {
    dispatch('startDM', { pubkey });
    handleClose();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }
</script>

{#if show}
  <div class="modal modal-open">
    <div class="modal-box max-w-2xl">
      <button
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        on:click={handleClose}
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </button>

      <div class="flex flex-col items-center py-6">
        <div class="avatar mb-4">
          <div class="w-24 h-24 rounded-full ring ring-primary ring-offset-base-100 ring-offset-2">
            <img src={avatarUrl} alt={displayName} />
          </div>
        </div>

        <h2 class="text-2xl font-bold mb-1">{displayName}</h2>

        {#if nip05}
          <div class="badge badge-success gap-2 mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
            </svg>
            {nip05}
          </div>
        {/if}

        {#if about}
          <p class="text-base-content/80 text-center mb-4 px-4">{about}</p>
        {/if}

        <div class="w-full px-4 mb-4">
          <div class="flex items-center gap-2 bg-base-200 rounded-lg p-3">
            <code class="text-xs flex-1 truncate">{npub}</code>
            <button
              class="btn btn-ghost btn-xs"
              on:click={() => copyToClipboard(npub)}
              aria-label="Copy npub"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 justify-center">
          <button class="btn btn-primary" on:click={handleStartDM}>
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
              <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
            </svg>
            Send DM
          </button>

          <MuteButton {pubkey} compact={false} />
        </div>
      </div>
    </div>
    <div class="modal-backdrop" on:click={handleClose}></div>
  </div>
{/if}

<style>
  .modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }
</style>
