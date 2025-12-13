<script lang="ts">
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { authStore, isAdmin } from '$lib/stores/auth';

	export let themePreference: 'dark' | 'light' = 'dark';
	export let onThemeToggle: () => void;
	export let onProfileClick: () => void;

	let mobileMenuOpen = false;

	function toggleMobileMenu() {
		mobileMenuOpen = !mobileMenuOpen;
	}

	function closeMobileMenu() {
		mobileMenuOpen = false;
	}

	function handleNavClick() {
		closeMobileMenu();
	}

	function handleProfileClick() {
		onProfileClick();
		closeMobileMenu();
	}

	function handleLogout() {
		authStore.logout();
		closeMobileMenu();
	}
</script>

<!-- Desktop/Mobile Navigation Bar -->
<nav class="navbar bg-base-200 shadow-lg" role="navigation" aria-label="Main navigation">
	<div class="navbar-start">
		<!-- Mobile hamburger menu -->
		<button
			class="btn btn-ghost btn-square min-h-11 min-w-11 md:hidden"
			on:click={toggleMobileMenu}
			aria-label="Toggle menu"
			aria-expanded={mobileMenuOpen}
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-6 h-6">
				<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
			</svg>
		</button>
		<a href="{base}/chat" class="btn btn-ghost text-xl">Minimoomaa Noir</a>
	</div>

	<!-- Desktop Navigation (hidden on mobile) -->
	<div class="navbar-center hidden md:flex">
		<ul class="menu menu-horizontal px-1">
			<li><a href="{base}/chat" class:active={$page.url.pathname.startsWith(`${base}/chat`)} class="min-h-11">Channels</a></li>
			<li><a href="{base}/dm" class:active={$page.url.pathname.startsWith(`${base}/dm`)} class="min-h-11">Messages</a></li>
			{#if $isAdmin}
				<li><a href="{base}/admin" class:active={$page.url.pathname === `${base}/admin`} class="min-h-11">Admin</a></li>
			{/if}
		</ul>
	</div>

	<!-- Actions (desktop and mobile) -->
	<div class="navbar-end gap-2">
		<button
			class="btn btn-ghost btn-circle min-h-11 min-w-11"
			on:click={onThemeToggle}
			aria-label={themePreference === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if themePreference === 'dark'}
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5" aria-hidden="true">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>
				</svg>
			{:else}
				<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5" aria-hidden="true">
					<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>
				</svg>
			{/if}
		</button>
		<button
			class="btn btn-ghost btn-circle min-h-11 min-w-11 hidden md:flex"
			on:click={onProfileClick}
			aria-label="Open profile settings"
		>
			<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5" aria-hidden="true">
				<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
			</svg>
		</button>
		<button class="btn btn-ghost min-h-11 hidden md:inline-flex" on:click={handleLogout}>
			Logout
		</button>
	</div>
</nav>

<!-- Mobile Menu Drawer -->
{#if mobileMenuOpen}
	<div class="fixed inset-0 z-50 md:hidden">
		<!-- Backdrop -->
		<div
			class="absolute inset-0 bg-black bg-opacity-50 animate-fade-in"
			on:click={closeMobileMenu}
			on:keydown={(e) => e.key === 'Escape' && closeMobileMenu()}
			role="button"
			tabindex="0"
			aria-label="Close menu"
		></div>

		<!-- Drawer -->
		<div class="absolute left-0 top-0 bottom-0 w-64 bg-base-200 shadow-xl animate-slide-in">
			<div class="p-4 border-b border-base-300 flex items-center justify-between">
				<h2 class="text-lg font-bold">Menu</h2>
				<button
					class="btn btn-ghost btn-square min-h-11 min-w-11"
					on:click={closeMobileMenu}
					aria-label="Close menu"
				>
					<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-6 h-6">
						<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
					</svg>
				</button>
			</div>

			<ul class="menu p-4 gap-2">
				<li>
					<a
						href="{base}/chat"
						class="min-h-11 text-base {$page.url.pathname.startsWith(`${base}/chat`) ? 'active' : ''}"
						on:click={handleNavClick}
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
							<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
						</svg>
						Channels
					</a>
				</li>
				<li>
					<a
						href="{base}/dm"
						class="min-h-11 text-base {$page.url.pathname.startsWith(`${base}/dm`) ? 'active' : ''}"
						on:click={handleNavClick}
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
							<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
						</svg>
						Messages
					</a>
				</li>
				{#if $isAdmin}
					<li>
						<a
							href="{base}/admin"
							class="min-h-11 text-base {$page.url.pathname === `${base}/admin` ? 'active' : ''}"
							on:click={handleNavClick}
						>
							<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
								<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
								<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
							</svg>
							Admin
						</a>
					</li>
				{/if}

				<div class="divider my-2"></div>

				<li>
					<button
						class="min-h-11 text-base justify-start"
						on:click={handleProfileClick}
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
							<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
						</svg>
						Profile
					</button>
				</li>
				<li>
					<button
						class="min-h-11 text-base text-error justify-start"
						on:click={handleLogout}
					>
						<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="w-5 h-5">
							<path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
						</svg>
						Logout
					</button>
				</li>
			</ul>
		</div>
	</div>
{/if}

<style>
	@keyframes slide-in {
		from {
			transform: translateX(-100%);
		}
		to {
			transform: translateX(0);
		}
	}

	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.animate-slide-in {
		animation: slide-in 0.3s ease-out;
	}

	.animate-fade-in {
		animation: fade-in 0.2s ease-out;
	}
</style>
