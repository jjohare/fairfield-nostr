<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import { getMessageReactions, reactionStore } from '$lib/stores/reactions';
  import { authStore } from '$lib/stores/auth';
  import { getReactionEmoji } from '$lib/nostr/reactions';
  import { profileCache } from '$lib/stores/profiles';

  export let messageId: string;
  export let relayUrl: string = '';
  export let authorPubkey: string = '';

  const dispatch = createEventDispatcher<{
    react: { emoji: string };
    unreact: void;
  }>();

  $: reactions = getMessageReactions(messageId);
  $: isAuthenticated = $authStore.isAuthenticated;

  async function handleReactionClick(emoji: string) {
    if (!isAuthenticated) {
      return;
    }

    try {
      const summary = reactionStore.getReactionSummary(messageId);

      // Toggle reaction if user already reacted with this emoji
      if (summary.userReaction === emoji) {
        await reactionStore.removeReaction(messageId, relayUrl);
        dispatch('unreact');
      } else {
        await reactionStore.addReaction(messageId, emoji, relayUrl, authorPubkey);
        dispatch('react', { emoji });
      }
    } catch (error) {
      console.error('Failed to toggle reaction:', error);
    }
  }

  function getReactorNames(reactors: string[]): string {
    const currentUserPubkey = $authStore.publicKey;
    const names = reactors.map(pubkey => {
      if (pubkey === currentUserPubkey) {
        return 'You';
      }
      const cached = profileCache.getCachedSync(pubkey);
      return cached?.displayName || `${pubkey.slice(0, 8)}...${pubkey.slice(-4)}`;
    });

    if (names.length === 0) return '';
    if (names.length === 1) return names[0];
    if (names.length === 2) return `${names[0]} and ${names[1]}`;

    return `${names[0]}, ${names[1]} and ${names.length - 2} other${names.length - 2 > 1 ? 's' : ''}`;
  }

  // Prefetch profiles for reactors
  onMount(() => {
    const allReactors = Array.from($reactions.reactions.values())
      .flatMap(r => r.reactors)
      .filter(pubkey => pubkey !== $authStore.publicKey);

    if (allReactors.length > 0) {
      profileCache.prefetchProfiles(allReactors);
    }
  });
</script>

{#if $reactions.totalCount > 0}
  <div class="flex flex-wrap gap-1 mt-2">
    {#each Array.from($reactions.reactions.values()) as reaction}
      <button
        class="btn btn-xs {reaction.userReacted ? 'btn-primary' : 'btn-ghost'} gap-1 hover:scale-105 transition-transform"
        on:click={() => handleReactionClick(reaction.content)}
        disabled={!isAuthenticated}
        title={getReactorNames(reaction.reactors)}
      >
        <span class="text-base leading-none">
          {getReactionEmoji(reaction.content)}
        </span>
        <span class="text-xs font-medium">
          {reaction.count}
        </span>
      </button>
    {/each}
  </div>
{/if}

<style>
  button {
    min-height: 1.75rem;
    height: 1.75rem;
    padding: 0 0.5rem;
  }
</style>
