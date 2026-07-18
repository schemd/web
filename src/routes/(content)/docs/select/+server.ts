import { redirect } from '@sveltejs/kit';
import { getDocumentationAst } from '$lib/server/docs-registry';
import { getVersion } from '$lib/versioning/manifest';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const versionValue = url.searchParams.get('version') ?? '';
	const pageValue = url.searchParams.get('page') ?? 'overview';
	const version = getVersion(versionValue);
	if (!version) redirect(303, '/docs/latest');
	const page = getDocumentationAst(version.id, pageValue) ? pageValue : 'overview';
	redirect(303, `/docs/${version.id}/${page}`);
};
