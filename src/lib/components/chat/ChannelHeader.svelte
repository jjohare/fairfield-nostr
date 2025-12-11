<script lang="ts">
  import { selectedChannel } from '$lib/stores/channelStore';
  import { channelStore } from '$lib/stores/channelStore';

  export let showBackButton: boolean = false;

  function handleBack() {
    channelStore.selectChannel(null);
  }
</script>

{#if $selectedChannel}
  <div class="flex items-center gap-3 p-4 border-b border-base-300 bg-base-100">
    {#if showBackButton}
      <button
        class="btn btn-ghost btn-sm btn-square md:hidden"
        on:click={handleBack}
        aria-label="Back to channels"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
        </svg>
      </button>
    {/if}

    <div class="flex-1 min-w-0">
      <div class="flex items-center gap-2 mb-1">
        <h1 class="text-xl font-bold truncate">{$selectedChannel.name}</h1>
        {#if $selectedChannel.isEncrypted}
          <div class="tooltip tooltip-bottom" data-tip="End-to-end encrypted">
            <div class="badge badge-sm badge-primary gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clip-rule="evenodd" />
              </svg>
              E2E
            </div>
          </div>
        {/if}
      </div>
      <p class="text-sm text-base-content/70 truncate">{$selectedChannel.description}</p>
    </div>

    <div class="flex items-center gap-2">
      <div class="tooltip tooltip-bottom" data-tip="{$selectedChannel.members.length} members">
        <div class="flex items-center gap-1 px-2 py-1 rounded-lg bg-base-200">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/70" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
          <span class="text-sm font-medium">{$selectedChannel.members.length}</span>
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="flex items-center justify-center p-4 border-b border-base-300 bg-base-100">
    <p class="text-base-content/60">Select a channel to start chatting</p>
  </div>
{/if}
