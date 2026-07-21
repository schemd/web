/**
 * Multi-version automated sitemap.
 *
 * Rebuilt from the registry cache on request (cheap: the registry is already
 * in memory), so newly published releases appear without a redeploy.
 */
import type { RequestHandler } from './$types';
import { getRegistry } from '$lib/server/registry';
import { docManifest } from '$lib/server/docs';
import { DOCUMENTED_VERSIONS } from '$lib/server/versions';
import { SIM_ENVIRONMENTS } from '$lib/server/simulations';

export const GET: RequestHandler = async ({ url }) => {
	const registry = await getRegistry();
	const origin = url.origin;
	const urls: string[] = [
		`${origin}/`,
		`${origin}/changelog`,
		`${origin}/coverage`,
		`${origin}/examples`
	];
	/* Playground and simulations exist per release; docs exist per documented line. */
	for (const release of registry.releases) {
		urls.push(
			`${origin}/playground/${release.version}`,
			`${origin}/simulations/${release.version}`
		);
		for (const environment of SIM_ENVIRONMENTS) {
			urls.push(`${origin}/simulations/${release.version}/${environment.id}`);
		}
	}
	for (const line of DOCUMENTED_VERSIONS) {
		for (const page of docManifest(line)) {
			urls.push(`${origin}/docs/${line}/${page.slug}`);
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
