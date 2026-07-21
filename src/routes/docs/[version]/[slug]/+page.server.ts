import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { docManifest, loadDoc } from '$lib/server/docs';
import { getRegistry } from '$lib/server/registry';
import { resolveDocVersion } from '$lib/server/versions';

export const load: PageServerLoad = async ({ params }) => {
	const registry = await getRegistry();
	const version = resolveDocVersion(params.version);
	if (version === undefined) {
		error(404, `No documentation release named ${params.version}.`);
	}
	if (params.version === 'latest') {
		redirect(307, `/docs/${version}/${params.slug}`);
	}
	const manifest = docManifest(version);
	const meta = manifest.find((page) => page.slug === params.slug);
	const doc = loadDoc(version, params.slug);
	if (!meta || !doc) error(404, `No documentation page named ${params.slug}.`);
	return {
		version,
		latest: registry.latest,
		meta,
		manifest,
		doc
	};
};
