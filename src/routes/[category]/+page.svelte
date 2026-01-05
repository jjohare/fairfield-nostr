<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { userStore } from '$lib/stores/user';
  import { getCategory, getBreadcrumbs } from '$lib/config';
  import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
  import SectionListCard from '$lib/components/navigation/SectionListCard.svelte';
  import type { SectionConfig } from '$lib/config/types';

  let loading = true;
  let error: string | null = null;

  $: categoryId = $page.params.category;
  $: category = getCategory(categoryId);
  $: breadcrumbs = category ? getBreadcrumbs(categoryId) : [];
  $: sections = category?.sections ?? [];
  $: userCohorts = $userStore.profile?.cohorts || [];

  function getSectionAccessStatus(section: SectionConfig): 'approved' | 'pending' | 'none' {
    if (!section.access?.requiresApproval) return 'approved';
    const requiredCohorts = section.access.requiredCohorts || [];
    if (requiredCohorts.length === 0) return 'approved';
    // Cast to string[] for comparison since config uses string cohort IDs
    const userCohortStrings = userCohorts as string[];
    if (requiredCohorts.some((c: string) => userCohortStrings.includes(c))) return 'approved';
    return 'none';
  }

  onMount(async () => {
    await authStore.waitForReady();

    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    if (!category) {
      error = `Category "${categoryId}" not found`;
    }

    loading = false;
  });
</script>

<svelte:head>
  <title>{category?.name ?? 'Category'} - Nostr BBS</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
      <a href="{base}/chat" class="btn btn-sm btn-ghost">Go to Channels</a>
    </div>
  {:else if category}
    <Breadcrumb items={breadcrumbs} />

    <div class="mt-6">
      <div class="flex items-center gap-4 mb-6">
        <div class="text-5xl">{category.icon}</div>
        <div>
          <h1 class="text-3xl font-bold">{category.name}</h1>
          <p class="text-base-content/70 mt-1">{category.description}</p>
        </div>
      </div>

      <div class="divider"></div>

      {#if sections.length === 0}
        <div class="card bg-base-200">
          <div class="card-body text-center">
            <p class="text-base-content/70">No sections in this category yet.</p>
          </div>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each sections as section (section.id)}
            <SectionListCard
              {section}
              {categoryId}
              accessStatus={getSectionAccessStatus(section)}
            />
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
