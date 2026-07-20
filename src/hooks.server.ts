/**
 * Server hooks: legacy endpoint redirects and canonical version routing.
 *
 * The documentation once lived under `/tools/schemd/*` on the portfolio.
 * Those paths 308-redirect into the versioned information architecture so
 * previously indexed URLs keep resolving.
 */
import { redirect, type Handle } from '@sveltejs/kit';
import {
	getRegistry,
	HISTORICAL_CORE_VERSION,
	SUPERSEDED_PATCH_VERSIONS
} from '$lib/server/registry';

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

/** Map a superseded patch-release docs path onto the current corpus, verbatim tail preserved. */
export function supersededDocsTarget(pathname: string): string | undefined {
	const match = /^\/docs\/([0-9.]+)(\/.*)?$/.exec(pathname);
	const current = match === null ? undefined : SUPERSEDED_PATCH_VERSIONS[match[1]!];
	return current === undefined ? undefined : `/docs/${current}${match![2] ?? ''}`;
}

/** Sections whose bare (unversioned) paths resolve to the latest release. */
const VERSIONED_SECTIONS = ['/docs', '/playground', '/simulations'] as const;

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;

	const legacy = legacyTarget(pathname);
	if (legacy !== undefined) redirect(308, `${legacy}${search}`);

	const superseded = supersededDocsTarget(pathname);
	if (superseded !== undefined) redirect(308, `${superseded}${search}`);

	for (const section of VERSIONED_SECTIONS) {
		if (pathname === section || pathname === `${section}/`) {
			const registry = await getRegistry();
			const suffix = section === '/docs' ? '/overview' : '';
			redirect(307, `${section}/${registry.latest}${suffix}${search}`);
		}
	}

	return resolve(event);
};
