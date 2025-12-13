/**
 * Link Previews Store Tests
 * Tests for the link preview caching and fetching functionality
 * @vitest-environment jsdom
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

			// Mock fetch to return HTML with OpenGraph tags
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Example Site" />
							<meta property="og:description" content="This is a test site" />
							<meta property="og:image" content="https://example.com/image.jpg" />
							<title>Example Site</title>
						</head>
					</html>
				`
			});

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
		it('should fetch and parse OpenGraph metadata', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Test Title" />
							<meta property="og:description" content="Test Description" />
							<meta property="og:image" content="https://example.com/og-image.jpg" />
							<meta property="og:site_name" content="Example Site" />
							<title>Fallback Title</title>
						</head>
					</html>
				`
			});

			const preview = await fetchPreview(url);

			expect(preview.url).toBe(url);
			expect(preview.title).toBe('Test Title');
			expect(preview.description).toBe('Test Description');
			expect(preview.image).toBe('https://example.com/og-image.jpg');
			expect(preview.siteName).toBe('Example Site');
			expect(preview.domain).toBe('example.com');
			expect(preview.favicon).toContain('google.com/s2/favicons');
		});

		it('should fallback to title tag when og:title is missing', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<title>Page Title</title>
							<meta name="description" content="Page description" />
						</head>
					</html>
				`
			});

			const preview = await fetchPreview(url);

			expect(preview.title).toBe('Page Title');
			expect(preview.description).toBe('Page description');
		});

		it('should decode HTML entities in metadata', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Title &amp; More" />
							<meta property="og:description" content="Test &lt;tag&gt;" />
						</head>
					</html>
				`
			});

			const preview = await fetchPreview(url);

			expect(preview.title).toBe('Title & More');
			expect(preview.description).toBe('Test <tag>');
		});

		it('should resolve relative image URLs', async () => {
			const url = 'https://example.com/page';

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Test" />
							<meta property="og:image" content="/relative/image.jpg" />
						</head>
					</html>
				`
			});

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
				status: 404,
				text: async () => ''
			});

			const preview = await fetchPreview(url);

			expect(preview.error).toBe(true);
		});

		it('should cache fetched previews', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Cached Title" />
						</head>
					</html>
				`
			});

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

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => '<html><head><title>Test</title></head></html>'
			});

			const preview = await fetchPreview(url);

			expect(preview.domain).toBe('example.com');
		});
	});

	describe('clearPreviewCache', () => {
		it('should clear all cached previews', async () => {
			const url = 'https://example.com';

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Test" />
						</head>
					</html>
				`
			});

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

			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => `
					<html>
						<head>
							<meta property="og:title" content="Persistent Title" />
						</head>
					</html>
				`
			});

			await fetchPreview(url);

			// Check localStorage
			const stored = localStorageMock.getItem('fairfield-link-previews');
			expect(stored).not.toBeNull();

			const parsed = JSON.parse(stored!);
			expect(parsed[url]).toBeDefined();
			expect(parsed[url].data.title).toBe('Persistent Title');
		});

		it('should limit cache size to prevent overflow', async () => {
			// Mock fetch for multiple URLs
			global.fetch = vi.fn().mockResolvedValue({
				ok: true,
				text: async () => '<html><head><title>Test</title></head></html>'
			});

			// Fetch more than MAX_CACHE_SIZE (100) previews
			const urls = Array.from({ length: 105 }, (_, i) => `https://example${i}.com`);

			for (const url of urls) {
				await fetchPreview(url);
			}

			// Check that cache is limited
			const stored = localStorageMock.getItem('fairfield-link-previews');
			const parsed = JSON.parse(stored!);
			const cacheSize = Object.keys(parsed).length;

			expect(cacheSize).toBeLessThanOrEqual(100);
		});
	});
});
