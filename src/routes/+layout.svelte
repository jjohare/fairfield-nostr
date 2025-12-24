<script lang="ts">
	import '../app.css';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { fade } from 'svelte/transition';
	import { authStore, isAuthenticated } from '$lib/stores/auth';
	import { sessionStore } from '$lib/stores/session';
	import { calendarStore, sidebarVisible, sidebarExpanded } from '$lib/stores/calendar';
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
	import ConfirmDialog from '$lib/components/ui/ConfirmDialog.svelte';
	import SessionTimeoutWarning from '$lib/components/ui/SessionTimeoutWarning.svelte';
	import Navigation from '$lib/components/ui/Navigation.svelte';
	import MyProfileModal from '$lib/components/user/MyProfileModal.svelte';
	import ScreenReaderAnnouncer from '$lib/components/ui/ScreenReaderAnnouncer.svelte';
	import CalendarSidebar from '$lib/components/calendar/CalendarSidebar.svelte';
	import CalendarSheet from '$lib/components/calendar/CalendarSheet.svelte';

	let mounted = false;
	let themePreference: 'dark' | 'light' = 'dark';
	let showInstallBanner = false;
	let showUpdateBanner = false;
	let showProfileModal = false;
	let sessionCleanup: (() => void) | undefined = undefined;
	let isMobile = false;
	let calendarSheetOpen = false;

	$: showNav = $page.url.pathname !== `${base}/` && $page.url.pathname !== base && $page.url.pathname !== `${base}/signup` && $page.url.pathname !== `${base}/login` && $page.url.pathname !== `${base}/pending`;

	// Start session monitoring when authenticated
	$: if (browser && $isAuthenticated && !sessionCleanup) {
		sessionCleanup = sessionStore.start(() => {
			// Session timed out - logout
			authStore.logout();
		});
	} else if (browser && !$isAuthenticated && sessionCleanup) {
		sessionCleanup();
		sessionCleanup = undefined;
		sessionStore.stop();
	}

	canInstall.subscribe(value => {
		showInstallBanner = value;
	});

	updateAvailable.subscribe(value => {
		showUpdateBanner = value;
	});

	onMount(() => {
		mounted = true;

		if (!browser) {
			return;
		}

		const savedTheme = localStorage.getItem('theme');
		themePreference = savedTheme === 'light' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', themePreference);

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

		// Check for mobile viewport
		const checkMobile = () => {
			isMobile = window.innerWidth < 768;
		};
		checkMobile();
		window.addEventListener('resize', checkMobile);

		// Initialize calendar store (fetch upcoming events)
		calendarStore.fetchUpcomingEvents(14);

		return () => {
			window.removeEventListener('resize', checkMobile);
		};
	});

	onDestroy(() => {
		if (sessionCleanup) {
			sessionCleanup();
			sessionCleanup = undefined;
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
	<title>Fairfield - DreamLab - Cumbria</title>
</svelte:head>

<!-- Skip to main content link for accessibility -->
<a href="#main-content" class="skip-to-main">Skip to main content</a>

<!-- PWA Install Banner -->
{#if showInstallBanner}
	<div class="alert alert-info fixed top-0 left-0 right-0 z-50 rounded-none" role="banner" aria-live="polite">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
		</svg>
		<span>Install Fairfield app for offline access</span>
		<div class="flex gap-2">
			<button class="btn btn-sm btn-primary" on:click={handleInstall} aria-label="Install application">Install</button>
			<button class="btn btn-sm btn-ghost" on:click={dismissInstallBanner} aria-label="Dismiss install banner">Dismiss</button>
		</div>
	</div>
{/if}

<!-- PWA Update Banner -->
{#if showUpdateBanner}
	<div class="alert alert-warning fixed top-0 left-0 right-0 z-50 rounded-none" role="banner" aria-live="polite">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6" aria-hidden="true">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
		</svg>
		<span>A new version is available</span>
		<button class="btn btn-sm btn-warning" on:click={handleUpdate} aria-label="Update application now">Update Now</button>
	</div>
{/if}

<!-- Offline Indicator -->
{#if !$isOnline}
	<div class="alert alert-error fixed bottom-0 left-0 right-0 z-50 rounded-none" role="status" aria-live="assertive">
		<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6" aria-hidden="true">
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

		<div class="flex">
			<!-- Calendar Sidebar (Desktop) -->
			{#if showNav && $isAuthenticated && !isMobile && $sidebarVisible}
				<aside class="flex-shrink-0 hidden md:block" aria-label="Calendar sidebar">
					<CalendarSidebar
						bind:isExpanded={$sidebarExpanded}
						isVisible={$sidebarVisible}
					/>
				</aside>
			{/if}

			<!-- Main Content -->
			{#key $page.url.pathname}
				<main
					id="main-content"
					role="main"
					tabindex="-1"
					class="flex-1 min-w-0"
					in:fade={{ duration: 150, delay: 75 }}
					out:fade={{ duration: 75 }}
				>
					<slot />
				</main>
			{/key}
		</div>

		<!-- Calendar Sheet (Mobile) -->
		{#if showNav && $isAuthenticated && isMobile}
			<CalendarSheet bind:isOpen={calendarSheetOpen} />
		{/if}
	{:else}
		<div class="flex items-center justify-center min-h-screen" role="status" aria-live="polite" aria-label="Loading application">
			<div class="loading loading-spinner loading-lg text-primary"></div>
			<span class="sr-only">Loading application...</span>
		</div>
	{/if}
</div>

<Toast />
<ConfirmDialog />
<SessionTimeoutWarning />

<style>
	:global(body) {
		overscroll-behavior: none;
	}

	/* Skip to main content link */
	.skip-to-main {
		position: absolute;
		top: -40px;
		left: 0;
		background: #667eea;
		color: white;
		padding: 8px 16px;
		text-decoration: none;
		z-index: 100;
		border-radius: 0 0 4px 0;
		font-weight: 500;
	}

	.skip-to-main:focus {
		top: 0;
		outline: 3px solid #fbbf24;
		outline-offset: 2px;
	}

	/* Screen reader only content */
	:global(.sr-only) {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}

	/* Focus visible styles */
	:global(*:focus-visible) {
		outline: 2px solid #667eea;
		outline-offset: 2px;
		border-radius: 2px;
	}
</style>
