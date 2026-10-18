import type { PageServerLoad } from './$types';
import { loadGallery } from '#lib/server/gallery.ts';
import { getRegistry } from '#lib/server/registry.ts';

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	return { items: loadGallery(), latest: registry.latest };
};
