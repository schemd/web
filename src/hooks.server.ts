/**
 * Server hooks: legacy endpoint redirects and canonical version routing.
 *
 * The documentation once lived under `/tools/schemd/*` on the portfolio.
 * Those paths 308-redirect into the versioned information architecture so
 * previously indexed URLs keep resolving.
 */
import { redirect, type Handle } from '@sveltejs/kit';
import { getRegistry, HISTORICAL_CORE_VERSION } from '$lib/server/registry';

export function legacyTarget(pathname: string): string | undefined {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (normalized === '/tools/schemd') return '/';
	if (normalized === '/tools/schemd/docs') {
		return `/docs/${HISTORICAL_CORE_VERSION}/overview`;
	}
	if (normalized === '/tools/schemd/playground') {
		return `/playground/${HISTORICAL_CORE_VERSION}`;
	}
	if (normalized === '/tools/schemd/simulations') {
		return `/simulations/${HISTORICAL_CORE_VERSION}`;
	}
	const documentation = /^\/tools\/schemd\/docs\/([a-z0-9-]+)$/.exec(normalized);
	return documentation ? `/docs/${HISTORICAL_CORE_VERSION}/${documentation[1]}` : undefined;
}

/** Sections whose bare (unversioned) paths resolve to the latest release. */
const VERSIONED_SECTIONS = ['/docs', '/playground', '/simulations'] as const;

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;

	const legacy = legacyTarget(pathname);
	if (legacy !== undefined) redirect(308, `${legacy}${search}`);

	for (const section of VERSIONED_SECTIONS) {
		if (pathname === section || pathname === `${section}/`) {
			const registry = await getRegistry();
			const suffix = section === '/docs' ? '/overview' : '';
			redirect(307, `${section}/${registry.latest}${suffix}${search}`);
		}
	}

	return resolve(event);
};
