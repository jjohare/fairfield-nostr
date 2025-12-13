import { describe, it, expect } from 'vitest';
import {
	extractUrls,
	isImageUrl,
	isVideoUrl,
	isYouTubeUrl,
	parseYouTubeId,
	getDomain,
	getFaviconUrl,
	getMediaType,
} from '$lib/utils/linkPreview';

describe('Link Preview Utilities', () => {
	describe('extractUrls', () => {
		it('should extract single URL from text', () => {
			const text = 'Check out this link: https://example.com';
			const urls = extractUrls(text);
			expect(urls).toEqual(['https://example.com']);
		});

		it('should extract multiple URLs from text', () => {
			const text = 'Visit https://example.com and https://test.com for more info';
			const urls = extractUrls(text);
			expect(urls).toEqual(['https://example.com', 'https://test.com']);
		});

		it('should deduplicate URLs', () => {
			const text = 'https://example.com and https://example.com again';
			const urls = extractUrls(text);
			expect(urls).toEqual(['https://example.com']);
		});

		it('should handle URLs with query parameters', () => {
			const text = 'https://example.com/path?param=value&other=123';
			const urls = extractUrls(text);
			expect(urls).toEqual(['https://example.com/path?param=value&other=123']);
		});

		it('should return empty array for text without URLs', () => {
			const text = 'Just some regular text without links';
			const urls = extractUrls(text);
			expect(urls).toEqual([]);
		});

		it('should handle URLs at start and end of text', () => {
			const text = 'https://example.com is great and so is https://test.com';
			const urls = extractUrls(text);
			expect(urls).toEqual(['https://example.com', 'https://test.com']);
		});
	});

	describe('isImageUrl', () => {
		it('should detect common image extensions', () => {
			expect(isImageUrl('https://example.com/image.jpg')).toBe(true);
			expect(isImageUrl('https://example.com/photo.jpeg')).toBe(true);
			expect(isImageUrl('https://example.com/graphic.png')).toBe(true);
			expect(isImageUrl('https://example.com/animation.gif')).toBe(true);
			expect(isImageUrl('https://example.com/image.webp')).toBe(true);
		});

		it('should handle URLs with query parameters', () => {
			expect(isImageUrl('https://example.com/image.jpg?size=large')).toBe(true);
		});

		it('should be case insensitive', () => {
			expect(isImageUrl('https://example.com/IMAGE.JPG')).toBe(true);
			expect(isImageUrl('https://example.com/photo.PNG')).toBe(true);
		});

		it('should return false for non-image URLs', () => {
			expect(isImageUrl('https://example.com')).toBe(false);
			expect(isImageUrl('https://example.com/page.html')).toBe(false);
			expect(isImageUrl('https://example.com/video.mp4')).toBe(false);
		});
	});

	describe('isVideoUrl', () => {
		it('should detect common video extensions', () => {
			expect(isVideoUrl('https://example.com/video.mp4')).toBe(true);
			expect(isVideoUrl('https://example.com/clip.webm')).toBe(true);
			expect(isVideoUrl('https://example.com/movie.mov')).toBe(true);
			expect(isVideoUrl('https://example.com/file.avi')).toBe(true);
		});

		it('should handle URLs with query parameters', () => {
			expect(isVideoUrl('https://example.com/video.mp4?quality=hd')).toBe(true);
		});

		it('should return false for non-video URLs', () => {
			expect(isVideoUrl('https://example.com')).toBe(false);
			expect(isVideoUrl('https://example.com/image.jpg')).toBe(false);
		});
	});

	describe('isYouTubeUrl', () => {
		it('should detect youtube.com watch URLs', () => {
			expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
			expect(isYouTubeUrl('https://youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
		});

		it('should detect youtu.be short URLs', () => {
			expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
		});

		it('should detect embedded URLs', () => {
			expect(isYouTubeUrl('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
		});

		it('should return false for non-YouTube URLs', () => {
			expect(isYouTubeUrl('https://example.com')).toBe(false);
			expect(isYouTubeUrl('https://vimeo.com/123456')).toBe(false);
		});
	});

	describe('parseYouTubeId', () => {
		it('should extract video ID from youtube.com watch URLs', () => {
			expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should extract video ID from youtu.be short URLs', () => {
			expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should extract video ID from embedded URLs', () => {
			expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
		});

		it('should return null for non-YouTube URLs', () => {
			expect(parseYouTubeId('https://example.com')).toBe(null);
		});
	});

	describe('getDomain', () => {
		it('should extract domain from URL', () => {
			expect(getDomain('https://example.com/path')).toBe('example.com');
			expect(getDomain('https://subdomain.example.com')).toBe('subdomain.example.com');
		});

		it('should remove www prefix', () => {
			expect(getDomain('https://www.example.com')).toBe('example.com');
		});

		it('should handle invalid URLs', () => {
			expect(getDomain('not a url')).toBe('');
		});
	});

	describe('getFaviconUrl', () => {
		it('should generate Google favicon URL', () => {
			const url = getFaviconUrl('https://example.com');
			expect(url).toContain('google.com/s2/favicons');
			expect(url).toContain('domain=example.com');
		});

		it('should return empty string for invalid URLs', () => {
			expect(getFaviconUrl('not a url')).toBe('');
		});
	});

	describe('getMediaType', () => {
		it('should identify image URLs', () => {
			const result = getMediaType('https://example.com/image.jpg');
			expect(result.type).toBe('image');
			expect(result.url).toBe('https://example.com/image.jpg');
		});

		it('should identify video URLs', () => {
			const result = getMediaType('https://example.com/video.mp4');
			expect(result.type).toBe('video');
			expect(result.url).toBe('https://example.com/video.mp4');
		});

		it('should identify YouTube URLs', () => {
			const result = getMediaType('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
			expect(result.type).toBe('youtube');
			expect(result.youtubeId).toBe('dQw4w9WgXcQ');
		});

		it('should identify regular links', () => {
			const result = getMediaType('https://example.com');
			expect(result.type).toBe('link');
		});

		it('should prioritize media types correctly', () => {
			// Image should take priority
			expect(getMediaType('https://example.com/file.jpg').type).toBe('image');
			// Video should be detected
			expect(getMediaType('https://example.com/file.mp4').type).toBe('video');
			// YouTube should be detected (requires 11-character ID)
			expect(getMediaType('https://youtu.be/dQw4w9WgXcQ').type).toBe('youtube');
		});
	});
});
