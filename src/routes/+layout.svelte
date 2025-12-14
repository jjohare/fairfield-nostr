<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { authStore, isAuthenticated } from '$lib/stores/auth';
	import { initializePWA } from '$lib/utils/pwa-init';
	import {
		canInstall,
		triggerInstall,
		updateAvailable,
		updateServiceWorker,
		isOnline,
		queuedMessageCount
	} from '$lib/stores/pwa';
	import { initializeNotificationListeners } from '$lib/utils/notificationIntegration';
	import { notificationStore } from '$lib/stores/notifications';
	import { initSearch } from '$lib/init/searchInit';
	import Toast from '$lib/components/ui/Toast.svelte';
	import Navigation from '$lib/components/ui/Navigation.svelte';
	import MyProfileModal from '$lib/components/user/MyProfileModal.svelte';

	let mounted = false;
	let themePreference: 'dark' | 'light' = 'dark';
	let showInstallBanner = false;
	let showUpdateBanner = false;
	let showProfileModal = false;

	$: showNav = $page.url.pathname !== `${base}/` && $page.url.pathname !== base && $page.url.pathname !== `${base}/signup` && $page.url.pathname !== `${base}/login` && $page.url.pathname !== `${base}/pending`;

	canInstall.subscribe(value => {
		showInstallBanner = value;
	});

	updateAvailable.subscribe(value => {
		showUpdateBanner = value;
	});

	onMount(() => {
		mounted = true;

		if (browser) {
			const savedTheme = localStorage.getItem('theme') || 'dark';
			themePreference = savedTheme;
			document.documentElement.setAttribute('data-theme', savedTheme);

			// Initialize PWA
			initializePWA();

			// Initialize notification system
			initializeNotificationListeners();

			// Request notification permission if not already granted
			if ('Notification' in window && Notification.permission === 'default') {
				notificationStore.requestPermission();
			}

			// Initialize search index (async, don't block app startup)
			initSearch();
		}
	});

	function toggleTheme() {
		if (!browser) return;

		themePreference = themePreference === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', themePreference);
		localStorage.setItem('theme', themePreference);
	}

	function toggleProfileModal() {
		showProfileModal = !showProfileModal;
	}

	function dismissInstallBanner() {
		showInstallBanner = false;
	}

	async function handleInstall() {
		const installed = await triggerInstall();
		if (installed) {
			showInstallBanner = false;
		}
	}

	async function handleUpdate() {
		await updateServiceWorker();
	}
</script>

<svelte:head>
	<title>Minimoomaa Noir</title>
</svelte:head>

<!-- PWA Install Banner -->
{#if showInstallBanner}
	<div class="alert alert-info fixed top-0 left-0 right-0 z-50 rounded-none">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<span>Install Minimoomaa Noir for offline access</span>
		<div class="flex gap-2">
			<button class="btn btn-sm btn-primary" on:click={handleInstall}>Install</button>
			<button class="btn btn-sm btn-ghost" on:click={dismissInstallBanner}>Dismiss</button>
		</div>
	</div>
{/if}

<!-- PWA Update Banner -->
{#if showUpdateBanner}
	<div class="alert alert-warning fixed top-0 left-0 right-0 z-50 rounded-none">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
		</svg>
		<span>A new version is available</span>
		<button class="btn btn-sm btn-warning" on:click={handleUpdate}>Update Now</button>
	</div>
{/if}

<!-- Offline Indicator -->
{#if !$isOnline}
	<div class="alert alert-error fixed bottom-0 left-0 right-0 z-50 rounded-none">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"></path>
		</svg>
		<span>
			You're offline. Messages will be queued.
			{#if $queuedMessageCount > 0}
				({$queuedMessageCount} queued)
			{/if}
		</span>
	</div>
{/if}

<!-- Profile Modal -->
<MyProfileModal bind:open={showProfileModal} />

<div class="min-h-screen w-full transition-base">
	{#if mounted}
		{#if showNav && $isAuthenticated}
			<Navigation
				{themePreference}
				onThemeToggle={toggleTheme}
				onProfileClick={toggleProfileModal}
			/>
		{/if}
		<main role="main">
			<slot />
		</main>
	{:else}
		<div class="flex items-center justify-center min-h-screen">
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>
	{/if}
</div>

<Toast />

<style>
	:global(body) {
		overscroll-behavior: none;
	}
</style>
