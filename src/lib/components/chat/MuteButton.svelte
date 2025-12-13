<script lang="ts">
  import { muteStore, createIsMutedStore } from '$lib/stores/mute';
  import { createEventDispatcher } from 'svelte';

  export let pubkey: string;
  export let compact = false;
  export let showLabel = true;

  const dispatch = createEventDispatcher<{ muted: void; unmuted: void }>();

  let showConfirmDialog = false;
  let muteReason = '';

  $: isMuted = createIsMutedStore(pubkey);

  function handleToggleMute() {
    if ($isMuted) {
      muteStore.unmuteUser(pubkey);
      dispatch('unmuted');
    } else {
      showConfirmDialog = true;
    }
  }

  function confirmMute() {
    muteStore.muteUser(pubkey, muteReason || undefined);
    showConfirmDialog = false;
    muteReason = '';
    dispatch('muted');
  }

  function cancelMute() {
    showConfirmDialog = false;
    muteReason = '';
  }
</script>

{#if compact}
  <button
    class="btn btn-ghost btn-xs"
    on:click={handleToggleMute}
    aria-label={$isMuted ? 'Unmute user' : 'Mute user'}
  >
    {#if $isMuted}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
      </svg>
    {/if}
    {#if showLabel}
      <span class="ml-1">{$isMuted ? 'Unmute' : 'Mute'}</span>
    {/if}
  </button>
{:else}
  <button
    class="btn {$isMuted ? 'btn-error' : 'btn-ghost'} btn-sm"
    on:click={handleToggleMute}
  >
    {#if $isMuted}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clip-rule="evenodd" />
        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
      </svg>
      <span>Unmute User</span>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" />
      </svg>
      <span>Mute User</span>
    {/if}
  </button>
{/if}

{#if showConfirmDialog}
  <div class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Mute User</h3>
      <p class="py-4">
        Are you sure you want to mute this user? You won't see their messages, DMs, or notifications.
      </p>

      <div class="form-control">
        <label class="label" for="mute-reason">
          <span class="label-text">Reason (optional)</span>
        </label>
        <input
          id="mute-reason"
          type="text"
          placeholder="Why are you muting this user?"
          class="input input-bordered"
          bind:value={muteReason}
        />
      </div>

      <div class="modal-action">
        <button class="btn btn-ghost" on:click={cancelMute}>Cancel</button>
        <button class="btn btn-error" on:click={confirmMute}>Mute User</button>
      </div>
    </div>
    <div class="modal-backdrop" on:click={cancelMute}></div>
  </div>
{/if}

<style>
  .modal-backdrop {
    background-color: rgba(0, 0, 0, 0.5);
  }
</style>
