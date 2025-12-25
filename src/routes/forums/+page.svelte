<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { authStore } from '$lib/stores/auth';
  import { getCategories, getAppConfig } from '$lib/config';
  import CategoryCard from '$lib/components/navigation/CategoryCard.svelte';
  import BoardStats from '$lib/components/forum/BoardStats.svelte';
  import TopPosters from '$lib/components/forum/TopPosters.svelte';
  import WelcomeBack from '$lib/components/forum/WelcomeBack.svelte';
  import TodaysActivity from '$lib/components/forum/TodaysActivity.svelte';
  import ModeratorTeam from '$lib/components/forum/ModeratorTeam.svelte';

  let loading = true;

  $: categories = getCategories();
  $: appConfig = getAppConfig();

  onMount(async () => {
    await authStore.waitForReady();

    if (!$authStore.isAuthenticated || !$authStore.publicKey) {
      goto(`${base}/`);
      return;
    }

    if ($authStore.isPending) {
      goto(`${base}/pending`);
      return;
    }

    loading = false;
  });
</script>

<svelte:head>
  <title>Forums - {appConfig.name}</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  <!-- Welcome Back Banner -->
  <div class="mb-4">
    <WelcomeBack />
  </div>

  <div class="flex flex-col lg:flex-row gap-6">
    <!-- Main Content -->
    <div class="flex-1">
      <div class="mb-6">
        <h1 class="text-4xl font-bold gradient-text mb-2">Forums</h1>
        <p class="text-base-content/70">Browse discussion categories</p>
      </div>

      {#if loading}
        <div class="flex justify-center items-center min-h-[200px]">
          <span class="loading loading-spinner loading-lg text-primary"></span>
        </div>
      {:else if categories.length === 0}
        <div class="card bg-base-200">
          <div class="card-body text-center">
            <div class="text-5xl mb-4">📁</div>
            <h2 class="text-xl font-semibold">No categories available</h2>
            <p class="text-base-content/70">Check back later for new discussion areas.</p>
          </div>
        </div>
      {:else}
        <div class="space-y-4">
          {#each categories as category (category.id)}
            <CategoryCard {category} />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Sidebar -->
    <div class="lg:w-80 space-y-4">
      <BoardStats />
      <TodaysActivity />
      <TopPosters />
      <ModeratorTeam />
    </div>
  </div>
</div>
