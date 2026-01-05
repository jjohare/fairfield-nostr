<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { userStore } from '$lib/stores/user';
  import { getSectionWithCategory, getBreadcrumbs } from '$lib/config';
  import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';

  let loading = true;
  let error: string | null = null;

  $: categoryId = $page.params.category;
  $: sectionId = $page.params.section;
  $: forumId = $page.params.forumId;
  $: sectionInfo = getSectionWithCategory(sectionId);
  $: section = sectionInfo?.section;
  $: category = sectionInfo?.category;
  $: userCohorts = $userStore.profile?.cohorts || [];

  $: hasAccess = (() => {
    if (!section?.access?.requiresApproval) return true;
    const required = section.access.requiredCohorts || [];
    if (required.length === 0) return true;
    // Cast to string[] for comparison since config uses string cohort IDs
    const userCohortStrings = userCohorts as string[];
    return required.some((c: string) => userCohortStrings.includes(c));
  })();

  onMount(async () => {
    await authStore.waitForReady();

    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    if (!section || !category) {
      error = `Section "${sectionId}" not found`;
      loading = false;
      return;
    }

    if (!hasAccess) {
      error = 'You do not have access to this section';
      loading = false;
      return;
    }

    // Redirect to the existing chat infrastructure with the forumId
    goto(`${base}/chat/${forumId}`);
  });
</script>

<svelte:head>
  <title>Forum - Nostr BBS</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if error}
    <Breadcrumb items={getBreadcrumbs(categoryId, sectionId)} />
    <div class="alert alert-error mt-4">
      <span>{error}</span>
      <a href="{base}/{categoryId}/{sectionId}" class="btn btn-sm btn-ghost">Back to Section</a>
    </div>
  {/if}
</div>
