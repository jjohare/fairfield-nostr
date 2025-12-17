/**
 * Link Previews Store Tests
 * Tests for the link preview caching and fetching functionality
 * @vitest-environment jsdom
 *
 * NOTE: The linkPreviews store uses a proxy endpoint (/api/proxy?url=...)
 * that returns JSON data. The tests mock this proxy response format.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchPreview, getCachedPreview, clearPreviewCache } from '$lib/stores/linkPreviews';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};

	return {
		getItem: (key: string) => store[key] || null,
		setItem: (key: string, value: string) => {
			store[key] = value;
		},
		removeItem: (key: string) => {
			delete store[key];
		},
		clear: () => {
			store = {};
		}
	};
})();

Object.defineProperty(global, 'localStorage', {
	value: localStorageMock
});

// Helper to create proxy JSON response
function createProxyResponse(data: Record<string, unknown>) {
	return {
		ok: true,
		json: async () => data
	};
}

describe('Link Previews Store', () => {
	beforeEach(() => {
		// Clear localStorage before each test
		localStorageMock.clear();
		clearPreviewCache();
		vi.clearAllMocks();
	});

	describe('getCachedPreview', () => {
		it('should return null for uncached URLs', () => {
			const result = getCachedPreview('https://example.com');
			expect(result).toBeNull();
		});

		it('should return cached preview data', async () => {
			const url = 'https://example.com';

			// Mock fetch to return JSON from proxy endpoint
			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Example Site',
					description: 'This is a test site',
					image: 'https://example.com/image.jpg',
					domain: 'example.com'
				})
			);

			// Fetch preview to populate cache
			await fetchPreview(url);

			// Retrieve from cache
			const cached = getCachedPreview(url);
			expect(cached).not.toBeNull();
			expect(cached?.title).toBe('Example Site');
			expect(cached?.description).toBe('This is a test site');
			expect(cached?.image).toBe('https://example.com/image.jpg');
		});
	});

	describe('fetchPreview', () => {
		it('should fetch and parse OpenGraph metadata from proxy', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Test Title',
					description: 'Test Description',
					image: 'https://example.com/og-image.jpg',
					siteName: 'Example Site',
					domain: 'example.com',
					favicon: 'https://www.google.com/s2/favicons?domain=example.com&sz=32'
				})
			);

			const preview = await fetchPreview(url);

			expect(preview.url).toBe(url);
			expect(preview.title).toBe('Test Title');
			expect(preview.description).toBe('Test Description');
			expect(preview.image).toBe('https://example.com/og-image.jpg');
			expect(preview.siteName).toBe('Example Site');
			expect(preview.domain).toBe('example.com');
		});

		it('should use fallback values from proxy response', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Page Title',
					description: 'Page description',
					domain: 'example.com'
				})
			);

			const preview = await fetchPreview(url);

			expect(preview.title).toBe('Page Title');
			expect(preview.description).toBe('Page description');
		});

		it('should handle decoded HTML entities from proxy', async () => {
			const url = 'https://example.com';

			// Proxy returns already-decoded entities
			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Title & More',
					description: 'Test <tag>',
					domain: 'example.com'
				})
			);

			const preview = await fetchPreview(url);

			expect(preview.title).toBe('Title & More');
			expect(preview.description).toBe('Test <tag>');
		});

		it('should handle resolved image URLs from proxy', async () => {
			const url = 'https://example.com/page';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Test',
					image: 'https://example.com/relative/image.jpg',
					domain: 'example.com'
				})
			);

			const preview = await fetchPreview(url);

			expect(preview.image).toBe('https://example.com/relative/image.jpg');
		});

		it('should handle fetch errors gracefully', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

			const preview = await fetchPreview(url);

			expect(preview.error).toBe(true);
			expect(preview.url).toBe(url);
			expect(preview.domain).toBe('example.com');
			expect(preview.favicon).toContain('google.com/s2/favicons');
		});

		it('should handle HTTP errors', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue({
				ok: false,
				status: 404
			});

			const preview = await fetchPreview(url);

			expect(preview.error).toBe(true);
		});

		it('should cache fetched previews', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Cached Title',
					domain: 'example.com'
				})
			);

			// First fetch
			const preview1 = await fetchPreview(url);
			expect(preview1.title).toBe('Cached Title');

			// Clear the mock to verify cache is used
			vi.clearAllMocks();
			global.fetch = vi.fn();

			// Second fetch should use cache
			const preview2 = await fetchPreview(url);
			expect(preview2.title).toBe('Cached Title');
			expect(global.fetch).not.toHaveBeenCalled();
		});

		it('should remove www prefix from domain', async () => {
			const url = 'https://www.example.com';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Test',
					domain: 'example.com'
				})
			);

			const preview = await fetchPreview(url);

			expect(preview.domain).toBe('example.com');
		});

		it('should handle Twitter/X embed responses', async () => {
			const url = 'https://twitter.com/user/status/123';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					type: 'twitter',
					html: '<blockquote>Tweet content</blockquote>',
					author_name: 'Test User',
					author_url: 'https://twitter.com/user',
					provider_name: 'X'
				})
			);

			const preview = await fetchPreview(url);

			expect(preview.type).toBe('twitter');
			expect(preview.html).toBe('<blockquote>Tweet content</blockquote>');
			expect(preview.authorName).toBe('Test User');
			expect(preview.siteName).toBe('X');
		});
	});

	describe('clearPreviewCache', () => {
		it('should clear all cached previews', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Test',
					domain: 'example.com'
				})
			);

			// Fetch to populate cache
			await fetchPreview(url);
			expect(getCachedPreview(url)).not.toBeNull();

			// Clear cache
			clearPreviewCache();

			// Cache should be empty
			expect(getCachedPreview(url)).toBeNull();
		});
	});

	describe('Cache persistence', () => {
		it('should persist cache to localStorage', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue(
				createProxyResponse({
					title: 'Persistent Title',
					domain: 'example.com'
				})
			);

			await fetchPreview(url);

			// Check localStorage - correct key is nostr_bbs_link_previews
			const stored = localStorageMock.getItem('nostr_bbs_link_previews');
			expect(stored).not.toBeNull();

			const parsed = JSON.parse(stored!);
			expect(parsed[url]).toBeDefined();
			expect(parsed[url].data.title).toBe('Persistent Title');
		});

		it('should limit cache size to prevent overflow', async () => {
			// Mock fetch for multiple URLs
			global.fetch = vi.fn().mockImplementation((fetchUrl: string) => {
				// Extract the actual URL from proxy query param
				const urlParam = new URL(fetchUrl, 'http://localhost').searchParams.get('url') || '';
				const domain = urlParam ? new URL(urlParam).hostname : 'example.com';
				return Promise.resolve(
					createProxyResponse({
						title: 'Test',
						domain
					})
				);
			});

			// Fetch more than MAX_CACHE_SIZE (100) previews
			const urls = Array.from({ length: 105 }, (_, i) => `https://example${i}.com`);

			for (const url of urls) {
				await fetchPreview(url);
			}

			// Check that cache is limited
			const stored = localStorageMock.getItem('nostr_bbs_link_previews');
			const parsed = JSON.parse(stored!);
			const cacheSize = Object.keys(parsed).length;

			expect(cacheSize).toBeLessThanOrEqual(100);
		});
	});
});
