import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { componentIndex, componentSheet } from '#lib/server/components.ts';
import { getRegistry } from '#lib/server/registry.ts';

export const load: PageServerLoad = async ({ params }) => {
	const sheet = componentSheet(params.kind);
	if (sheet === undefined) error(404, `schemd has no component kind called ${params.kind}.`);
	const index = componentIndex();
	const position = index.findIndex((entry) => entry.kind === params.kind);
	return {
		sheet,
		latest: (await getRegistry()).latest,
		previous: index[position - 1]?.kind,
		next: index[position + 1]?.kind
	};
};
