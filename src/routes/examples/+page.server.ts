import type { PageServerLoad } from './$types';
import { loadGallery } from '$lib/server/gallery';
import { getRegistry } from '$lib/server/registry';

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	return { items: loadGallery(), latest: registry.latest };
};
