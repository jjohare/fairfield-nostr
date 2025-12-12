<script lang="ts">
  import { authStore, isAuthenticated, isAdmin } from '$lib/stores/auth';
  import { page } from '$app/stores';
  import { base } from '$app/paths';

  $: isAuth = $isAuthenticated;
  $: isAdminUser = $isAdmin;
</script>

<nav class="navbar">
  <div class="nav-container">
    <a href="{base}/" class="logo">
      Minimoomaa Noir
    </a>

    <div class="nav-links">
      {#if isAuth}
        <a href="{base}/chat" class:active={$page.url.pathname.startsWith(`${base}/chat`)}>
          Channels
        </a>
        <a href="{base}/dm" class:active={$page.url.pathname.startsWith(`${base}/dm`)}>
          Messages
        </a>
        {#if isAdminUser}
          <a href="{base}/admin" class:active={$page.url.pathname === `${base}/admin`}>
            Admin
          </a>
        {/if}
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

  @media (max-width: 640px) {
    .nav-container {
      flex-direction: column;
      gap: 1rem;
    }

    .nav-links {
      flex-wrap: wrap;
      justify-content: center;
    }
  }
</style>
