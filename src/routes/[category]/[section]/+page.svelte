<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { authStore } from '$lib/stores/auth';
  import { userStore } from '$lib/stores/user';
  import { ndk, connectRelay, isConnected } from '$lib/nostr/relay';
  import { RELAY_URL } from '$lib/config';
  import { getSectionWithCategory, getBreadcrumbs } from '$lib/config';
  import Breadcrumb from '$lib/components/navigation/Breadcrumb.svelte';
  import ChannelCard from '$lib/components/forum/ChannelCard.svelte';
  import type { NDKFilter, NDKEvent } from '@nostr-dev-kit/ndk';

  interface Forum {
    id: string;
    name: string;
    about: string;
    picture?: string;
    createdAt: number;
    pubkey: string;
  }

  let loading = true;
  let error: string | null = null;
  let forums: Forum[] = [];

  $: categoryId = $page.params.category;
  $: sectionId = $page.params.section;
  $: sectionInfo = getSectionWithCategory(sectionId);
  $: section = sectionInfo?.section;
  $: category = sectionInfo?.category;
  $: breadcrumbs = section && category ? getBreadcrumbs(categoryId, sectionId) : [];
  $: userCohorts = $userStore.profile?.cohorts || [];

  $: hasAccess = (() => {
    if (!section?.access?.requiresApproval) return true;
    const required = section.access.requiredCohorts || [];
    if (required.length === 0) return true;
    // Cast to string[] for comparison since config uses string cohort IDs
    const userCohortStrings = userCohorts as string[];
    return required.some((c: string) => userCohortStrings.includes(c));
  })();

  async function loadForums() {
    const ndkInstance = ndk();
    if (!ndkInstance) return;

    try {
      // Fetch NIP-28 channels (kind 40) tagged with this section
      const filter: NDKFilter = {
        kinds: [40],
        '#section': [sectionId],
        limit: 50
      };

      const events = await ndkInstance.fetchEvents(filter);

      forums = Array.from(events).map((event: NDKEvent) => {
        let metadata = { name: 'Unnamed Forum', about: '', picture: '' };
        try {
          metadata = JSON.parse(event.content);
        } catch {}

        return {
          id: event.id,
          name: metadata.name || 'Unnamed Forum',
          about: metadata.about || '',
          picture: metadata.picture,
          createdAt: event.created_at ?? 0,
          pubkey: event.pubkey
        };
      });

      forums.sort((a, b) => b.createdAt - a.createdAt);
    } catch (e) {
      console.error('Failed to load forums:', e);
      error = e instanceof Error ? e.message : 'Failed to load forums';
    }
  }

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

    // Verify category matches
    if (category.id !== categoryId) {
      error = `Section "${sectionId}" is not in category "${categoryId}"`;
      loading = false;
      return;
    }

    if (!hasAccess) {
      error = 'You do not have access to this section';
      loading = false;
      return;
    }

    try {
      if (!isConnected() && $authStore.privateKey) {
        await connectRelay(RELAY_URL, $authStore.privateKey);
      }
      await loadForums();
    } catch (e) {
      console.error('Failed to connect:', e);
      error = e instanceof Error ? e.message : 'Connection failed';
    } finally {
      loading = false;
    }
  });
</script>

<svelte:head>
  <title>{section?.name ?? 'Section'} - Nostr BBS</title>
</svelte:head>

<div class="container mx-auto p-4 max-w-6xl">
  {#if loading}
    <div class="flex justify-center items-center min-h-[400px]">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>
  {:else if error}
    <div class="alert alert-error">
      <span>{error}</span>
      <a href="{base}/{categoryId}" class="btn btn-sm btn-ghost">Back to Category</a>
    </div>
  {:else if section && category}
    <Breadcrumb items={breadcrumbs} />

    <div class="mt-6">
      <div class="flex items-start justify-between gap-4 mb-6">
        <div class="flex items-center gap-4">
          <div class="text-5xl">{section.icon}</div>
          <div>
            <h1 class="text-3xl font-bold">{section.name}</h1>
            <p class="text-base-content/70 mt-1">{section.description}</p>
          </div>
        </div>

        <div class="flex gap-2">
          {#if section.calendar?.access !== 'none'}
            <a href="{base}/{categoryId}/{sectionId}/calendar" class="btn btn-outline btn-secondary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Calendar
            </a>
          {/if}
          {#if section.allowForumCreation}
            <button class="btn btn-primary">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
              New Forum
            </button>
          {/if}
        </div>
      </div>

      <div class="divider"></div>

      {#if forums.length === 0}
        <div class="card bg-base-200">
          <div class="card-body text-center">
            <p class="text-base-content/70">No forums in this section yet.</p>
            {#if section.allowForumCreation}
              <p class="text-sm text-base-content/50 mt-2">Be the first to create one!</p>
            {/if}
          </div>
        </div>
      {:else}
        <div class="space-y-3">
          {#each forums as forum (forum.id)}
            <a
              href="{base}/{categoryId}/{sectionId}/{forum.id}"
              class="card bg-base-100 shadow hover:shadow-md transition-shadow cursor-pointer block"
            >
              <div class="card-body p-4">
                <div class="flex items-center gap-3">
                  {#if forum.picture}
                    <img src={forum.picture} alt="" class="w-12 h-12 rounded-lg object-cover" />
                  {:else}
                    <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                      </svg>
                    </div>
                  {/if}
                  <div class="flex-1">
                    <h3 class="font-bold">{forum.name}</h3>
                    {#if forum.about}
                      <p class="text-sm text-base-content/70 line-clamp-1">{forum.about}</p>
                    {/if}
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-base-content/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </a>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>
