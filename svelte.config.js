import adapter from '@sveltejs/adapter-node';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
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
		}
	},
	compilerOptions: {
		runes: true,
		experimental: {
			async: true
		}
	}
};

export default config;
