import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { DOC_MANIFEST, loadDoc } from '$lib/server/docs';
import { getRegistry, resolveVersion } from '$lib/server/registry';

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined) {
		redirect(307, `/docs/${registry.latest}/${params.slug}`);
	}
	if (params.version === 'latest') {
		redirect(307, `/docs/${version}/${params.slug}`);
	}
	const meta = DOC_MANIFEST.find((page) => page.slug === params.slug);
	const doc = loadDoc(params.slug);
	if (!meta || !doc) error(404, `No documentation page named ${params.slug}.`);
	return {
		version,
		latest: registry.latest,
		meta,
		manifest: DOC_MANIFEST,
		doc
	};
};
