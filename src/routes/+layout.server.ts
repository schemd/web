import type { LayoutServerLoad } from './$types';
import { getRegistry } from '$lib/server/registry';
import { docSearchIndex } from '$lib/server/docs';

export const load: LayoutServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const versions = registry.releases.map((release) => release.version);
	const latest = registry.latest;
	const requestedVersion = params.version;
	const activeVersion =
		requestedVersion !== undefined &&
		registry.releases.some((release) => release.version === requestedVersion)
			? requestedVersion
			: latest;
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
