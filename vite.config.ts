import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';
import path from 'path';

/**
 * ⚠️ IMPORTANT: NDK VERSION LOCK REQUIRED ⚠️
 *
 * The @nostr-dev-kit packages have complex dependencies on @noble/hashes and @noble/curves.
 * The versions in package.json MUST remain locked to prevent build failures:
 *
 * - @nostr-dev-kit/ndk: ^2.8.2
 * - @nostr-dev-kit/ndk-cache-dexie: ^2.2.11
 * - @nostr-dev-kit/ndk-svelte: ^2.2.15
 * - @noble/hashes: ^2.0.1 (devDependencies)
 * - @noble/curves: ^2.0.1 (devDependencies)
 *
 * Before updating ANY of these packages:
 * 1. Test the build thoroughly: npm run build
 * 2. Check for ESM export issues in the browser console
 * 3. Verify crypto operations (key generation, signing) work correctly
 *
 * The noblePackagesFixPlugin below handles version conflicts between NDK's nested
 * @noble packages (v1.x) and root @noble packages (v2.x) which have different export
 * structures. If NDK updates its dependencies, this plugin may need adjustment.
 *
 * Issue tracker: https://github.com/nostr-dev-kit/ndk/issues
 */

// Custom plugin to fix @noble/hashes and @noble/curves version conflicts
// Problem: NDK needs older versions with different export structures
//          Root @noble/hashes v2.0.1: flat structure, has webcrypto.js, missing bytesToUtf8 in utils
//          Root @noble/curves v2.0.1: flat structure (./secp256k1.js -> ./secp256k1.js)
//          NDK's nested @noble/hashes v1.x: esm/ directory, has bytesToUtf8, no webcrypto.js
//          NDK's nested @noble/curves v1.9.7: esm/ directory with import/require structure
// Solution: Selectively redirect imports based on what each version provides
function noblePackagesFixPlugin() {
	const ndkHashesPath = path.resolve(
		'node_modules/@nostr-dev-kit/ndk-svelte/node_modules/@noble/hashes/esm'
	);
	const ndkCurvesPath = path.resolve(
		'node_modules/@nostr-dev-kit/ndk-svelte/node_modules/@noble/curves/esm'
	);
	const rootHashesPath = path.resolve('node_modules/@noble/hashes');

	return {
		name: 'noble-packages-fix',
		enforce: 'pre' as const,
		resolveId(source: string, importer: string | undefined) {
			// Handle @noble/hashes/webcrypto - this only exists in root v2.0.1
			// Must be redirected to root for ALL importers
			if (source === '@noble/hashes/webcrypto' || source === '@noble/hashes/webcrypto.js') {
				return path.join(rootHashesPath, 'webcrypto.js');
			}

			// Only intercept other imports from NDK packages
			if (!importer || !importer.includes('@nostr-dev-kit')) {
				return null;
			}

			// Handle @noble/hashes/utils imports from NDK packages
			// NDK's v1.x has bytesToUtf8, root v2.0.1 does not
			if (source === '@noble/hashes/utils' || source === '@noble/hashes/utils.js') {
				return path.join(ndkHashesPath, 'utils.js');
			}

			// Handle @noble/curves imports from NDK packages
			// The root v2.0.1 uses flat exports, NDK's v1.9.7 uses esm/ directory
			if (source.startsWith('@noble/curves/')) {
				const subpath = source.replace('@noble/curves/', '').replace(/\.js$/, '');
				return path.join(ndkCurvesPath, `${subpath}.js`);
			}
			if (source === '@noble/curves') {
				return path.join(ndkCurvesPath, 'index.js');
			}

			// Let all other imports resolve normally
			return null;
		}
	};
}

export default defineConfig({
	plugins: [
		noblePackagesFixPlugin(),
		sveltekit(),
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src',
			filename: 'service-worker.ts',
			registerType: 'autoUpdate',
			injectRegister: false,
			manifest: false,
			injectManifest: {
				globPatterns: ['**/*.{js,css,html,svg,png,woff,woff2}'],
				globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js']
			},
			devOptions: {
				enabled: true,
				type: 'module',
				navigateFallback: '/'
			}
		})
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom'
	},
	optimizeDeps: {
		// Exclude crypto packages from pre-bundling to avoid version conflicts
		exclude: [
			'@nostr-dev-kit/ndk',
			'@nostr-dev-kit/ndk-svelte',
			'@noble/hashes',
			'@noble/curves',
			'@noble/secp256k1',
			'@scure/bip32',
			'@scure/bip39'
		]
	},
	build: {
		target: 'esnext',
		// Disable sourcemaps in production to prevent source code exposure
		sourcemap: process.env.NODE_ENV !== 'production' ? true : false,
		// Minify in production
		minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false
	},
	ssr: {
		noExternal: ['@noble/hashes', '@noble/curves', '@scure/bip32', '@scure/bip39']
	}
});
