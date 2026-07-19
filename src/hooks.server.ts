/**
 * Server hooks: legacy endpoint redirects and canonical version routing.
 *
 * The documentation once lived under `/tools/schemd/*` on the portfolio.
 * Those paths 308-redirect into the versioned information architecture so
 * previously indexed URLs keep resolving.
 */
import { redirect, type Handle } from '@sveltejs/kit';
import { getRegistry } from '$lib/server/registry';

/** Static legacy → canonical path prefixes. */
const LEGACY_PREFIXES: ReadonlyArray<readonly [string, string]> = [
	['/tools/schemd/docs', '/docs'],
	['/tools/schemd/playground', '/playground'],
	['/tools/schemd', '/']
];

/** Sections whose bare (unversioned) paths resolve to the latest release. */
const VERSIONED_SECTIONS = ['/docs', '/playground', '/simulate'] as const;

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;

	for (const [legacy, canonical] of LEGACY_PREFIXES) {
		if (pathname === legacy || pathname.startsWith(`${legacy}/`)) {
			redirect(308, `${canonical}${pathname.slice(legacy.length)}${search}` || '/');
		}
	}

	for (const section of VERSIONED_SECTIONS) {
		if (pathname === section || pathname === `${section}/`) {
			const registry = await getRegistry();
			const suffix = section === '/docs' ? '/overview' : '';
			redirect(307, `${section}/${registry.latest}${suffix}${search}`);
		}
	}

	return resolve(event);
};
