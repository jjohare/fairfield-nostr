<script lang="ts">
  import { SECTION_CONFIG } from '$lib/stores';
  import type { ChannelSection, SectionStats, SectionAccessStatus } from '$lib/stores';

  export let section: ChannelSection;
  export let stats: SectionStats | undefined = undefined;
  export let accessStatus: SectionAccessStatus;

  $: config = SECTION_CONFIG[section];
  $: isApproved = accessStatus === 'approved';
  $: isPending = accessStatus === 'pending';
  $: needsApproval = config?.access?.requiresApproval && !isApproved && !isPending;
  $: hasCalendarAccess = section === 'public-lobby' || (isApproved && config?.calendar?.access !== 'none');

  function formatLastActivity(timestamp: number): string {
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

  function handleRequestAccess() {
    // Dispatch event to parent component to handle access request
    const event = new CustomEvent('request-access', {
      detail: { section },
      bubbles: true
    });
    window.dispatchEvent(event);
  }

  function handleEnterSection() {
    // Dispatch event to parent component to navigate to section
    const event = new CustomEvent('enter-section', {
      detail: { section },
      bubbles: true
    });
    window.dispatchEvent(event);
  }

  function handleViewCalendar() {
    // Dispatch event to parent component to navigate to calendar
    const event = new CustomEvent('view-calendar', {
      detail: { section },
      bubbles: true
    });
    window.dispatchEvent(event);
  }
</script>

<div class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow">
  <div class="card-body">
    <!-- Section Header -->
    <div class="flex items-start gap-3 mb-4">
      <div class="text-4xl">{config.icon}</div>
      <div class="flex-1">
        <h2 class="card-title text-xl mb-1">{config.name}</h2>
        <p class="text-sm text-base-content/70">{config.description}</p>
      </div>
      {#if isPending}
        <div class="badge badge-warning badge-sm">Pending</div>
      {:else if isApproved}
        <div class="badge badge-success badge-sm">Approved</div>
      {/if}
    </div>

    <!-- Section Stats -->
    {#if config?.showStats && stats}
      <div class="grid grid-cols-3 gap-4 p-4 bg-base-200 rounded-lg mb-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-primary">{stats.channelCount}</div>
          <div class="text-xs text-base-content/60">Channels</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-secondary">{stats.memberCount}</div>
          <div class="text-xs text-base-content/60">Members</div>
        </div>
        <div class="text-center">
          <div class="text-sm font-semibold text-accent">{formatLastActivity(stats.lastActivity)}</div>
          <div class="text-xs text-base-content/60">Last Activity</div>
        </div>
      </div>
    {/if}

    <!-- Access Info -->
    {#if config?.access?.requiresApproval && !isApproved}
      <div class="alert alert-info shadow-sm mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span class="text-sm">
          {#if isPending}
            Your access request is pending approval
          {:else}
            Request access to join this section
          {/if}
        </span>
      </div>
    {/if}

    <!-- Action Buttons -->
    <div class="card-actions justify-end gap-2">
      {#if hasCalendarAccess}
        <button
          class="btn btn-sm btn-outline btn-secondary"
          on:click={handleViewCalendar}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          View Calendar
        </button>
      {/if}

      {#if needsApproval}
        <button
          class="btn btn-sm btn-primary"
          on:click={handleRequestAccess}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Request Access
        </button>
      {:else if isApproved}
        <button
          class="btn btn-sm btn-success"
          on:click={handleEnterSection}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Enter Section
        </button>
      {:else if !config?.access?.requiresApproval}
        <button
          class="btn btn-sm btn-primary"
          on:click={handleEnterSection}
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Enter Section
        </button>
      {/if}
    </div>
  </div>
</div>
