import { redirect } from '@sveltejs/kit';
import { getVersion, LATEST_VERSION } from '$lib/versioning/manifest';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const version = getVersion(url.searchParams.get('version') ?? '') ?? LATEST_VERSION;
	redirect(303, version.simulationsPath);
};
