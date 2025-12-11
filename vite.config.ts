import { sveltekit } from '@sveltejs/kit/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [
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
		exclude: ['@nostr-dev-kit/ndk', '@nostr-dev-kit/ndk-svelte'],
		include: ['@noble/hashes', '@scure/bip32', '@scure/bip39']
	},
	build: {
		target: 'esnext',
		sourcemap: true,
		rollupOptions: {
			external: []
		}
	},
	resolve: {
		alias: {
			'@noble/hashes/utils': '@noble/hashes/utils'
		}
	}
});
