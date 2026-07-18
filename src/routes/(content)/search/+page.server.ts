import { searchDocumentation } from '$lib/server/docs-registry';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	return { query, results: searchDocumentation(query) };
};
