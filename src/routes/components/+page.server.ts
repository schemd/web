import type { PageServerLoad } from './$types';
import { componentIndex, FAMILY_LABEL, FAMILY_ORDER } from '#lib/server/components.ts';

export const load: PageServerLoad = () => {
	const index = componentIndex();
	return {
		families: FAMILY_ORDER.map((family) => ({
			family,
			label: FAMILY_LABEL[family],
			kinds: index.filter((entry) => entry.family === family)
		})),
		total: index.length
	};
};
