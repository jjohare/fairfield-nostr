<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authStore, isAuthenticated } from '$lib/stores/auth';
  import { isAdminVerified } from '$lib/stores/user';
  import { page } from '$app/stores';
  import { base } from '$app/paths';
  import { bookmarkCount } from '$lib/stores/bookmarks';
  import NotificationBell from '$lib/components/ui/NotificationBell.svelte';
  import BookmarksModal from '$lib/components/chat/BookmarksModal.svelte';
  import GlobalSearch from '$lib/components/chat/GlobalSearch.svelte';
  import { goto } from '$app/navigation';

  $: isAuth = $isAuthenticated;
  $: isAdminUser = $isAdminVerified;

  let showBookmarksModal = false;
  let isSearchOpen = false;
  let isMobileMenuOpen = false;
  let touchStartX = 0;
  let touchCurrentX = 0;

  function openBookmarks() {
    showBookmarksModal = true;
  }

  function openSearch() {
    isSearchOpen = true;
  }

  function closeSearch() {
    isSearchOpen = false;
  }

  function toggleMobileMenu() {
    isMobileMenuOpen = !isMobileMenuOpen;

    // Lock/unlock body scroll
    if (typeof document !== 'undefined') {
      if (isMobileMenuOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
    }
  }

  function closeMobileMenu() {
    isMobileMenuOpen = false;
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
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
    // Escape to close mobile menu
    if (event.key === 'Escape' && isMobileMenuOpen) {
      closeMobileMenu();
    }
  }

  // Swipe to close gesture
  function handleTouchStart(event: TouchEvent) {
    touchStartX = event.touches[0].clientX;
  }

  function handleTouchMove(event: TouchEvent) {
    touchCurrentX = event.touches[0].clientX;
  }

  function handleTouchEnd() {
    const diff = touchStartX - touchCurrentX;
    // Swipe left to close (threshold: 50px)
    if (diff > 50) {
      closeMobileMenu();
    }
    touchStartX = 0;
    touchCurrentX = 0;
  }

  onMount(() => {
    window.addEventListener('keydown', handleKeydown);
  });

  onDestroy(() => {
    window.removeEventListener('keydown', handleKeydown);
    // Ensure body scroll is restored
    if (typeof document !== 'undefined') {
      document.body.style.overflow = '';
    }
  });
</script>

<nav class="navbar" role="navigation" aria-label="Main navigation">
  <div class="nav-container">
    <a href="{base}/" class="logo" aria-label="Nostr BBS - Home">
      Nostr BBS
    </a>

    <!-- Hamburger Menu Button (Mobile Only) -->
    <button
      class="hamburger-btn"
      on:click={toggleMobileMenu}
      aria-label="Toggle menu"
      aria-expanded={isMobileMenuOpen}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" class="hamburger-icon">
        <path
          d="M4 6h16M4 12h16M4 18h16"
          stroke-width="2"
          stroke-linecap="round"
          class:hidden={isMobileMenuOpen}
        />
        <path
          d="M6 18L18 6M6 6l12 12"
          stroke-width="2"
          stroke-linecap="round"
          class:hidden={!isMobileMenuOpen}
        />
      </svg>
    </button>

    <!-- Desktop Navigation -->
    <div class="nav-links desktop-nav" role="menubar">
      {#if isAuth}
        <button on:click={openSearch} class="search-btn" title="Search Messages (Cmd/Ctrl + K)" aria-label="Open search (Cmd/Ctrl + K)" role="menuitem">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
          </svg>
          <span class="search-shortcut" aria-hidden="true">⌘K</span>
        </button>
        <a href="{base}/chat" class:active={$page.url.pathname.startsWith(`${base}/chat`)} role="menuitem" aria-current={$page.url.pathname.startsWith(`${base}/chat`) ? 'page' : undefined}>
          Channels
        </a>
        <a href="{base}/dm" class:active={$page.url.pathname.startsWith(`${base}/dm`)} role="menuitem" aria-current={$page.url.pathname.startsWith(`${base}/dm`) ? 'page' : undefined}>
          Messages
        </a>
        <button on:click={openBookmarks} class="bookmark-btn" aria-label="Bookmarks{$bookmarkCount > 0 ? ` (${$bookmarkCount} items)` : ''}" role="menuitem">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          {#if $bookmarkCount > 0}
            <span class="bookmark-badge" aria-hidden="true">{$bookmarkCount}</span>
          {/if}
        </button>
        {#if isAdminUser}
          <a href="{base}/admin" class:active={$page.url.pathname === `${base}/admin`} role="menuitem" aria-current={$page.url.pathname === `${base}/admin` ? 'page' : undefined}>
            Admin
          </a>
        {/if}
        <NotificationBell />
        <button on:click={() => authStore.logout()} class="logout-btn" aria-label="Logout from application" role="menuitem">
          Logout
        </button>
      {:else}
        <a href="{base}/signup" role="menuitem">Sign Up</a>
      {/if}
    </div>
  </div>
</nav>

<!-- Mobile Drawer Menu -->
{#if isMobileMenuOpen}
  <div class="mobile-menu-backdrop" on:click={closeMobileMenu} role="presentation"></div>
  <div
    class="mobile-menu-drawer"
    class:open={isMobileMenuOpen}
    on:touchstart={handleTouchStart}
    on:touchmove={handleTouchMove}
    on:touchend={handleTouchEnd}
    role="navigation"
    aria-label="Mobile navigation menu"
  >
    <div class="mobile-menu-content" role="menu">
      {#if isAuth}
        <button on:click={() => { openSearch(); closeMobileMenu(); }} class="mobile-menu-item" role="menuitem" aria-label="Open search">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <circle cx="11" cy="11" r="8" stroke-width="2"/>
            <path d="M21 21l-4.35-4.35" stroke-width="2" stroke-linecap="round"/>
          </svg>
          Search Messages
        </button>
        <a href="{base}/chat" class="mobile-menu-item" on:click={closeMobileMenu} class:active={$page.url.pathname.startsWith(`${base}/chat`)} role="menuitem" aria-current={$page.url.pathname.startsWith(`${base}/chat`) ? 'page' : undefined}>
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Channels
        </a>
        <a href="{base}/dm" class="mobile-menu-item" on:click={closeMobileMenu} class:active={$page.url.pathname.startsWith(`${base}/dm`)} role="menuitem" aria-current={$page.url.pathname.startsWith(`${base}/dm`) ? 'page' : undefined}>
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Messages
        </a>
        <button on:click={() => { openBookmarks(); closeMobileMenu(); }} class="mobile-menu-item" role="menuitem" aria-label="Open bookmarks{$bookmarkCount > 0 ? ` (${$bookmarkCount} items)` : ''}">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Bookmarks
          {#if $bookmarkCount > 0}
            <span class="mobile-badge" aria-hidden="true">{$bookmarkCount}</span>
          {/if}
        </button>
        {#if isAdminUser}
          <a href="{base}/admin" class="mobile-menu-item" on:click={closeMobileMenu} class:active={$page.url.pathname === `${base}/admin`} role="menuitem" aria-current={$page.url.pathname === `${base}/admin` ? 'page' : undefined}>
            <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Admin
          </a>
        {/if}
        <div class="mobile-menu-divider" role="separator"></div>
        <button on:click={() => { authStore.logout(); closeMobileMenu(); }} class="mobile-menu-item logout-item" role="menuitem" aria-label="Logout from application">
          <svg class="menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Logout
        </button>
      {:else}
        <a href="{base}/signup" class="mobile-menu-item" on:click={closeMobileMenu} role="menuitem">Sign Up</a>
      {/if}
    </div>
  </div>
{/if}

<style>
  .navbar {
    background: #5568d3;
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 40;
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
    min-height: 44px;
    display: flex;
    align-items: center;
  }

  .nav-links a:hover,
  .nav-links a.active {
    background: rgba(255, 255, 255, 0.2);
  }

  .nav-links a:focus-visible,
  .nav-links button:focus-visible {
    outline: 3px solid #fbbf24;
    outline-offset: 2px;
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
    min-height: 44px;
    min-width: 44px;
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
    min-height: 44px;
    min-width: 44px;
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
    min-height: 44px;
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

  /* Hamburger Button */
  .hamburger-btn {
    display: none;
    background: none;
    border: none;
    color: white;
    cursor: pointer;
    padding: 0.5rem;
    min-height: 44px;
    min-width: 44px;
    align-items: center;
    justify-content: center;
  }

  .hamburger-icon {
    width: 28px;
    height: 28px;
  }

  /* Mobile Menu Backdrop */
  .mobile-menu-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 45;
    animation: fadeIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  /* Mobile Menu Drawer */
  .mobile-menu-drawer {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 280px;
    max-width: 85vw;
    background: #5568d3;
    z-index: 50;
    transform: translateX(-100%);
    transition: transform 0.3s ease-out;
    overflow-y: auto;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.2);
    padding-top: env(safe-area-inset-top);
    padding-bottom: env(safe-area-inset-bottom);
  }

  .mobile-menu-drawer.open {
    transform: translateX(0);
  }

  .mobile-menu-content {
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .mobile-menu-item {
    color: white;
    text-decoration: none;
    padding: 1rem;
    border-radius: 8px;
    transition: background 0.2s;
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    width: 100%;
    min-height: 48px;
    position: relative;
  }

  .mobile-menu-item:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .mobile-menu-item.active {
    background: rgba(255, 255, 255, 0.2);
    font-weight: 600;
  }

  .mobile-menu-item.logout-item {
    color: #ffcccc;
  }

  .mobile-menu-item:focus-visible,
  .hamburger-btn:focus-visible {
    outline: 3px solid #fbbf24;
    outline-offset: 2px;
  }

  .menu-icon {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
  }

  .mobile-badge {
    background: #ff4444;
    color: white;
    border-radius: 10px;
    padding: 2px 8px;
    font-size: 0.75rem;
    font-weight: bold;
    margin-left: auto;
  }

  .mobile-menu-divider {
    height: 1px;
    background: rgba(255, 255, 255, 0.2);
    margin: 0.5rem 0;
  }

  @media (max-width: 768px) {
    .hamburger-btn {
      display: flex;
    }

    .desktop-nav {
      display: none;
    }

    .nav-container {
      padding: 1rem;
    }

    .logo {
      font-size: 1.25rem;
    }
  }

  @media (min-width: 769px) {
    .mobile-menu-backdrop,
    .mobile-menu-drawer {
      display: none !important;
    }
  }

  @media (max-width: 640px) {
    .search-shortcut {
      display: none;
    }
  }
</style>

{#if showBookmarksModal}
  <BookmarksModal on:close={() => showBookmarksModal = false} on:navigate={handleNavigate} />
{/if}

<GlobalSearch isOpen={isSearchOpen} onClose={closeSearch} />
