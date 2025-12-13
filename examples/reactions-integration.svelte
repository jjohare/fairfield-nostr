<!--
  Example: Integrating NIP-25 Reactions into a Message List

  This example shows how to add reaction support to an existing channel message list.
-->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import MessageItem from '$lib/components/chat/MessageItem.svelte';
  import { reactionStore } from '$lib/stores/reactions';
  import type { Message } from '$lib/types/channel';

  // Props
  export let messages: Message[] = [];
  export let channelId: string;
  export let relayUrl: string = 'wss://relay.damus.io'; // Default relay

  // State
  let loading = false;
  let error: string | null = null;

  // Reactive message IDs
  $: messageIds = messages.map(m => m.id);

  // Initialize reactions on mount
  onMount(async () => {
    if (messageIds.length === 0) return;

    try {
      loading = true;
      error = null;

      // 1. Fetch existing reactions for all messages
      await reactionStore.fetchReactions(messageIds, relayUrl);

      // 2. Subscribe to real-time reaction updates
      await reactionStore.subscribeToReactions(messageIds, relayUrl);

      loading = false;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load reactions';
      loading = false;
      console.error('Reaction initialization error:', err);
    }
  });

  // When new messages are added, update subscriptions
  $: if (messageIds.length > 0 && !loading) {
    updateReactionSubscriptions();
  }

  async function updateReactionSubscriptions() {
    try {
      // Fetch reactions for new messages
      await reactionStore.fetchReactions(messageIds, relayUrl);

      // Update real-time subscription
      reactionStore.unsubscribe(relayUrl);
      await reactionStore.subscribeToReactions(messageIds, relayUrl);
    } catch (err) {
      console.error('Failed to update reaction subscriptions:', err);
    }
  }

  // Cleanup on component destroy
  onDestroy(() => {
    reactionStore.unsubscribe(relayUrl);
  });

  // Handle reaction events
  function handleReact(event: CustomEvent<{ emoji: string }>, messageId: string) {
    console.log(`User reacted to ${messageId} with ${event.detail.emoji}`);
  }

  function handleUnreact(messageId: string) {
    console.log(`User removed reaction from ${messageId}`);
  }
</script>

<div class="message-list-with-reactions">
  {#if error}
    <div class="alert alert-error mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>{error}</span>
    </div>
  {/if}

  {#if loading}
    <div class="flex justify-center items-center py-8">
      <div class="loading loading-spinner loading-lg"></div>
      <span class="ml-3">Loading reactions...</span>
    </div>
  {/if}

  <div class="space-y-4">
    {#each messages as message (message.id)}
      <MessageItem
        {message}
        {relayUrl}
        channelName={channelId}
        on:react={(e) => handleReact(e, message.id)}
        on:unreact={() => handleUnreact(message.id)}
      />
    {/each}
  </div>

  {#if messages.length === 0}
    <div class="text-center py-8 text-base-content/60">
      No messages yet. Be the first to send one!
    </div>
  {/if}
</div>

<style>
  .message-list-with-reactions {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
  }

  /* Add smooth scrolling */
  :global(.message-list-with-reactions) {
    scroll-behavior: smooth;
  }

  /* Optimize for mobile */
  @media (max-width: 768px) {
    .message-list-with-reactions {
      padding: 0.5rem;
    }
  }
</style>

<!--
  INTEGRATION NOTES:

  1. This component automatically:
     - Fetches reactions when mounted
     - Subscribes to real-time updates
     - Cleans up subscriptions on unmount
     - Updates subscriptions when messages change

  2. Each MessageItem component:
     - Shows ReactionBar below the message
     - Provides a reaction picker button
     - Handles optimistic updates automatically

  3. To use in your page:
     ```svelte
     <script>
       import ReactionsMessageList from './examples/reactions-integration.svelte';
       import { messageStore } from '$lib/stores/messages';

       const channelId = 'your-channel-id';
       const relayUrl = 'wss://your-relay.com';
     </script>

     <ReactionsMessageList
       messages={$messageStore.messages}
       {channelId}
       {relayUrl}
     />
     ```

  4. Performance tips:
     - Use virtual scrolling for large message lists
     - Implement pagination to limit active subscriptions
     - Debounce subscription updates when messages change rapidly
     - Consider caching reactions in IndexedDB

  5. Customization:
     - Override CSS classes for styling
     - Add your own event handlers
     - Customize reaction picker emojis
     - Add reaction analytics/insights
-->
