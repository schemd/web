import { SITE_ORIGIN, SIMULATION_ROUTES, VERSIONS } from '$lib/platform';
import { documentationPaths } from '$lib/server/documentation';
import type { RequestHandler } from './$types';

interface SitemapEntry {
	readonly path: string;
	readonly lastModified: string;
	readonly priority: string;
	readonly frequency: 'weekly' | 'monthly';
}

function escapeXml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

function monthlyEntry(path: string, lastModified: string, priority: string): SitemapEntry {
	return { path, lastModified, priority, frequency: 'monthly' };
}

export const GET: RequestHandler = () => {
	const currentDate = VERSIONS[0]?.releasedAt ?? '2026-07-17';
	const entries: readonly SitemapEntry[] = [
		{ path: '/', lastModified: currentDate, priority: '1.0', frequency: 'weekly' },
		{ path: '/docs', lastModified: currentDate, priority: '0.9', frequency: 'monthly' },
		{ path: '/changelog', lastModified: currentDate, priority: '0.7', frequency: 'weekly' },
		...documentationPaths().map((path) => monthlyEntry(path, currentDate, '0.8')),
		...VERSIONS.flatMap((version) => [
			monthlyEntry(version.playgroundPath, version.releasedAt, '0.8'),
			monthlyEntry(version.simulationsPath, version.releasedAt, '0.8'),
			...SIMULATION_ROUTES.map((simulation) =>
				monthlyEntry(`${version.simulationsPath}/${simulation.slug}`, version.releasedAt, '0.7')
			)
		])
	];
	const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
	.map(
		(entry) =>
			`  <url><loc>${escapeXml(`${SITE_ORIGIN}${entry.path}`)}</loc><lastmod>${entry.lastModified}</lastmod><changefreq>${entry.frequency}</changefreq><priority>${entry.priority}</priority></url>`
	)
	.join('\n')}
</urlset>
`;
	return new Response(body, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
			'x-content-type-options': 'nosniff'
		}
	});
};
