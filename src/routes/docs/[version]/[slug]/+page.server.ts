import { error } from '@sveltejs/kit';
import { VERSIONS, resolveVersion } from '$lib/platform';
import { getDocumentationNavigation, getDocumentationPage } from '$lib/server/documentation';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params, setHeaders }) => {
	const version = resolveVersion(params.version);
	if (version === undefined) error(404, `Documentation version ${params.version} is unavailable.`);
	const page = getDocumentationPage(version.id, params.slug);
	if (page === undefined) error(404, `Documentation page ${params.slug} does not exist.`);
	const navigation = getDocumentationNavigation(version.id);
	const currentIndex = navigation.findIndex((entry) => entry.slug === page.slug);
	setHeaders({
		'cache-control': 'public, max-age=300, stale-while-revalidate=3600',
		'x-content-type-options': 'nosniff'
	});
	return {
		version: version.id,
		versions: VERSIONS,
		page,
		navigation,
		previous: currentIndex > 0 ? (navigation[currentIndex - 1] ?? null) : null,
		next:
			currentIndex >= 0 && currentIndex < navigation.length - 1
				? (navigation[currentIndex + 1] ?? null)
				: null
	};
};
