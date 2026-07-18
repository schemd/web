import adapter from '@sveltejs/adapter-auto';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter(),
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
