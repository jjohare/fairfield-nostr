<script lang="ts">
  import { base } from '$app/paths';
  import type { SectionConfig } from '$lib/config/types';

  export let section: SectionConfig;
  export let categoryId: string;
  export let channelCount: number = 0;
  export let memberCount: number = 0;
  export let accessStatus: 'approved' | 'pending' | 'none' = 'none';

  $: isApproved = accessStatus === 'approved';
  $: isPending = accessStatus === 'pending';
  $: needsApproval = section.access?.requiresApproval && !isApproved && !isPending;
  $: hasCalendarAccess = !section.access?.requiresApproval || (isApproved && section.calendar?.access !== 'none');

  function handleRequestAccess(e: Event) {
    e.preventDefault();
    e.stopPropagation();
    const event = new CustomEvent('request-access', {
      detail: { sectionId: section.id, categoryId },
      bubbles: true
    });
    window.dispatchEvent(event);
  }
</script>

<div class="card bg-base-100 shadow-md hover:shadow-lg transition-shadow">
  <div class="card-body p-4">
    <div class="flex items-start gap-3">
      <div class="text-3xl">{section.icon}</div>
      <div class="flex-1">
        <div class="flex items-center gap-2">
          <h3 class="font-bold text-lg">{section.name}</h3>
          {#if isPending}
            <span class="badge badge-warning badge-sm">Pending</span>
          {:else if isApproved}
            <span class="badge badge-success badge-sm">Member</span>
          {/if}
        </div>
        <p class="text-sm text-base-content/70 mt-1">{section.description}</p>
      </div>
    </div>

    {#if section.showStats}
      <div class="flex gap-4 mt-3 text-sm text-base-content/60">
        <span>{channelCount} forums</span>
        <span>{memberCount} members</span>
      </div>
    {/if}

    <div class="card-actions justify-end mt-3 gap-2">
      {#if hasCalendarAccess}
        <a
          href="{base}/{categoryId}/{section.id}/calendar"
          class="btn btn-sm btn-outline btn-secondary"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Calendar
        </a>
      {/if}

      {#if needsApproval}
        <button class="btn btn-sm btn-primary" on:click={handleRequestAccess}>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Request Access
        </button>
      {:else}
        <a href="{base}/{categoryId}/{section.id}" class="btn btn-sm btn-primary">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Enter Section
        </a>
      {/if}
    </div>
  </div>
</div>
