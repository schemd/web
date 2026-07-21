/**
 * Server hooks: legacy endpoint redirects and canonical version routing.
 *
 * The documentation once lived under `/tools/schemd/*` on the portfolio.
 * Those paths 308-redirect into the versioned information architecture so
 * previously indexed URLs keep resolving.
 */
import { redirect, type Handle } from '@sveltejs/kit';
import { getRegistry, HISTORICAL_CORE_VERSION } from '$lib/server/registry';
import {
	isDocumentedVersion,
	LATEST_DOCUMENTED_VERSION,
	OLDEST_DOCUMENTED_VERSION,
	resolveDocVersion
} from '$lib/server/versions';

export function legacyTarget(pathname: string): string | undefined {
	const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	if (normalized === '/tools/schemd') return '/';
	if (normalized === '/tools/schemd/docs') {
		return `/docs/${OLDEST_DOCUMENTED_VERSION}/overview`;
	}
	if (normalized === '/tools/schemd/playground') {
		return `/playground/${HISTORICAL_CORE_VERSION}`;
	}
	if (normalized === '/tools/schemd/simulations') {
		return `/simulations/${HISTORICAL_CORE_VERSION}`;
	}
	const documentation = /^\/tools\/schemd\/docs\/([a-z0-9-]+)$/.exec(normalized);
	return documentation ? `/docs/${OLDEST_DOCUMENTED_VERSION}/${documentation[1]}` : undefined;
}

/**
 * Canonicalize any versioned docs path onto its documented line: patch
 * releases, undocumented npm releases, and `latest` all 308 to the line that
 * serves them, with the slug tail and query preserved. Documented-line paths
 * and non-version parameters pass through untouched.
 */
export function canonicalDocsTarget(pathname: string): string | undefined {
	const match = /^\/docs\/([^/]+)(\/.*)?$/.exec(pathname);
	if (match === null) return undefined;
	const requested = match[1]!;
	if (isDocumentedVersion(requested)) return undefined;
	const line = resolveDocVersion(requested);
	return line === undefined ? undefined : `/docs/${line}${match[2] ?? ''}`;
}

/** Sections whose bare (unversioned) paths resolve to the latest release. */
const VERSIONED_SECTIONS = ['/docs', '/playground', '/simulations'] as const;

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;

	const legacy = legacyTarget(pathname);
	if (legacy !== undefined) redirect(308, `${legacy}${search}`);

	const canonical = canonicalDocsTarget(pathname);
	if (canonical !== undefined) redirect(308, `${canonical}${search}`);

	for (const section of VERSIONED_SECTIONS) {
		if (pathname === section || pathname === `${section}/`) {
			/* Docs follow the latest documented folder; playground and simulations
			 * follow the newest published release the running engine can execute. */
			if (section === '/docs') {
				redirect(307, `/docs/${LATEST_DOCUMENTED_VERSION}/overview${search}`);
			}
			const registry = await getRegistry();
			redirect(307, `${section}/${registry.latest}${search}`);
		}
	}

	return resolve(event);
};
