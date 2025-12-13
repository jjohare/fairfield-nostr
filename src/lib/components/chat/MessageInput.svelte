<script lang="ts">
  import { tick, onMount, onDestroy } from 'svelte';
  import { channelStore, selectedChannel, userMemberStatus } from '$lib/stores/channelStore';
  import { authStore } from '$lib/stores/auth';
  import { draftStore } from '$lib/stores/drafts';
  import { notificationStore } from '$lib/stores/notifications';
  import { createMentionTags, extractMentionedPubkeys, formatPubkey } from '$lib/utils/mentions';
  import MentionAutocomplete from './MentionAutocomplete.svelte';
  import type { Message } from '$lib/types/channel';
  import type { UserProfile } from '$lib/stores/user';

  let messageText = '';
  let textareaElement: HTMLTextAreaElement;
  let isSending = false;
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  let hasDraft = false;

  // Mention autocomplete state
  let showMentionAutocomplete = false;
  let mentionQuery = '';
  let mentionStartIndex = -1;
  let autocompletePosition = { top: 0, left: 0 };
  let availableUsers: UserProfile[] = [];

  $: canSend = $userMemberStatus === 'member' || $userMemberStatus === 'admin';
  $: placeholder = canSend
    ? 'Type a message... (@mention users)'
    : $userMemberStatus === 'pending'
      ? 'Your join request is pending...'
      : 'Join this channel to send messages';

  // Load draft when channel changes
  $: if ($selectedChannel) {
    loadDraft($selectedChannel.id);
    loadChannelUsers($selectedChannel);
  }

  // Update draft indicator
  $: if ($selectedChannel) {
    hasDraft = draftStore.hasDraft($selectedChannel.id);
  }

  onMount(() => {
    // Load initial draft if a channel is selected
    if ($selectedChannel) {
      loadDraft($selectedChannel.id);
      loadChannelUsers($selectedChannel);
    }

    // Save draft on beforeunload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }
  });

  onDestroy(() => {
    // Save draft before component unmounts
    saveDraftImmediately();

    // Clear timeout
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Remove event listener
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  });

  function loadChannelUsers(channel: typeof $selectedChannel) {
    if (!channel) {
      availableUsers = [];
      return;
    }

    // Create user profiles from channel members
    // In production, fetch full profiles from Nostr
    availableUsers = channel.members.map(pubkey => ({
      pubkey,
      name: null,
      displayName: null,
      avatar: null,
      about: null,
      cohorts: [],
      isAdmin: channel.admins.includes(pubkey),
      isApproved: true,
      nip05: null,
      lud16: null,
      website: null,
      banner: null,
      createdAt: null,
      updatedAt: null
    }));
  }

  function loadDraft(channelId: string) {
    const draft = draftStore.getDraft(channelId);
    if (draft !== null) {
      messageText = draft;
      // Trigger auto-resize after loading draft
      tick().then(() => autoResize());
    } else {
      messageText = '';
    }
  }

  function saveDraftDebounced() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(() => {
      saveDraftImmediately();
    }, 1000);
  }

  function saveDraftImmediately() {
    if ($selectedChannel) {
      draftStore.saveDraft($selectedChannel.id, messageText);
      hasDraft = draftStore.hasDraft($selectedChannel.id);
    }
  }

  function handleBeforeUnload() {
    saveDraftImmediately();
  }

  async function handleKeyDown(event: KeyboardEvent) {
    // Let MentionAutocomplete handle navigation keys when visible
    if (showMentionAutocomplete && ['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      await sendMessage();
    }
  }

  async function sendMessage() {
    if (!messageText.trim() || !$selectedChannel || !$authStore.publicKey || !canSend || isSending) {
      return;
    }

    isSending = true;
    const content = messageText.trim();
    const channelId = $selectedChannel.id;
    const channelName = $selectedChannel.name;
    messageText = '';

    // Close mention autocomplete
    showMentionAutocomplete = false;

    try {
      await tick();
      if (textareaElement) {
        textareaElement.style.height = 'auto';
      }

      // Extract mentioned users
      const mentionedPubkeys = extractMentionedPubkeys(content);

      const message: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        channelId: channelId,
        authorPubkey: $authStore.publicKey,
        content: content,
        createdAt: Date.now(),
        isEncrypted: $selectedChannel.isEncrypted,
        decryptedContent: $selectedChannel.isEncrypted ? content : undefined
      };

      channelStore.addMessage(message);

      // Send notifications to mentioned users
      for (const mentionedPubkey of mentionedPubkeys) {
        if (mentionedPubkey !== $authStore.publicKey) {
          // Get sender name
          const senderName = $authStore.profile?.displayName ||
                            $authStore.profile?.name ||
                            formatPubkey($authStore.publicKey);

          // Create preview (first 50 chars)
          const preview = content.length > 50 ? content.slice(0, 50) + '...' : content;

          notificationStore.addMentionNotification({
            channelId,
            channelName,
            senderPubkey: $authStore.publicKey,
            senderName,
            messagePreview: preview
          });
        }
      }

      // Clear draft after successful send
      draftStore.clearDraft(channelId);
      hasDraft = false;

    } catch (error) {
      console.error('Failed to send message:', error);
      messageText = content;
      alert('Failed to send message. Please try again.');
    } finally {
      isSending = false;
    }
  }

  function autoResize() {
    if (textareaElement) {
      textareaElement.style.height = 'auto';
      textareaElement.style.height = textareaElement.scrollHeight + 'px';
    }
  }

  function handleInput() {
    autoResize();
    saveDraftDebounced();
    checkForMentionTrigger();
  }

  function handleBlur() {
    saveDraftImmediately();
  }

  function checkForMentionTrigger() {
    if (!textareaElement) return;

    const cursorPos = textareaElement.selectionStart;
    const textBeforeCursor = messageText.slice(0, cursorPos);

    // Find the last @ symbol before cursor
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex === -1) {
      showMentionAutocomplete = false;
      return;
    }

    // Check if there's whitespace between @ and cursor
    const textAfterAt = textBeforeCursor.slice(lastAtIndex + 1);
    if (/\s/.test(textAfterAt)) {
      showMentionAutocomplete = false;
      return;
    }

    // Show autocomplete
    mentionStartIndex = lastAtIndex;
    mentionQuery = textAfterAt;
    showMentionAutocomplete = true;

    // Calculate position for autocomplete
    updateAutocompletePosition();
  }

  function updateAutocompletePosition() {
    if (!textareaElement) return;

    const rect = textareaElement.getBoundingClientRect();

    // Position above textarea
    autocompletePosition = {
      top: rect.top - 10,
      left: rect.left
    };
  }

  function handleMentionSelect(event: CustomEvent<{ user: UserProfile }>) {
    const user = event.detail.user;

    // Replace @query with @pubkey
    const before = messageText.slice(0, mentionStartIndex);
    const after = messageText.slice(textareaElement.selectionStart);
    messageText = before + `@${user.pubkey} ` + after;

    // Close autocomplete
    showMentionAutocomplete = false;
    mentionQuery = '';
    mentionStartIndex = -1;

    // Focus back on textarea
    tick().then(() => {
      if (textareaElement) {
        const newCursorPos = before.length + user.pubkey.length + 2; // +2 for @ and space
        textareaElement.focus();
        textareaElement.setSelectionRange(newCursorPos, newCursorPos);
      }
      autoResize();
    });
  }

  function handleMentionCancel() {
    showMentionAutocomplete = false;
    mentionQuery = '';
    mentionStartIndex = -1;
  }
