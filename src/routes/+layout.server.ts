import type { LayoutServerLoad } from './$types';
import { getRegistry } from '$lib/server/registry';
import { docSearchIndex } from '$lib/server/docs';
import { LATEST_DOCUMENTED_VERSION, resolveDocVersion } from '$lib/server/versions';

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
