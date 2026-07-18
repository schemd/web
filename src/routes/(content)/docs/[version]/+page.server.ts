import { error, redirect } from '@sveltejs/kit';
import { getVersion } from '$lib/versioning/manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const version = getVersion(params.version);
	if (!version) error(404, `Documentation version ${params.version} is not available.`);
	redirect(308, `/docs/${version.id}/overview`);
};
