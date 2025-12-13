<script lang="ts">
	import { preferencesStore } from '$lib/stores/preferences';
	import InfoTooltip from '$lib/components/ui/InfoTooltip.svelte';
	import AdvancedSettings from '$lib/components/ui/AdvancedSettings.svelte';
</script>

<div class="preferences-panel">
	<h2 class="text-xl font-semibold mb-4">Preferences</h2>

	<div class="space-y-4">
		<!-- Link Previews -->
		<div class="preference-item">
			<div class="flex items-center justify-between">
				<div class="flex-1 flex items-center gap-2">
					<div>
						<h3 class="font-medium">Link Previews</h3>
						<p class="text-sm text-base-content/60">Show preview cards for links in messages</p>
					</div>
					<InfoTooltip
						text="When enabled, links in messages will display preview cards with images and descriptions. This may load content from external sources."
						position="top"
					/>
				</div>
				<label class="swap swap-flip">
					<input
						type="checkbox"
						checked={$preferencesStore.linkPreviewsEnabled}
						on:change={preferencesStore.toggleLinkPreviews}
					/>
					<div class="swap-on">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="swap-off">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
				</label>
			</div>
		</div>

		<!-- Media Auto-Play -->
		<div class="preference-item">
			<div class="flex items-center justify-between">
				<div class="flex-1">
					<h3 class="font-medium">Auto-Play Media</h3>
					<p class="text-sm text-base-content/60">Automatically play videos when visible</p>
				</div>
				<label class="swap swap-flip">
					<input
						type="checkbox"
						checked={$preferencesStore.mediaAutoPlay}
						on:change={preferencesStore.toggleMediaAutoPlay}
					/>
					<div class="swap-on">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="swap-off">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
				</label>
			</div>
		</div>

		<!-- Notifications -->
		<div class="preference-item">
			<div class="flex items-center justify-between">
				<div class="flex-1">
					<h3 class="font-medium">Notifications</h3>
					<p class="text-sm text-base-content/60">Show desktop notifications for new messages</p>
				</div>
				<label class="swap swap-flip">
					<input
						type="checkbox"
						checked={$preferencesStore.notificationsEnabled}
						on:change={preferencesStore.toggleNotifications}
					/>
					<div class="swap-on">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="swap-off">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
				</label>
			</div>
		</div>

		<!-- Sound -->
		<div class="preference-item">
			<div class="flex items-center justify-between">
				<div class="flex-1">
					<h3 class="font-medium">Sound Effects</h3>
					<p class="text-sm text-base-content/60">Play sounds for notifications and actions</p>
				</div>
				<label class="swap swap-flip">
					<input
						type="checkbox"
						checked={$preferencesStore.soundEnabled}
						on:change={preferencesStore.toggleSound}
					/>
					<div class="swap-on">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
						</svg>
					</div>
					<div class="swap-off">
						<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
							<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
						</svg>
					</div>
				</label>
			</div>
		</div>

		<!-- Theme -->
		<div class="preference-item">
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<h3 class="font-medium">Theme</h3>
					<p class="text-sm text-base-content/60">Choose your preferred color scheme</p>
				</div>
				<select
					class="select select-bordered select-sm"
					value={$preferencesStore.theme}
					on:change={(e) => preferencesStore.setTheme(e.currentTarget.value as 'light' | 'dark' | 'auto')}
				>
					<option value="auto">Auto</option>
					<option value="light">Light</option>
					<option value="dark">Dark</option>
				</select>
			</div>
		</div>
	</div>

	<!-- Advanced Settings Section -->
	<AdvancedSettings>
		<div class="space-y-4">
			<!-- Developer Mode Example -->
			<div class="preference-item">
				<div class="flex items-start justify-between">
					<div class="flex-1 flex items-center gap-2">
						<div>
							<h3 class="font-medium">Developer Mode</h3>
							<p class="text-sm text-base-content/60">Show technical details and debug information</p>
						</div>
						<InfoTooltip
							text="Enables developer features like raw event inspection, relay connection status, and additional debugging tools. Useful for developers and power users."
							position="top"
							maxWidth="350px"
						/>
					</div>
					<label class="swap swap-flip">
						<input type="checkbox" />
						<div class="swap-on">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
							</svg>
						</div>
						<div class="swap-off">
							<svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-base-content/40" viewBox="0 0 20 20" fill="currentColor">
								<path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
							</svg>
						</div>
					</label>
				</div>
			</div>
		</div>
	</AdvancedSettings>

	<div class="divider"></div>

	<div class="flex justify-end">
		<button class="btn btn-ghost btn-sm" on:click={preferencesStore.reset}>
			Reset to Defaults
		</button>
	</div>
</div>

<style>
	.preferences-panel {
		padding: 1.5rem;
	}

	.preference-item {
		padding: 1rem;
		background: var(--bg-secondary);
		border-radius: 0.5rem;
		transition: background 0.2s ease;
	}

	.preference-item:hover {
		background: var(--bg-tertiary);
	}

	.space-y-4 > * + * {
		margin-top: 1rem;
	}
</style>
