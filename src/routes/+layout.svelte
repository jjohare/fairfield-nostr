<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { authStore, isAuthenticated, isAdmin } from '$lib/stores/auth';
	import { initializePWA } from '$lib/utils/pwa-init';
	import {
		canInstall,
		triggerInstall,
		updateAvailable,
		updateServiceWorker,
		isOnline,
		queuedMessageCount
	} from '$lib/stores/pwa';

	let mounted = false;
	let themePreference = 'dark';
	let showInstallBanner = false;
	let showUpdateBanner = false;

	$: showNav = $page.url.pathname !== `${base}/` && $page.url.pathname !== base && $page.url.pathname !== `${base}/signup` && $page.url.pathname !== `${base}/setup`;

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
		}
	});

	function toggleTheme() {
		if (!browser) return;

		themePreference = themePreference === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', themePreference);
		localStorage.setItem('theme', themePreference);
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

<div class="min-h-screen w-full transition-base">
	{#if mounted}
		{#if showNav && $isAuthenticated}
			<nav class="navbar bg-base-200 shadow-lg">
				<div class="navbar-start">
					<a href="{base}/chat" class="btn btn-ghost text-xl">Minimoomaa Noir</a>
				</div>
				<div class="navbar-center hidden lg:flex">
					<ul class="menu menu-horizontal px-1">
						<li><a href="{base}/chat" class:active={$page.url.pathname.startsWith(`${base}/chat`)}>Channels</a></li>
						<li><a href="{base}/dm" class:active={$page.url.pathname.startsWith(`${base}/dm`)}>Messages</a></li>
						{#if $isAdmin}
							<li><a href="{base}/admin" class:active={$page.url.pathname === `${base}/admin`}>Admin</a></li>
						{/if}
					</ul>
				</div>
				<div class="navbar-end gap-2">
					<button class="btn btn-ghost btn-circle" on:click={toggleTheme}>
						{#if themePreference === 'dark'}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/></svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>
						{/if}
					</button>
					<button class="btn btn-ghost" on:click={() => authStore.logout()}>
						Logout
					</button>
				</div>
			</nav>
		{/if}
		<slot />
	{:else}
		<div class="flex items-center justify-center min-h-screen">
			<div class="loading loading-spinner loading-lg text-primary"></div>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		overscroll-behavior: none;
	}
</style>
