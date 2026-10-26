/**
 * Multi-version automated sitemap.
 *
 * Rebuilt from the registry cache on request (cheap: the registry is already
 * in memory), so newly published releases appear without a redeploy.
 *
 * It advertises **one URL per distinct page**, not one per routable URL. The
 * playground and the laboratories exist once per published release, which made
 * 15 playground URLs and 210 laboratory URLs — 79% of a 266-entry sitemap —
 * rendering near-identical content and competing with each other for the same
 * query. Only the latest release is submitted; the historical URLs stay
 * reachable and now carry a canonical pointing at their newest equivalent, so a
 * crawler consolidates them instead of choosing between them.
 *
 * Documentation is the opposite case: every documented line teaches with its
 * own prose and its own examples, so each line is submitted in full.
 */
import type { RequestHandler } from './$types';
import { getRegistry } from '#lib/server/registry.ts';
import { docManifest } from '#lib/server/docs.ts';
import { DOCUMENTED_VERSIONS, LATEST_DOCUMENTED_VERSION } from '#lib/server/versions.ts';
import { componentIndex } from '#lib/server/components.ts';
import { localized, unlocalized } from '#lib/i18n/index.ts';
import { SIM_ENVIRONMENTS } from '#lib/server/simulations.ts';

interface SitemapEntry {
	readonly path: string;
	/** ISO-8601 date; omitted when nothing about the page dates it. */
	readonly lastmod?: string;
	/** Relative to the rest of this site only — never an absolute ranking claim. */
	readonly priority: string;
}

function xmlEscape(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

export const GET: RequestHandler = async ({ url }) => {
	const registry = await getRegistry();
	const origin = url.origin;
	const latest = registry.latest;
	/* The newest publication date is the best evidence this site changed: the
	 * corpus, the catalogue, and the metrics all move with a release. */
	const newestRelease = registry.releases
		.map((release) => release.publishedAt)
		.filter((at) => at > new Date(0).toISOString())
		.sort()
		.at(-1);
	const lastmod = newestRelease?.slice(0, 10);

	const entries: SitemapEntry[] = [
		{ path: '/', lastmod, priority: '1.0' },
		{ path: '/changelog', lastmod, priority: '0.7' },
		{ path: '/downloads', lastmod, priority: '0.5' },
		{ path: '/examples', lastmod, priority: '0.7' },
		{ path: '/components', lastmod, priority: '0.8' },
		{ path: '/templates', lastmod, priority: '0.8' },
		...componentIndex().map((component) => ({
			path: `/components/${component.kind}`,
			lastmod,
			priority: '0.6'
		})),
		{ path: '/coverage', lastmod, priority: '0.5' },
		{ path: '/conformance', lastmod, priority: '0.5' },
		{ path: `/playground/${latest}`, lastmod, priority: '0.8' },
		{ path: `/inspector/${latest}`, lastmod, priority: '0.8' },
		{ path: `/simulations/${latest}`, lastmod, priority: '0.8' }
	];

	for (const environment of SIM_ENVIRONMENTS) {
		entries.push({
			path: `/simulations/${latest}/${environment.id}`,
			lastmod,
			priority: '0.6'
		});
	}

	for (const line of DOCUMENTED_VERSIONS) {
		/* The current line is what a reader arriving from a search should land
		 * on; older lines are history and say so through their priority. */
		const current = line === LATEST_DOCUMENTED_VERSION;
		for (const page of docManifest(line)) {
			entries.push({
				path: `/docs/${line}/${page.slug}`,
				lastmod,
				priority: current ? '0.9' : '0.4'
			});
		}
	}

	const translated = (path: string): boolean =>
		!path.startsWith('/docs/') || /^\/docs\/(?:1\.2|1\.3)\//.test(path);
	entries.push(
		...entries
			.filter((entry) => translated(entry.path))
			.map((entry) => ({ ...entry, path: localized(entry.path, 'es') }))
	);
	const body =
		`<?xml version="1.0" encoding="UTF-8"?>` +
		/* Presentation only. The sitemap protocol ignores processing instructions,
		   so a crawler reads exactly the document it read before this line
		   existed; a browser gets /sitemap.xsl applied to it. */
		`<?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>` +
		`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">` +
		entries
			.map(
				(entry) =>
					`<url><loc>${xmlEscape(`${origin}${entry.path}`)}</loc>` +
					(translated(unlocalized(entry.path))
						? ['en', 'es', 'x-default']
								.map(
									(language) =>
										`<xhtml:link rel="alternate" hreflang="${language}" href="${xmlEscape(origin + localized(entry.path, language === 'es' ? 'es' : 'en'))}"/>`
								)
								.join('')
						: '') +
					(entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : '') +
					`<priority>${entry.priority}</priority></url>`
			)
			.join('') +
		`</urlset>`;

	return new Response(body, {
		headers: {
			'content-type': 'application/xml',
			'cache-control': 'public, max-age=3600'
		}
	});
};
