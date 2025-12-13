<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { formatPubkey } from '$lib/utils/mentions';
  import type { UserProfile } from '$lib/stores/user';
  import { getAvatarUrl } from '$lib/utils/identicon';

  export let searchQuery: string = '';
  export let users: UserProfile[] = [];
  export let position: { top: number; left: number } = { top: 0, left: 0 };
  export let visible: boolean = false;

  const dispatch = createEventDispatcher<{
    select: { user: UserProfile };
    cancel: void;
  }>();

  let selectedIndex = 0;
  let autocompleteElement: HTMLDivElement;

  $: filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    const name = (user.displayName || user.name || '').toLowerCase();
    const pubkey = user.pubkey.toLowerCase();

    return (
      name.includes(query) ||
      pubkey.includes(query) ||
      formatPubkey(pubkey).toLowerCase().includes(query)
    );
  }).slice(0, 5); // Limit to 5 results

  $: if (selectedIndex >= filteredUsers.length) {
    selectedIndex = Math.max(0, filteredUsers.length - 1);
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!visible) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredUsers.length - 1);
        scrollToSelected();
        break;

      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        scrollToSelected();
        break;

      case 'Enter':
      case 'Tab':
        event.preventDefault();
        if (filteredUsers[selectedIndex]) {
          selectUser(filteredUsers[selectedIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        dispatch('cancel');
        break;
    }
  }

  function selectUser(user: UserProfile) {
    dispatch('select', { user });
    selectedIndex = 0;
  }

  function scrollToSelected() {
    if (!autocompleteElement) return;

    const selectedElement = autocompleteElement.querySelector(`[data-index="${selectedIndex}"]`);
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  function getDisplayName(user: UserProfile): string {
    return user.displayName || user.name || formatPubkey(user.pubkey);
  }

  function getAvatar(user: UserProfile): string {
    return user.avatar || getAvatarUrl(user.pubkey, 48);
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  });
</script>

{#if visible && filteredUsers.length > 0}
  <div
    bind:this={autocompleteElement}
    class="mention-autocomplete absolute z-50 bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden max-h-64 overflow-y-auto"
    style="top: {position.top}px; left: {position.left}px; min-width: 280px;"
  >
    <div class="p-2 text-xs text-base-content/60 font-medium border-b border-base-300">
      Mention user
    </div>

    <ul class="menu menu-compact p-1">
      {#each filteredUsers as user, index}
        <li>
          <button
            class="flex items-center gap-3 px-3 py-2 hover:bg-base-200 rounded-lg transition-colors {index === selectedIndex ? 'bg-base-200' : ''}"
            data-index={index}
            on:click={() => selectUser(user)}
            on:mouseenter={() => selectedIndex = index}
          >
            <div class="avatar flex-shrink-0">
              <div class="w-8 h-8 rounded-full ring ring-base-300 ring-offset-base-100 ring-offset-1">
                <img
                  src={getAvatar(user)}
                  alt={getDisplayName(user)}
                  class="object-cover"
                />
              </div>
            </div>

            <div class="flex-1 min-w-0 text-left">
              <div class="font-medium text-sm truncate">
                {getDisplayName(user)}
              </div>
              <div class="text-xs text-base-content/60 truncate">
                {formatPubkey(user.pubkey)}
              </div>
            </div>

            {#if index === selectedIndex}
              <div class="flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-primary" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                </svg>
              </div>
            {/if}
          </button>
        </li>
      {/each}
    </ul>

    <div class="p-2 text-xs text-base-content/60 border-t border-base-300 bg-base-50">
      <span class="font-mono">↑↓</span> Navigate
      <span class="mx-2">•</span>
      <span class="font-mono">Enter/Tab</span> Select
      <span class="mx-2">•</span>
      <span class="font-mono">Esc</span> Cancel
    </div>
  </div>
{/if}

<style>
  .mention-autocomplete {
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
  }

  .mention-autocomplete :global(.menu li button) {
    border-radius: 0.5rem;
  }
</style>
