import type { PageServerLoad } from './$types';
import { languageCoverage } from '#lib/server/coverage.ts';
import { getRegistry } from '#lib/server/registry.ts';

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	return { coverage: languageCoverage(), latest: registry.latest };
};
