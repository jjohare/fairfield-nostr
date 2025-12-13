import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

// PWA plugin config
const pwaPlugin = [
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
];

export default defineConfig({
	plugins: [
		sveltekit(),
		...pwaPlugin
	],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}'],
		globals: true,
		environment: 'jsdom'
	},
	build: {
		target: 'esnext',
		// Disable sourcemaps in production to prevent source code exposure
		sourcemap: process.env.NODE_ENV !== 'production' ? true : false,
		// Minify in production
		minify: process.env.NODE_ENV === 'production' ? 'esbuild' : false,
		rollupOptions: {
			// Ensure crypto packages are bundled
			external: []
		}
	},
		  resolve: {
		      alias: {
		          // Force resolution to the version installed in root node_modules
		          '@noble/hashes': new URL('./node_modules/@noble/hashes', import.meta.url).pathname
		      }
		  },
	ssr: {
		// Force bundling of crypto packages to avoid version conflicts
		noExternal: [
			'@noble/hashes',
			'@noble/curves',
			'@noble/secp256k1',
			'@scure/bip32',
			'@scure/bip39',
			'@nostr-dev-kit/ndk',
			'@nostr-dev-kit/ndk-svelte'
		]
	}
});
