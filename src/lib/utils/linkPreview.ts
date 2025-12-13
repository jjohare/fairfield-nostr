/**
 * Link preview utilities
 * Detects and extracts URLs from messages
 */

const URL_REGEX = /(https?:\/\/[^\s<>"']+)/gi;
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
const VIDEO_EXTENSIONS = /\.(mp4|webm|ogg|mov|avi)(\?.*)?$/i;
const YOUTUBE_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;

/**
 * Extract all URLs from text
 */
export function extractUrls(text: string): string[] {
	const matches = text.match(URL_REGEX);
	if (!matches) return [];

	// Deduplicate and validate
	const urls = [...new Set(matches)];
	return urls.filter(url => {
		try {
			new URL(url);
			return true;
		} catch {
			return false;
		}
	});
}

/**
 * Check if URL points to an image
 */
export function isImageUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		return IMAGE_EXTENSIONS.test(pathname);
	} catch {
		return false;
	}
}

/**
 * Check if URL points to a video
 */
export function isVideoUrl(url: string): boolean {
	try {
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		return VIDEO_EXTENSIONS.test(pathname);
	} catch {
		return false;
	}
}

/**
 * Check if URL is a YouTube link
 */
export function isYouTubeUrl(url: string): boolean {
	return YOUTUBE_REGEX.test(url);
}

/**
 * Extract YouTube video ID from URL
 */
export function parseYouTubeId(url: string): string | null {
	const match = url.match(YOUTUBE_REGEX);
	return match ? match[1] : null;
}

/**
 * Get domain name from URL
 */
export function getDomain(url: string): string {
	try {
		const urlObj = new URL(url);
		return urlObj.hostname.replace(/^www\./, '');
	} catch {
		return '';
	}
}

/**
 * Get favicon URL for a domain
 */
export function getFaviconUrl(url: string): string {
	try {
		const urlObj = new URL(url);
		return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
	} catch {
		return '';
	}
}

/**
 * Determine media type for a URL
 */
export interface MediaType {
	type: 'image' | 'video' | 'youtube' | 'link';
	url: string;
	youtubeId?: string;
}

export function getMediaType(url: string): MediaType {
	if (isImageUrl(url)) {
		return { type: 'image', url };
	}
	if (isVideoUrl(url)) {
		return { type: 'video', url };
	}
	const youtubeId = parseYouTubeId(url);
	if (youtubeId) {
		return { type: 'youtube', url, youtubeId };
	}
	return { type: 'link', url };
}