</script>

<div class="border-t border-base-300 bg-base-100 p-4 relative">
  <MentionAutocomplete
    bind:visible={showMentionAutocomplete}
    searchQuery={mentionQuery}
    users={availableUsers}
    position={autocompletePosition}
    on:select={handleMentionSelect}
    on:cancel={handleMentionCancel}
  />

  <div class="flex gap-2 items-end">
    <div class="flex-1">
      <textarea
        bind:this={textareaElement}
        bind:value={messageText}
        on:keydown={handleKeyDown}
        on:input={handleInput}
        on:blur={handleBlur}
        placeholder={placeholder}
        disabled={!canSend || isSending}
        rows="1"
        class="textarea textarea-bordered w-full resize-none min-h-[2.5rem] max-h-32 disabled:bg-base-200 disabled:text-base-content/50"
        style="overflow-y: auto;"
      ></textarea>
      <div class="text-xs text-base-content/60 mt-1 px-1 flex items-center gap-2">
        <span>Press Enter to send, Shift+Enter for new line</span>
        {#if hasDraft && messageText.trim()}
          <span class="badge badge-xs badge-warning gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Draft saved
          </span>
        {/if}
      </div>
    </div>

    <button
      class="btn btn-primary btn-square"
      on:click={sendMessage}
      disabled={!messageText.trim() || !canSend || isSending}
      aria-label="Send message"
    >
      {#if isSending}
        <span class="loading loading-spinner loading-sm"></span>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
        </svg>
      {/if}
    </button>
  </div>

  {#if !canSend && $userMemberStatus !== 'pending'}
    <div class="alert alert-info mt-2 text-sm">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <span>You must be a member to send messages in this channel.</span>
    </div>
  {/if}
</div>
