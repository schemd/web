import { redirect } from '@sveltejs/kit';
import { getVersion, LATEST_VERSION, versionContextPath } from '$lib/versioning/manifest';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) => {
	const version = getVersion(url.searchParams.get('version') ?? '') ?? LATEST_VERSION;
	const from = url.searchParams.get('from') ?? '/';
	redirect(303, versionContextPath(from, version.id));
};
