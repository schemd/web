import { redirect } from '@sveltejs/kit';
import { CURRENT_VERSION } from '$lib/platform';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
	redirect(308, `/docs/${CURRENT_VERSION}/overview`);
};
