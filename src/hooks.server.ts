/**
 * Server hooks: legacy endpoint redirects and canonical version routing.
 *
 * The documentation once lived under `/tools/schemd/*` on the portfolio.
 * Those paths 308-redirect into the versioned information architecture so
 * previously indexed URLs keep resolving.
 */
import { redirect } from '@sveltejs/kit';
import { localeOf, localized, unlocalized } from '#lib/i18n/index.ts';
import type { Handle } from '@sveltejs/kit/hooks';
import { getRegistry, HISTORICAL_CORE_VERSION } from '#lib/server/registry.ts';
import {
	isDocumentedVersion,
	LATEST_DOCUMENTED_VERSION,
	OLDEST_DOCUMENTED_VERSION,
	resolveDocVersion
} from '#lib/server/versions.ts';

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

/** Apply headers that are safe for both the website and cross-origin SVG embeds. */
export function applySecurityHeaders(response: Response, secure: boolean): Response {
	response.headers.set('x-content-type-options', 'nosniff');
	/* Playground source is intentionally encoded in the query string. Sending a
	 * full same-origin Referer would copy that source into API/access logs. */
	response.headers.set('referrer-policy', 'origin');
	response.headers.set(
		'permissions-policy',
		'camera=(), geolocation=(), microphone=(), payment=(), usb=()'
	);
	response.headers.set('cross-origin-opener-policy', 'same-origin');
	response.headers.set('origin-agent-cluster', '?1');
	if (secure)
		response.headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');
	return response;
}

/** Sections whose bare (unversioned) paths resolve to the latest release. */
const VERSIONED_SECTIONS = ['/docs', '/playground', '/simulations'] as const;

export const handle: Handle = async ({ event, resolve }) => {
	const { search } = event.url;
	const locale = localeOf(event.url.pathname);
	const pathname = unlocalized(event.url.pathname);
	if (event.url.pathname === '/' && event.cookies.get('schemd-language') === 'es')
		redirect(307, `/es${search}`);

	const legacy = legacyTarget(pathname);
	if (legacy !== undefined) redirect(308, `${localized(legacy, locale)}${search}`);

	const canonical = canonicalDocsTarget(pathname);
	if (canonical !== undefined) redirect(308, `${localized(canonical, locale)}${search}`);

	for (const section of VERSIONED_SECTIONS) {
		if (pathname === section || pathname === `${section}/`) {
			/* Docs follow the latest documented folder; playground and simulations
			 * follow the newest published release the running engine can execute. */
			if (section === '/docs') {
				redirect(
					307,
					`${localized(`/docs/${LATEST_DOCUMENTED_VERSION}/overview`, locale)}${search}`
				);
			}
			const registry = await getRegistry();
			redirect(307, `${localized(`${section}/${registry.latest}`, locale)}${search}`);
		}
	}

	const response = await resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%schemd.lang%', locale)
	});
	response.headers.set('content-language', locale);
	if (event.url.pathname === '/') response.headers.append('vary', 'Cookie');
	return applySecurityHeaders(response, event.url.protocol === 'https:');
};
