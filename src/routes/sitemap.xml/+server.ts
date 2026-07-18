import { documentationPaths } from '$lib/server/docs-registry';
import { SIMULATIONS } from '$lib/simulations/manifest';
import { SITE_ORIGIN, VERSIONS } from '$lib/versioning/manifest';
import type { RequestHandler } from './$types';

interface SitemapEntry { readonly path: string; readonly lastModified: string; readonly priority: string }

export const GET: RequestHandler = () => {
	const currentDate = VERSIONS[0].releasedAt;
	const entries: SitemapEntry[] = [
		{ path: '/', lastModified: currentDate, priority: '1.0' },
		{ path: '/timeline', lastModified: '2026-07-18', priority: '0.7' },
		{ path: '/changelog', lastModified: currentDate, priority: '0.7' },
		...documentationPaths().map((path) => ({ path, lastModified: currentDate, priority: '0.8' })),
		...VERSIONS.flatMap((version) => [
			{ path: version.playgroundPath, lastModified: version.releasedAt, priority: '0.8' },
			{ path: version.simulationsPath, lastModified: version.releasedAt, priority: '0.8' },
			...SIMULATIONS.map((simulation) => ({ path: `${version.simulationsPath}/${simulation.id}`, lastModified: version.releasedAt, priority: '0.7' }))
		])
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map((entry) => `  <url><loc>${SITE_ORIGIN}${entry.path}</loc><lastmod>${entry.lastModified}</lastmod><priority>${entry.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=utf-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
