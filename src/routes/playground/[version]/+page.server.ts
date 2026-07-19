import { error } from '@sveltejs/kit';
import { DEFAULT_SCHEMATIC_SOURCE, resolveVersion } from '$lib/platform';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	const version = resolveVersion(params.version);
	if (!version) error(404, 'Unknown schemd version');

	return {
		version: version.id,
		initialSource: DEFAULT_SCHEMATIC_SOURCE,
		initialCode: url.searchParams.get('code') ?? undefined
	};
};
