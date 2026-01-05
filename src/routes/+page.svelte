<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { isAuthenticated, authStore } from '$lib/stores/auth';
	import { restoreFromMnemonic, restoreFromNsecOrHex } from '$lib/nostr/keys';
	import { getAppConfig } from '$lib/config/loader';

	const appConfig = getAppConfig();
	const appNameParts = appConfig.name.split(' - ');
	const primaryName = appNameParts[0];
	const subtitle = appNameParts.slice(1).join(' - ') || 'Nostr Community';

	// Dev mode credentials - MUST be set via environment variables, no hardcoded fallbacks
	const ADMIN_NSEC = import.meta.env.VITE_DEV_ADMIN_NSEC || '';
	const ADMIN_SEED = import.meta.env.VITE_DEV_ADMIN_SEED || '';
	const hasDevCredentials = Boolean(ADMIN_NSEC || ADMIN_SEED);

	let devLoading = false;
	let devError = '';
	let showDevMode = false;

	onMount(() => {
		// Dev mode only enabled when: (1) in Vite dev server OR ?dev param, AND (2) credentials are configured
		const urlParams = new URLSearchParams(window.location.search);
		const devModeRequested = import.meta.env.DEV || urlParams.has('dev');
		showDevMode = devModeRequested && hasDevCredentials;

		if ($isAuthenticated) {
			goto(`${base}/forums`);
		}
	});

	async function devLoginAsAdmin() {
		if (!showDevMode) return;
		devLoading = true;
		devError = '';

		try {
			// Try nsec first (faster), fall back to mnemonic
			let publicKey: string;
			let privateKey: string;

			try {
				const result = restoreFromNsecOrHex(ADMIN_NSEC);
				publicKey = result.publicKey;
				privateKey = result.privateKey;
			} catch {
				// Fall back to mnemonic
				const result = await restoreFromMnemonic(ADMIN_SEED);
				publicKey = result.publicKey;
				privateKey = result.privateKey;
			}

			await authStore.setKeys(publicKey, privateKey);
			goto(`${base}/chat`);
		} catch (error) {
			devError = error instanceof Error ? error.message : 'Dev login failed';
			console.error('Dev login error:', error);
		} finally {
			devLoading = false;
		}
	}

	async function devLoginAsTestUser() {
		if (!showDevMode) return;
		devLoading = true;
		devError = '';

		try {
			// Generate a deterministic test user from a fixed seed
			const testSeed = 'test user seed phrase for development only not secure at all okay';
			const result = await restoreFromMnemonic('abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about');
			await authStore.setKeys(result.publicKey, result.privateKey);
			goto(`${base}/chat`);
		} catch (error) {
			devError = error instanceof Error ? error.message : 'Dev login failed';
			console.error('Dev login error:', error);
		} finally {
			devLoading = false;
		}
	}
</script>

<svelte:head>
	<title>{appConfig.name}</title>
</svelte:head>

<div class="flex flex-col items-center justify-center min-h-screen p-4">
	<div class="max-w-2xl w-full space-y-8 text-center">
		<div class="space-y-4">
			<h1 class="text-6xl font-bold gradient-text">
				{primaryName}
			</h1>
			<p class="text-xl text-base-content/70">
				{subtitle}
			</p>
		</div>

		<div class="card bg-base-200 shadow-xl">
			<div class="card-body">
				<h2 class="card-title text-2xl justify-center">Welcome</h2>
				<p class="text-base-content/70">
					Secure, decentralized communication built on Nostr protocol
				</p>
				<div class="card-actions justify-center mt-4 flex-wrap gap-3">
					<a href="{base}/signup" class="btn btn-primary btn-lg">
						Create Account
					</a>
					<a href="{base}/login" class="btn btn-outline btn-lg">
						Login
					</a>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-4xl mb-2">🔐</div>
					<h3 class="card-title text-lg">Self-Sovereign Identity</h3>
					<p class="text-sm text-base-content/70">
						Your keys, your identity. Nostr keypairs with did:nostr DID support.
					</p>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-4xl mb-2">🔒</div>
					<h3 class="card-title text-lg">Encrypted & Ephemeral</h3>
					<p class="text-sm text-base-content/70">
						NIP-04 encrypted DMs with NIP-16 ephemeral event support.
					</p>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-4xl mb-2">⚡</div>
					<h3 class="card-title text-lg">Full NIP Compliance</h3>
					<p class="text-sm text-base-content/70">
						NIP-28 channels, NIP-33 addressable events, NIP-98 HTTP auth.
					</p>
				</div>
			</div>
		</div>

		{#if showDevMode}
			<div class="card bg-warning/10 border border-warning/30 mt-8">
				<div class="card-body">
					<h3 class="card-title text-warning text-lg justify-center">
						🛠️ Development Mode
					</h3>
					<p class="text-sm text-center text-base-content/70 mb-4">
						Quick login for testing (only visible in dev mode)
					</p>
					{#if devError}
						<div class="alert alert-error mb-4">
							<span>{devError}</span>
						</div>
					{/if}
					<div class="flex flex-wrap gap-3 justify-center">
						<button
							class="btn btn-warning"
							on:click={devLoginAsAdmin}
							disabled={devLoading}
						>
							{#if devLoading}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Login as Admin
						</button>
						<button
							class="btn btn-outline btn-warning"
							on:click={devLoginAsTestUser}
							disabled={devLoading}
						>
							{#if devLoading}
								<span class="loading loading-spinner loading-sm"></span>
							{/if}
							Login as Test User
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
