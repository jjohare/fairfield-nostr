<script lang="ts">
  import { base } from '$app/paths';
  import type { BreadcrumbItem } from '$lib/config/types';

  export let items: BreadcrumbItem[] = [];
</script>

<nav aria-label="Breadcrumb" class="breadcrumbs text-sm">
  <ul class="flex items-center gap-1 text-base-content/70">
    <li>
      <a href="{base}/chat" class="hover:text-primary transition-colors">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </a>
    </li>

    {#each items as item, i (item.path)}
      <li class="flex items-center">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mx-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        {#if i === items.length - 1}
          <span class="text-base-content font-medium">{item.label}</span>
        {:else}
          <a
            href="{base}{item.path}"
            class="hover:text-primary transition-colors flex items-center gap-1"
          >
            {#if item.icon}
              <span>{item.icon}</span>
            {/if}
            {item.label}
          </a>
        {/if}
      </li>
    {/each}
  </ul>
</nav>
