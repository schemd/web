import type { LayoutServerLoad } from './$types';
import { getRegistry } from '$lib/server/registry';
import { DOC_SLUGS_BY_LINE, docSearchIndex } from '$lib/server/docs';
import {
	DOCUMENTED_VERSIONS,
	LATEST_DOCUMENTED_VERSION,
	resolveDocVersion
} from '$lib/server/versions';

export const load: LayoutServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const versions = registry.releases.map((release) => release.version);
	const latest = registry.latest;
	/* Palette docs entries live per documented line; any release maps onto one. */
	const activeVersion =
		(params.version !== undefined ? resolveDocVersion(params.version) : undefined) ??
		LATEST_DOCUMENTED_VERSION;
	return {
		versions,
		latest,
		/* Docs are versioned by line, engines by release. The switcher offers
		 * whichever domain the current route actually navigates in. */
		docLines: DOCUMENTED_VERSIONS,
		docSlugs: DOC_SLUGS_BY_LINE,
		registryLive: registry.live,
		paletteEntries: [
			{ title: 'Landing', hint: 'route', href: '/' },
			{ title: 'Playground', hint: `route · v${latest}`, href: `/playground/${latest}` },
			{ title: 'Simulation Lab', hint: `route · v${latest}`, href: `/simulations/${latest}` },
			{ title: 'Changelog', hint: 'route', href: '/changelog' },
			...docSearchIndex(activeVersion)
		]
	};
};
