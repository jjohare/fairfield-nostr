<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authStore, isAuthenticated, isAdmin } from '$lib/stores/auth';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { bookmarkCount } from '$lib/stores/bookmarks';
  import NotificationBell from '$lib/components/ui/NotificationBell.svelte';
  import BookmarksModal from '$lib/components/chat/BookmarksModal.svelte';
  import GlobalSearch from '$lib/components/chat/GlobalSearch.svelte';
  import { goto } from '$app/navigation';

  $: isAuth = $isAuthenticated;
  $: isAdminUser = $isAdmin;

  let showBookmarksModal = false;
  let isSearchOpen = false;

  function openBookmarks() {
    showBookmarksModal = true;
  }

  function openSearch() {
    isSearchOpen = true;
  }

  function closeSearch() {
    isSearchOpen = false;
  }

  function handleNavigate(event: CustomEvent<{ channelId: string; messageId: string }>) {
    const { channelId } = event.detail;
    goto(`${base}/chat/${channelId}`);
  }

  function handleKeydown(event: KeyboardEvent) {
    // Cmd/Ctrl + K to open search
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      openSearch();
    }
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
  });
</script>

<nav class="navbar">
  <div class="nav-container">
    <a href="{base}/" class="logo">
      Minimoomaa Noir
    </a>

    <div class="nav-links">
      {#if isAuth}
        <button on:click={openSearch} class="search-btn" title="Search Messages (Cmd/Ctrl + K)">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="search-shortcut">⌘K</span>
        </button>
        <a href="{base}/chat" class:active={$page.url.pathname.startsWith(`${base}/chat`)}>
          Channels
        </a>
        <a href="{base}/dm" class:active={$page.url.pathname.startsWith(`${base}/dm`)}>
          Messages
        </a>
        <button on:click={openBookmarks} class="bookmark-btn" aria-label="Bookmarks">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          {#if $bookmarkCount > 0}
            <span class="bookmark-badge">{$bookmarkCount}</span>
          {/if}
        </button>
        {#if isAdminUser}
          <a href="{base}/admin" class:active={$page.url.pathname === `${base}/admin`}>
            Admin
          </a>
        {/if}
        <NotificationBell />
        <button on:click={() => authStore.logout()} class="logout-btn">
          Logout
        </button>
      {:else}
        <a href="{base}/signup">Sign Up</a>
      {/if}
    </div>
  </div>
</nav>

<style>
  .navbar {
    background: #667eea;
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 1rem 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    text-decoration: none;
  }

  .nav-links {
    display: flex;
    gap: 1.5rem;
    align-items: center;
  }

  .nav-links a {
    color: white;
    text-decoration: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .nav-links a:hover,
  .nav-links a.active {
    background: rgba(255, 255, 255, 0.2);
  }

  .logout-btn {
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
  }

  .logout-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .bookmark-btn {
    position: relative;
    background: rgba(255, 255, 255, 0.2);
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .bookmark-btn:hover {
    background: rgba(255, 255, 255, 0.3);
  }

  .bookmark-badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ff4444;
    color: white;
    border-radius: 10px;
    padding: 2px 6px;
    font-size: 0.75rem;
    font-weight: bold;
    min-width: 18px;
    text-align: center;
  }

  .search-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: rgba(255, 255, 255, 0.15);
    color: white;
    border: 1px solid rgba(255, 255, 255, 0.3);
    padding: 0.5rem 1rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-btn:hover {
    background: rgba(255, 255, 255, 0.25);
  }

  .search-icon {
    width: 18px;
    height: 18px;
  }

  .search-shortcut {
    font-size: 0.75rem;
    opacity: 0.8;
    font-family: monospace;
  }

  @media (max-width: 640px) {
    .nav-container {
      flex-direction: column;
      gap: 1rem;
    }

    .nav-links {
      flex-wrap: wrap;
      justify-content: center;
    }

    .search-shortcut {
      display: none;
    }
  }
</style>

{#if showBookmarksModal}
  <BookmarksModal on:close={() => showBookmarksModal = false} on:navigate={handleNavigate} />
{/if}

<GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
