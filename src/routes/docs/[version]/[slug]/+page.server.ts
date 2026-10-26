import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { localeOf } from '#lib/i18n/index.ts';
import { docManifest, loadDoc, SPANISH_DOC_VERSIONS } from '#lib/server/docs.ts';
import { getRegistry } from '#lib/server/registry.ts';
import { resolveDocVersion } from '#lib/server/versions.ts';

export const load: PageServerLoad = async ({ params, url }) => {
	const locale = localeOf(url.pathname);
	const registry = await getRegistry();
	const version = resolveDocVersion(params.version);
	if (version === undefined) {
		error(404, `No documentation release named ${params.version}.`);
	}
	if (params.version === 'latest') {
		redirect(307, `/docs/${version}/${params.slug}`);
	}
	const manifest = docManifest(version, locale);
	const meta = manifest.find((page) => page.slug === params.slug);
	const doc = loadDoc(version, params.slug, locale);
	if (!meta || !doc) error(404, `No documentation page named ${params.slug}.`);
	return {
		version,
		contentLocale: locale === 'es' && SPANISH_DOC_VERSIONS.includes(version) ? 'es' : 'en',
		latest: registry.latest,
		meta,
		manifest,
		doc
	};
};
