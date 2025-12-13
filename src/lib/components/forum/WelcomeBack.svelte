<script lang="ts">
  import { onMount } from 'svelte';
  import { authStore } from '$lib/stores/auth';
  import { browser } from '$app/environment';

  let lastVisit: Date | null = null;
  let displayName = '';

  const LAST_VISIT_KEY = 'minimoomaa_last_visit';

  onMount(() => {
    if (!browser) return;

    // Get last visit time
    const stored = localStorage.getItem(LAST_VISIT_KEY);
    if (stored) {
      lastVisit = new Date(parseInt(stored));
    }

    // Update last visit time
    localStorage.setItem(LAST_VISIT_KEY, Date.now().toString());

    // Get display name from profile if available
    const profileKey = `nostr_profile_${$authStore.publicKey}`;
    const profile = localStorage.getItem(profileKey);
    if (profile) {
      try {
        const parsed = JSON.parse(profile);
        displayName = parsed.name || parsed.display_name || '';
      } catch {
        // Ignore parse errors
      }
    }
  });

  function formatLastVisit(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
  }

  $: shortPubkey = $authStore.publicKey?.substring(0, 8) + '...' || '';
</script>

{#if $authStore.isAuthenticated}
  <div class="card bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
    <div class="card-body p-4">
      <div class="flex items-center gap-3">
        <div class="avatar placeholder">
          <div class="w-10 rounded-full bg-primary text-primary-content">
            <span class="text-lg">
              {(displayName || shortPubkey).charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        <div>
          <p class="font-medium">
            Welcome back, <span class="text-primary">{displayName || shortPubkey}</span>!
          </p>
          {#if lastVisit}
            <p class="text-sm text-base-content/60">
              Last visit: {formatLastVisit(lastVisit)}
            </p>
          {:else}
            <p class="text-sm text-base-content/60">
              First time here? Welcome to the community!
            </p>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}
