import { localeOf } from '#lib/i18n/index.ts';
import type { PageServerLoad } from './$types';
import { getRegistry } from '#lib/server/registry.ts';
import { templateGallery } from '#lib/server/templates.ts';

export const load: PageServerLoad = async ({ url }) => {
	const registry = await getRegistry();
	return {
		templates: templateGallery(registry.latest, localeOf(url.pathname)),
		latest: registry.latest
	};
};
