/**
 * Multi-version automated sitemap.
 *
 * Rebuilt from the registry cache on request (cheap: the registry is already
 * in memory), so newly published releases appear without a redeploy.
 */
import type { RequestHandler } from './$types';
import { getRegistry } from '$lib/server/registry';
import { DOC_MANIFEST } from '$lib/server/docs';
import { SIM_ENVIRONMENTS } from '$lib/server/simulations';

export const GET: RequestHandler = async ({ url }) => {
	const registry = await getRegistry();
	const origin = url.origin;
	const urls: string[] = [`${origin}/`, `${origin}/changelog`];
	for (const release of registry.releases) {
		urls.push(`${origin}/playground/${release.version}`, `${origin}/simulations/${release.version}`);
		for (const environment of SIM_ENVIRONMENTS) {
			urls.push(`${origin}/simulations/${release.version}/${environment.id}`);
		}
		for (const page of DOC_MANIFEST) {
			urls.push(`${origin}/docs/${release.version}/${page.slug}`);
		}
	}
	const body =
		`<?xml version="1.0" encoding="UTF-8"?>` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
		urls.map((location) => `<url><loc>${location}</loc></url>`).join('') +
		`</urlset>`;
	return new Response(body, {
		headers: {
			'content-type': 'application/xml',
			'cache-control': 'public, max-age=3600'
		}
	});
};
