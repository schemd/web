import { CURRENT_VERSION, PACKAGE_NAME, SITE_NAME, SITE_ORIGIN, VERSIONS } from '$lib/platform';
import { getReleaseRegistry } from '$lib/server/release-registry';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ fetch }) => {
	const release = await getReleaseRegistry(fetch);
	return {
		platform: {
			siteName: SITE_NAME,
			siteOrigin: SITE_ORIGIN,
			packageName: PACKAGE_NAME,
			currentVersion: CURRENT_VERSION
		},
		versions: VERSIONS,
		release,
		releases: release.releases
	};
};
