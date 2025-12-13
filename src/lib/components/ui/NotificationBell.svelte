<script lang="ts">
  import { notificationStore, recentNotifications, unreadCount } from '$lib/stores/notifications';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import Badge from './Badge.svelte';
  import { onMount } from 'svelte';

  let showDropdown = false;
  let dropdownElement: HTMLDivElement;

  $: notifications = $recentNotifications;
  $: unread = $unreadCount;

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function closeDropdown() {
    showDropdown = false;
  }

  function handleNotificationClick(notification: any) {
    notificationStore.markAsRead(notification.id);

    // Navigate to relevant page
    if (notification.url) {
      goto(notification.url);
    } else if (notification.channelId && notification.type === 'message') {
      goto(`${base}/chat?channel=${notification.channelId}`);
    } else if (notification.type === 'dm') {
      goto(`${base}/dm${notification.senderPubkey ? `?user=${notification.senderPubkey}` : ''}`);
    }

    closeDropdown();
  }

  function clearAll() {
    notificationStore.clearAll();
    closeDropdown();
  }

  function markAllRead() {
    notificationStore.markAllAsRead();
  }

  function formatTime(timestamp: number): string {
    const now = Date.now();
    const diff = now - timestamp;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  function getNotificationIcon(type: string): string {
    switch (type) {
      case 'message':
        return '💬';
      case 'dm':
        return '✉️';
      case 'mention':
        return '@';
      case 'join-request':
        return '👋';
      case 'system':
        return 'ℹ️';
      default:
        return '🔔';
    }
  }

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    if (dropdownElement && !dropdownElement.contains(event.target as Node)) {
      closeDropdown();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<div class="notification-bell" bind:this={dropdownElement}>
  <button
    class="bell-button"
    on:click={toggleDropdown}
    aria-label="Notifications"
    aria-expanded={showDropdown}
  >
    <span class="bell-icon">🔔</span>
    {#if unread > 0}
      <Badge variant="error" size="sm" class="notification-badge">
        {unread > 99 ? '99+' : unread}
      </Badge>
    {/if}
  </button>

  {#if showDropdown}
    <div class="dropdown">
      <div class="dropdown-header">
        <h3>Notifications</h3>
        {#if notifications.length > 0}
          <div class="header-actions">
            {#if unread > 0}
              <button class="action-btn" on:click={markAllRead}>Mark all read</button>
            {/if}
            <button class="action-btn" on:click={clearAll}>Clear all</button>
          </div>
        {/if}
      </div>

      <div class="notification-list">
        {#if notifications.length === 0}
          <div class="empty-state">
            <span class="empty-icon">🔕</span>
            <p>No notifications</p>
          </div>
        {:else}
          {#each notifications as notification (notification.id)}
            <button
              class="notification-item"
              class:unread={!notification.read}
              on:click={() => handleNotificationClick(notification)}
            >
              <div class="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div class="notification-content">
                <div class="notification-message">
                  {notification.message}
                </div>
                {#if notification.channelName}
                  <div class="notification-meta">
                    in {notification.channelName}
                  </div>
                {/if}
                {#if notification.senderName}
                  <div class="notification-meta">
                    from {notification.senderName}
                  </div>
                {/if}
                <div class="notification-time">
                  {formatTime(notification.timestamp)}
                </div>
              </div>
              {#if !notification.read}
                <div class="unread-indicator" />
              {/if}
            </button>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .notification-bell {
    position: relative;
  }

  .bell-button {
    position: relative;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.5rem;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .bell-button:hover {
    background: rgba(255, 255, 255, 0.1);
  }

  .bell-icon {
    font-size: 1.5rem;
    display: block;
  }

  .notification-bell :global(.notification-badge) {
    position: absolute;
    top: 0;
    right: 0;
    min-width: 1.25rem;
    height: 1.25rem;
    padding: 0 0.25rem;
    border-radius: 0.625rem;
    font-size: 0.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ef4444;
    color: white;
    font-weight: 600;
  }

  .dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    right: 0;
    width: 360px;
    max-width: calc(100vw - 2rem);
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05);
    z-index: 1000;
    overflow: hidden;
  }

  .dropdown-header {
    padding: 1rem;
    border-bottom: 1px solid #e5e7eb;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .dropdown-header h3 {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: #111827;
  }

  .header-actions {
    display: flex;
    gap: 0.5rem;
  }

  .action-btn {
    background: transparent;
    border: none;
    color: #667eea;
    cursor: pointer;
    font-size: 0.875rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    transition: background 0.2s;
  }

  .action-btn:hover {
    background: #f3f4f6;
  }

  .notification-list {
    max-height: 400px;
    overflow-y: auto;
  }

  .empty-state {
    padding: 3rem 1rem;
    text-align: center;
    color: #9ca3af;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 0.5rem;
    opacity: 0.5;
  }

  .empty-state p {
    margin: 0;
    font-size: 0.875rem;
  }

  .notification-item {
    display: flex;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    width: 100%;
    border: none;
    background: transparent;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
    border-bottom: 1px solid #f3f4f6;
  }

  .notification-item:hover {
    background: #f9fafb;
  }

  .notification-item:last-child {
    border-bottom: none;
  }

  .notification-item.unread {
    background: #eff6ff;
  }

  .notification-item.unread:hover {
    background: #dbeafe;
  }

  .notification-icon {
    flex-shrink: 0;
    font-size: 1.25rem;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f3f4f6;
    border-radius: 50%;
  }

  .notification-item.unread .notification-icon {
    background: #dbeafe;
  }

  .notification-content {
    flex: 1;
    min-width: 0;
  }

  .notification-message {
    font-size: 0.875rem;
    color: #111827;
    margin-bottom: 0.25rem;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .notification-meta {
    font-size: 0.75rem;
    color: #6b7280;
    margin-bottom: 0.125rem;
  }

  .notification-time {
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .unread-indicator {
    flex-shrink: 0;
    width: 0.5rem;
    height: 0.5rem;
    background: #667eea;
    border-radius: 50%;
    margin-top: 0.5rem;
  }

  @media (max-width: 640px) {
    .dropdown {
      position: fixed;
      top: auto;
      right: 1rem;
      left: 1rem;
      width: auto;
      max-width: none;
    }
  }
</style>
