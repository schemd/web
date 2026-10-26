import { messagesFor } from '#lib/server/message-catalog.ts';
import { localeOf } from '#lib/i18n/index.ts';
import type { LayoutServerLoad } from './$types';
import { getRegistry } from '#lib/server/registry.ts';
import { DOC_SLUGS_BY_LINE, docSearchIndex } from '#lib/server/docs.ts';
import {
	DOCUMENTED_VERSIONS,
	LATEST_DOCUMENTED_VERSION,
	resolveDocVersion
} from '#lib/server/versions.ts';

export const load: LayoutServerLoad = async ({ params, url }) => {
	const locale = localeOf(url.pathname);
	const registry = await getRegistry();
	const versions = registry.releases.map((release) => release.version);
	const latest = registry.latest;
	/* Palette docs entries live per documented line; any release maps onto one. */
	const activeVersion =
		(params.version !== undefined ? resolveDocVersion(params.version) : undefined) ??
		LATEST_DOCUMENTED_VERSION;
	return {
		locale,
		messages: messagesFor(url.pathname, locale),
		versions,
		latest,
		/* The header band prints the revision's date, as a datasheet does. */
		latestPublishedAt: registry.releases.find((release) => release.version === latest)?.publishedAt,
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
			{ title: 'Install telemetry', hint: 'route · live npm', href: '/downloads' },
			...docSearchIndex(activeVersion, locale)
		]
	};
};
