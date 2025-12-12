<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { isAuthenticated } from '$lib/stores/auth';

	onMount(() => {
		if ($isAuthenticated) {
			goto(`${base}/chat`);
		}
	});
</script>

<svelte:head>
	<title>Minimoomaa Noir - Decentralized Community Chat</title>
</svelte:head>

<div class="flex flex-col items-center justify-center min-h-screen p-4">
	<div class="max-w-2xl w-full space-y-8 text-center">
		<div class="space-y-4">
			<h1 class="text-6xl font-bold gradient-text">
				Minimoomaa Noir
			</h1>
			<p class="text-xl text-base-content/70">
				Decentralized Chat with AI Integration
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
					<a href="{base}/setup" class="btn btn-outline btn-lg">
						Login
					</a>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-4xl mb-2">🔐</div>
					<h3 class="card-title text-lg">Decentralized</h3>
					<p class="text-sm text-base-content/70">
						Your keys, your data. No central authority.
					</p>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-4xl mb-2">🔒</div>
					<h3 class="card-title text-lg">Private</h3>
					<p class="text-sm text-base-content/70">
						End-to-end encrypted communications.
					</p>
				</div>
			</div>

			<div class="card bg-base-200">
				<div class="card-body items-center text-center">
					<div class="text-4xl mb-2">⚡</div>
					<h3 class="card-title text-lg">Fast & Open</h3>
					<p class="text-sm text-base-content/70">
						Built on open protocols and standards.
					</p>
				</div>
			</div>
		</div>
	</div>
</div>
