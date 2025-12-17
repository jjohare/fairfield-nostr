<script lang="ts">
	import { onMount } from 'svelte';
	import type { MediaType } from '$lib/utils/linkPreview';

	export let media: MediaType;

	let element: HTMLElement;
	let isVisible = false;
	let expanded = false;
	let lightboxOpen = false;
	let videoPlaying = false;
	let youtubeIframeLoaded = false;

	// Lazy load media using intersection observer
	onMount(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !isVisible) {
						isVisible = true;
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

	function toggleExpand() {
		expanded = !expanded;
	}

	let previousBodyOverflow = '';

	function openLightbox() {
		if (media.type === 'image') {
			lightboxOpen = true;
			previousBodyOverflow = document.body.style.overflow;
			document.body.style.overflow = 'hidden';
		}
	}

	function closeLightbox() {
		lightboxOpen = false;
		document.body.style.overflow = previousBodyOverflow;
	}

	function toggleVideo() {
		videoPlaying = !videoPlaying;
	}

	function loadYouTubeIframe() {
		youtubeIframeLoaded = true;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && lightboxOpen) {
			closeLightbox();
		}
	}

	$: if (lightboxOpen) {
		window.addEventListener('keydown', handleKeydown);
	} else {
		window.removeEventListener('keydown', handleKeydown);
	}
</script>

