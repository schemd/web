import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { katexModernFonts } from './src/lib/server/katex-css.ts';

/*
 * SvelteKit 3 takes its configuration here, through the plugin; a
 * `svelte.config.js` is an error. What used to sit under `kit` is top-level.
 */
export default defineConfig({
	plugins: [
		katexModernFonts(),
		sveltekit({
			adapter: adapter({
				out: 'build',
				precompress: true
			}),
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					'base-uri': ['self'],
					'connect-src': ['self'],
					/* Full-mode schematics carry their deterministic subset font as a
					 * data URL so exported SVG remains self-contained. */
					'font-src': ['self', 'data:'],
					'form-action': ['self'],
					'frame-ancestors': ['self'],
					'img-src': ['self', 'data:', 'blob:'],
					'manifest-src': ['self'],
					'object-src': ['none'],
					'script-src': ['self'],
					/* Svelte transitions and compiler-generated SVG inject dynamic styles.
					 * Script execution remains nonce-protected and is the XSS boundary. */
					'style-src': ['self', 'unsafe-inline'],
					'style-src-attr': ['unsafe-inline']
				}
			},
			inlineStyleThreshold: 15_000,
			experimental: {
				remoteFunctions: true
			},
			compilerOptions: {
				runes: true,
				experimental: {
					async: true
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
