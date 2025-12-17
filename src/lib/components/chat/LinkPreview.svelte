<script lang="ts">
	import { onMount } from 'svelte';
	import { fetchPreview, getCachedPreview, type LinkPreviewData } from '$lib/stores/linkPreviews';
	import { getDomain, getFaviconUrl } from '$lib/utils/linkPreview';

	export let url: string;

	let preview: LinkPreviewData | null = null;
	let loading = true;
	let error = false;
	let element: HTMLElement;
	let isVisible = false;

	// Lazy load preview using intersection observer
	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !isVisible) {
						isVisible = true;
						loadPreview();
					}
				});
			},
			{ rootMargin: '100px' }
		);

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	});

	async function loadPreview() {
		// Check cache first
		const cached = getCachedPreview(url);
		if (cached) {
			preview = cached;
			loading = false;
			error = cached.error || false;
			return;
		}

		// Fetch preview
		try {
			preview = await fetchPreview(url);
			error = preview.error || false;
		} catch (err) {
			console.error('Failed to load preview:', err);
			error = true;
			preview = {
				url,
				domain: getDomain(url),
				favicon: getFaviconUrl(url),
				error: true,
			};
		} finally {
			loading = false;
		}
	}

	function openLink() {
		window.open(url, '_blank', 'noopener,noreferrer');
	}
</script>

<div bind:this={element} class="link-preview" role="button" tabindex="0" aria-label="Open link in new tab" on:click={openLink} on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openLink())}>
	{#if loading}
		<!-- Loading skeleton -->
		<div class="preview-skeleton">
			<div class="skeleton-image"></div>
			<div class="skeleton-content">
				<div class="skeleton-title"></div>
				<div class="skeleton-description"></div>
				<div class="skeleton-domain"></div>
			</div>
		</div>
	{:else if error || !preview?.title}
		<!-- Error state or minimal preview - just show link -->
		<div class="preview-minimal">
			{#if preview?.favicon}
				<img src={preview.favicon} alt="" class="favicon" />
			{/if}
			<div class="link-text">
				<div class="domain">{preview?.domain || getDomain(url)}</div>
				<div class="url" title={url}>{url}</div>
			</div>
			<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				<polyline points="15 3 21 3 21 9" />
				<line x1="10" y1="14" x2="21" y2="3" />
			</svg>
		</div>
	{:else}
		<!-- Full preview card -->
		<div class="preview-card">
			{#if preview.image}
				<div class="preview-image-container">
					<img src={preview.image} alt={preview.title || ''} class="preview-image" loading="lazy" />
				</div>
			{/if}
			<div class="preview-content">
				<div class="preview-header">
					{#if preview.favicon}
						<img src={preview.favicon} alt="" class="favicon" />
					{/if}
					<span class="domain">{preview.siteName || preview.domain}</span>
				</div>
				<h4 class="preview-title">{preview.title}</h4>
				{#if preview.description}
					<p class="preview-description">{preview.description}</p>
				{/if}
			</div>
			<svg class="external-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
				<polyline points="15 3 21 3 21 9" />
				<line x1="10" y1="14" x2="21" y2="3" />
			</svg>
		</div>
	{/if}
</div>

<style>
	.link-preview {
		margin-top: 0.5rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.link-preview:hover {
		transform: translateY(-1px);
	}

	.link-preview:active {
		transform: translateY(0);
	}

	.preview-skeleton {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
	}

	.skeleton-image {
		width: 100px;
		height: 100px;
		background: linear-gradient(90deg, var(--bg-tertiary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.375rem;
		flex-shrink: 0;
	}

	.skeleton-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		min-width: 0;
	}

	.skeleton-title,
	.skeleton-description,
	.skeleton-domain {
		background: linear-gradient(90deg, var(--bg-tertiary) 0%, var(--bg-secondary) 50%, var(--bg-tertiary) 100%);
		background-size: 200% 100%;
		animation: shimmer 1.5s infinite;
		border-radius: 0.25rem;
	}

	.skeleton-title {
		height: 1.25rem;
		width: 70%;
	}

	.skeleton-description {
		height: 0.875rem;
		width: 100%;
	}

	.skeleton-domain {
		height: 0.75rem;
		width: 40%;
		margin-top: auto;
	}

	@keyframes shimmer {
		0% {
			background-position: 200% 0;
		}
		100% {
			background-position: -200% 0;
		}
	}

	.preview-minimal {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.75rem;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		transition: border-color 0.2s ease;
	}

	.preview-minimal:hover {
		border-color: var(--primary-color);
	}

	.link-text {
		flex: 1;
		min-width: 0;
	}

	.domain {
		font-size: 0.75rem;
		color: var(--text-secondary);
		font-weight: 500;
	}

	.url {
		font-size: 0.875rem;
		color: var(--text-primary);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-card {
		position: relative;
		display: flex;
		flex-direction: column;
		background: var(--bg-secondary);
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		overflow: hidden;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.preview-card:hover {
		border-color: var(--primary-color);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.preview-image-container {
		width: 100%;
		max-height: 200px;
		overflow: hidden;
		background: var(--bg-tertiary);
	}

	.preview-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.preview-content {
		padding: 0.75rem;
	}

	.preview-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.5rem;
	}

	.favicon {
		width: 16px;
		height: 16px;
		object-fit: contain;
	}

	.preview-title {
		margin: 0 0 0.375rem 0;
		font-size: 0.9375rem;
		font-weight: 600;
		color: var(--text-primary);
		line-height: 1.4;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.preview-description {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--text-secondary);
		line-height: 1.5;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
	}

	.external-icon {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 18px;
		height: 18px;
		color: var(--text-secondary);
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.preview-card:hover .external-icon,
	.preview-minimal:hover .external-icon {
		opacity: 1;
	}

	.preview-minimal .external-icon {
		position: static;
		flex-shrink: 0;
	}
</style>
