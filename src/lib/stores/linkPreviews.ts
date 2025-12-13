/**
 * Link preview store with caching
 * Fetches OpenGraph metadata for URLs
 */

import { writable, get } from 'svelte/store';

export interface LinkPreviewData {
	url: string;
	title?: string;
	description?: string;
	image?: string;
	siteName?: string;
	domain: string;
	favicon?: string;
	error?: boolean;
}

interface PreviewCache {
	[url: string]: {
		data: LinkPreviewData;
		timestamp: number;
	};
}

const CACHE_KEY = 'fairfield-link-previews';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE_SIZE = 100;

// Load cache from localStorage
function loadCache(): PreviewCache {
	try {
		const cached = localStorage.getItem(CACHE_KEY);
		if (!cached) return {};

		const parsed = JSON.parse(cached);
		const now = Date.now();

		// Filter expired entries
		const filtered: PreviewCache = {};
		for (const [url, entry] of Object.entries(parsed)) {
			if (now - (entry as any).timestamp < CACHE_DURATION) {
				filtered[url] = entry as any;
			}
		}

		return filtered;
	} catch {
		return {};
	}
}

// Save cache to localStorage
function saveCache(cache: PreviewCache): void {
	try {
		// Limit cache size
		const entries = Object.entries(cache);
		if (entries.length > MAX_CACHE_SIZE) {
			// Keep only the most recent entries
			entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
			cache = Object.fromEntries(entries.slice(0, MAX_CACHE_SIZE));
		}

		localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
	} catch (error) {
		console.warn('Failed to save link preview cache:', error);
	}
}

// In-memory cache
const previewCache = writable<PreviewCache>(loadCache());

// Subscribe to cache changes and persist
previewCache.subscribe(cache => {
	saveCache(cache);
});

/**
 * Fetch preview data for a URL
 */
export async function fetchPreview(url: string): Promise<LinkPreviewData> {
	// Check cache first
	const cache = get(previewCache);
	if (cache[url]) {
		return cache[url].data;
	}

	// Extract domain for fallback
	const domain = new URL(url).hostname.replace(/^www\./, '');
	const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

	try {
		// Try to fetch OpenGraph data
		// NOTE: This requires a CORS proxy or backend endpoint
		// For now, we'll use a simple fetch and parse approach
		const response = await fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'text/html',
			},
			signal: AbortSignal.timeout(5000), // 5 second timeout
		});

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		const html = await response.text();
		const preview = parseOpenGraphTags(html, url);

		// Cache the result
		previewCache.update(cache => {
			cache[url] = {
				data: preview,
				timestamp: Date.now(),
			};
			return cache;
		});

		return preview;
	} catch (error) {
		console.warn('Failed to fetch preview for', url, error);

		// Create fallback preview
		const fallback: LinkPreviewData = {
			url,
			domain,
			favicon,
			error: true,
		};

		// Cache the error result (with shorter duration)
		previewCache.update(cache => {
			cache[url] = {
				data: fallback,
				timestamp: Date.now(),
			};
			return cache;
		});

		return fallback;
	}
}

/**
 * Parse OpenGraph tags from HTML
 */
function parseOpenGraphTags(html: string, url: string): LinkPreviewData {
	const domain = new URL(url).hostname.replace(/^www\./, '');
	const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

	const preview: LinkPreviewData = {
		url,
		domain,
		favicon,
	};

	// Extract og:title
	const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
	if (titleMatch) {
		preview.title = decodeHtmlEntities(titleMatch[1]);
	}

	// Fallback to <title> tag
	if (!preview.title) {
		const titleTagMatch = html.match(/<title>([^<]+)<\/title>/i);
		if (titleTagMatch) {
			preview.title = decodeHtmlEntities(titleTagMatch[1]);
		}
	}

	// Extract og:description
	const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i);
	if (descMatch) {
		preview.description = decodeHtmlEntities(descMatch[1]);
	}

	// Fallback to meta description
	if (!preview.description) {
		const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
		if (metaDescMatch) {
			preview.description = decodeHtmlEntities(metaDescMatch[1]);
		}
	}

	// Extract og:image
	const imageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
	if (imageMatch) {
		preview.image = resolveUrl(imageMatch[1], url);
	}

	// Extract og:site_name
	const siteMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
	if (siteMatch) {
		preview.siteName = decodeHtmlEntities(siteMatch[1]);
	}

	return preview;
}

/**
 * Decode HTML entities
 */
function decodeHtmlEntities(text: string): string {
	const textarea = document.createElement('textarea');
	textarea.innerHTML = text;
	return textarea.value;
}

/**
 * Resolve relative URLs to absolute
 */
function resolveUrl(relativeUrl: string, baseUrl: string): string {
	try {
		return new URL(relativeUrl, baseUrl).href;
	} catch {
		return relativeUrl;
	}
}

/**
 * Get cached preview if available
 */
export function getCachedPreview(url: string): LinkPreviewData | null {
	const cache = get(previewCache);
	return cache[url]?.data || null;
}

/**
 * Clear preview cache
 */
export function clearPreviewCache(): void {
	previewCache.set({});
	localStorage.removeItem(CACHE_KEY);
}
