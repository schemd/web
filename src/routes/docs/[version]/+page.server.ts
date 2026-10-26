import { localized, localeOf } from '#lib/i18n/index.ts';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, url }) => {
	redirect(307, localized(`/docs/${params.version}/overview`, localeOf(url.pathname)));
};
