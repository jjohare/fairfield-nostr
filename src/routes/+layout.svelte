<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { authStore, isAuthenticated, isAdmin } from '$lib/stores/auth';
	import { initializePWA } from '$lib/utils/pwa-init';
	import { encodePubkey, encodePrivkey } from '$lib/nostr/keys';
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
	let showProfileModal = false;
	let showNsec = false;
	let copiedNpub = false;
	let copiedNsec = false;
	let editNickname = '';
	let editAvatar = '';
	let profileSaved = false;

	$: npub = $authStore.publicKey ? encodePubkey($authStore.publicKey) : '';
	$: nsec = $authStore.privateKey ? encodePrivkey($authStore.privateKey) : '';
	$: if (showProfileModal) {
		editNickname = $authStore.nickname || '';
		editAvatar = $authStore.avatar || '';
	}

	function toggleProfileModal() {
		showProfileModal = !showProfileModal;
		if (!showProfileModal) {
			showNsec = false;
			profileSaved = false;
		}
	}

	function saveProfile() {
		authStore.setProfile(editNickname || null, editAvatar || null);
		profileSaved = true;
		setTimeout(() => profileSaved = false, 2000);
	}

	async function copyToClipboard(text: string, type: 'npub' | 'nsec') {
		await navigator.clipboard.writeText(text);
		if (type === 'npub') {
			copiedNpub = true;
			setTimeout(() => copiedNpub = false, 2000);
		} else {
			copiedNsec = true;
			setTimeout(() => copiedNsec = false, 2000);
		}
	}

	function formatKey(key: string): string {
		if (key.length <= 20) return key;
		return key.slice(0, 12) + '...' + key.slice(-8);
	}

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

<!-- Profile Modal -->
{#if showProfileModal}
	<div class="modal modal-open">
		<div class="modal-box max-w-md">
			<button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" on:click={toggleProfileModal}>X</button>
			<h3 class="font-bold text-lg mb-4">Your Profile</h3>

			<!-- Avatar Preview & Edit -->
			<div class="flex items-center gap-4 mb-4">
				<div class="avatar">
					<div class="w-16 h-16 rounded-full bg-base-300 flex items-center justify-center overflow-hidden">
						{#if editAvatar}
							<img src={editAvatar} alt="Avatar" class="w-full h-full object-cover" />
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-8 h-8 text-base-content/50"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
						{/if}
					</div>
				</div>
				<div class="flex-1">
					<div class="text-sm font-medium mb-1">{editNickname || 'Anonymous'}</div>
					<div class="text-xs text-base-content/60 font-mono">{formatKey(npub)}</div>
				</div>
			</div>

			<!-- Nickname -->
			<div class="form-control mb-3">
				<label class="label py-1">
					<span class="label-text font-semibold">Nickname</span>
				</label>
				<input
					type="text"
					bind:value={editNickname}
					placeholder="Enter a display name"
					class="input input-bordered input-sm"
					maxlength="50"
				/>
			</div>

			<!-- Avatar URL -->
			<div class="form-control mb-4">
				<label class="label py-1">
					<span class="label-text font-semibold">Avatar URL</span>
				</label>
				<input
					type="url"
					bind:value={editAvatar}
					placeholder="https://example.com/avatar.jpg"
					class="input input-bordered input-sm"
				/>
				<label class="label py-1">
					<span class="label-text-alt text-base-content/60">Direct link to an image</span>
				</label>
			</div>

			<!-- Save Profile Button -->
			<button class="btn btn-primary btn-sm w-full mb-4" on:click={saveProfile}>
				{#if profileSaved}
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-4 h-4 text-success"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
					Saved!
				{:else}
					Save Profile
				{/if}
			</button>

			<div class="divider my-2"></div>

			<!-- npub (always visible) -->
			<div class="form-control mb-4">
				<label class="label">
					<span class="label-text font-semibold">Public Key (npub)</span>
				</label>
				<div class="flex gap-2">
					<input type="text" readonly value={formatKey(npub)} class="input input-bordered flex-1 font-mono text-sm" />
					<button
						class="btn btn-square btn-outline"
						on:click={() => copyToClipboard(npub, 'npub')}
						title="Copy full npub"
					>
						{#if copiedNpub}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5 text-success"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
						{:else}
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
						{/if}
					</button>
				</div>
				<label class="label">
					<span class="label-text-alt text-base-content/60">Share this to let others find you</span>
				</label>
			</div>

			<!-- nsec (hidden by default) -->
			<div class="form-control">
				<label class="label">
					<span class="label-text font-semibold">Private Key (nsec)</span>
					<button class="btn btn-xs btn-ghost" on:click={() => showNsec = !showNsec}>
						{showNsec ? 'Hide' : 'Reveal'}
					</button>
				</label>
				{#if showNsec}
					<div class="alert alert-warning mb-2">
						<svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-5 w-5" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
						<span class="text-sm">Never share your private key! Anyone with it controls your identity.</span>
					</div>
					<div class="flex gap-2">
						<input type="text" readonly value={formatKey(nsec)} class="input input-bordered flex-1 font-mono text-sm" />
						<button
							class="btn btn-square btn-outline btn-warning"
							on:click={() => copyToClipboard(nsec, 'nsec')}
							title="Copy full nsec"
						>
							{#if copiedNsec}
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5 text-success"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
							{:else}
								<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
							{/if}
						</button>
					</div>
				{:else}
					<div class="input input-bordered flex items-center text-base-content/40">
						Click "Reveal" to show your private key
					</div>
				{/if}
			</div>
		</div>
		<div class="modal-backdrop" on:click={toggleProfileModal} on:keydown={(e) => e.key === 'Escape' && toggleProfileModal()} role="button" tabindex="0"></div>
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
					<button class="btn btn-ghost btn-circle" on:click={toggleProfileModal} title="Profile">
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5"><path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
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