<div bind:this={element} class="media-embed">
	{#if media.type === 'image'}
		<!-- Image embed with lightbox -->
		<div class="image-container" class:expanded>
			{#if isVisible}
				<img
					src={media.url}
					alt="Embedded image"
					class="embedded-image"
					loading="lazy"
					on:click={openLightbox}
					on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), openLightbox())}
					role="button"
					tabindex="0"
					aria-label="View image in lightbox"
				/>
			{:else}
				<div class="media-placeholder">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
						<circle cx="8.5" cy="8.5" r="1.5" />
						<polyline points="21 15 16 10 5 21" />
					</svg>
					<span>Image</span>
				</div>
			{/if}
			<button class="expand-button" on:click={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
				{#if expanded}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="4 14 10 14 10 20" />
						<polyline points="20 10 14 10 14 4" />
						<line x1="14" y1="10" x2="21" y2="3" />
						<line x1="3" y1="21" x2="10" y2="14" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 3 21 3 21 9" />
						<polyline points="9 21 3 21 3 15" />
						<line x1="21" y1="3" x2="14" y2="10" />
						<line x1="3" y1="21" x2="10" y2="14" />
					</svg>
				{/if}
			</button>
		</div>

		{#if lightboxOpen}
			<div class="lightbox" on:click={closeLightbox} role="button" tabindex="0" aria-label="Close lightbox" on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), closeLightbox())}>
				<button class="lightbox-close" on:click={closeLightbox}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
				<img src={media.url} alt="Full size image" class="lightbox-image" on:click|stopPropagation />
			</div>
		{/if}
	{:else if media.type === 'video'}
		<!-- Video player -->
		<div class="video-container" class:expanded>
			{#if isVisible}
				<video
					src={media.url}
					controls
					preload="metadata"
					class="embedded-video"
					on:play={() => (videoPlaying = true)}
					on:pause={() => (videoPlaying = false)}
				>
					<track kind="captions" />
					Your browser does not support the video tag.
				</video>
			{:else}
				<div class="media-placeholder">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polygon points="5 3 19 12 5 21 5 3" />
					</svg>
					<span>Video</span>
				</div>
			{/if}
			<button class="expand-button" on:click={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
				{#if expanded}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="4 14 10 14 10 20" />
						<polyline points="20 10 14 10 14 4" />
						<line x1="14" y1="10" x2="21" y2="3" />
						<line x1="3" y1="21" x2="10" y2="14" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 3 21 3 21 9" />
						<polyline points="9 21 3 21 3 15" />
						<line x1="21" y1="3" x2="14" y2="10" />
						<line x1="3" y1="21" x2="10" y2="14" />
					</svg>
				{/if}
			</button>
		</div>
	{:else if media.type === 'youtube' && media.youtubeId}
		<!-- YouTube embed (lite version) -->
		<div class="youtube-container" class:expanded>
			{#if !youtubeIframeLoaded}
				<button class="youtube-preview" on:click={loadYouTubeIframe}>
					{#if isVisible}
						<img
							src={`https://i.ytimg.com/vi/${media.youtubeId}/hqdefault.jpg`}
							alt="YouTube video thumbnail"
							class="youtube-thumbnail"
							loading="lazy"
						/>
					{:else}
						<div class="media-placeholder">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
							</svg>
						</div>
					{/if}
					<div class="youtube-play-button">
						<svg viewBox="0 0 68 48" fill="currentColor">
							<path d="M66.52,7.74c-0.78-2.93-2.49-5.41-5.42-6.19C55.79,.13,34,0,34,0S12.21,.13,6.9,1.55 C3.97,2.33,2.27,4.81,1.48,7.74C0.06,13.05,0,24,0,24s0.06,10.95,1.48,16.26c0.78,2.93,2.49,5.41,5.42,6.19 C12.21,47.87,34,48,34,48s21.79-0.13,27.1-1.55c2.93-0.78,4.64-3.26,5.42-6.19C67.94,34.95,68,24,68,24S67.94,13.05,66.52,7.74z" fill="#f00" />
							<path d="M 45,24 27,14 27,34" fill="#fff" />
						</svg>
					</div>
				</button>
			{:else}
				<iframe
					src={`https://www.youtube-nocookie.com/embed/${media.youtubeId}?autoplay=1`}
					title="YouTube video player"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
					class="youtube-iframe"
				></iframe>
			{/if}
			<button class="expand-button" on:click={toggleExpand} title={expanded ? 'Collapse' : 'Expand'}>
				{#if expanded}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="4 14 10 14 10 20" />
						<polyline points="20 10 14 10 14 4" />
						<line x1="14" y1="10" x2="21" y2="3" />
						<line x1="3" y1="21" x2="10" y2="14" />
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<polyline points="15 3 21 3 21 9" />
						<polyline points="9 21 3 21 3 15" />
						<line x1="21" y1="3" x2="14" y2="10" />
						<line x1="3" y1="21" x2="10" y2="14" />
					</svg>
				{/if}
			</button>
		</div>
	{/if}
</div>

<style>
	.media-embed {
		margin-top: 0.5rem;
	}

	.image-container,
	.video-container,
	.youtube-container {
		position: relative;
		max-width: 500px;
		border-radius: 0.5rem;
		overflow: hidden;
		background: var(--bg-tertiary);
		transition: max-width 0.3s ease;
	}

	.image-container.expanded,
	.video-container.expanded,
	.youtube-container.expanded {
		max-width: 100%;
	}

	.embedded-image {
		width: 100%;
		height: auto;
		display: block;
		cursor: zoom-in;
		transition: opacity 0.2s ease;
	}

	.embedded-image:hover {
		opacity: 0.9;
	}

	.embedded-video,
	.youtube-iframe {
		width: 100%;
		aspect-ratio: 16 / 9;
		display: block;
	}

	.youtube-preview {
		position: relative;
		width: 100%;
		aspect-ratio: 16 / 9;
		padding: 0;
		border: none;
		background: #000;
		cursor: pointer;
		overflow: hidden;
		display: block;
	}

	.youtube-thumbnail {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}

	.youtube-play-button {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 68px;
		height: 48px;
		transition: transform 0.2s ease;
	}

	.youtube-preview:hover .youtube-play-button {
		transform: translate(-50%, -50%) scale(1.1);
	}

	.media-placeholder {
		width: 100%;
		aspect-ratio: 16 / 9;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		color: var(--text-secondary);
		background: var(--bg-tertiary);
	}

	.media-placeholder svg {
		width: 48px;
		height: 48px;
	}

	.media-placeholder span {
		font-size: 0.875rem;
		font-weight: 500;
	}

	.expand-button {
		position: absolute;
		top: 0.5rem;
		right: 0.5rem;
		width: 32px;
		height: 32px;
		padding: 0.375rem;
		background: rgba(0, 0, 0, 0.6);
		border: none;
		border-radius: 0.375rem;
		color: white;
		cursor: pointer;
		opacity: 0;
		transition: opacity 0.2s ease, background 0.2s ease;
		z-index: 1;
	}

	.image-container:hover .expand-button,
	.video-container:hover .expand-button,
	.youtube-container:hover .expand-button {
		opacity: 1;
	}

	.expand-button:hover {
		background: rgba(0, 0, 0, 0.8);
	}

	.expand-button svg {
		width: 100%;
		height: 100%;
	}

	.lightbox {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.95);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
		cursor: zoom-out;
		padding: 2rem;
	}

	.lightbox-close {
		position: absolute;
		top: 1rem;
		right: 1rem;
		width: 40px;
		height: 40px;
		padding: 0.5rem;
		background: rgba(255, 255, 255, 0.1);
		border: none;
		border-radius: 50%;
		color: white;
		cursor: pointer;
		transition: background 0.2s ease;
		z-index: 10000;
	}

	.lightbox-close:hover {
		background: rgba(255, 255, 255, 0.2);
	}

	.lightbox-close svg {
		width: 100%;
		height: 100%;
	}

	.lightbox-image {
		max-width: 90%;
		max-height: 90%;
		object-fit: contain;
		cursor: default;
		border-radius: 0.5rem;
	}

	@media (max-width: 768px) {
		.image-container,
		.video-container,
		.youtube-container {
			max-width: 100%;
		}

		.lightbox {
			padding: 1rem;
		}

		.lightbox-image {
			max-width: 95%;
			max-height: 95%;
		}
	}
</style>
