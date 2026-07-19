import type { PageServerLoad } from './$types';
import { languageCoverage } from '$lib/server/coverage';
import { getRegistry } from '$lib/server/registry';

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	return { coverage: languageCoverage(), latest: registry.latest };
};
