import { error } from '@sveltejs/kit';
import {
	getDocumentationAst,
	getDocumentationNavigation,
	renderDocumentationPage
} from '$lib/server/docs-registry';
import { getVersion, VERSIONS } from '$lib/versioning/manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const version = getVersion(params.version);
	if (!version) error(404, `Documentation version ${params.version} is not available.`);
	const ast = getDocumentationAst(version.id, params.slug);
	const rendered = renderDocumentationPage(version.id, params.slug);
	if (!ast || !rendered) error(404, `Documentation page ${params.slug} was not found.`);
	const navigation = getDocumentationNavigation(version.id);
	const pages = navigation.flatMap((group) => group.pages);
	const currentIndex = pages.findIndex((page) => page.id === params.slug);

	return {
		version,
		versions: VERSIONS,
		metadata: ast.metadata,
		html: rendered.html,
		toc: rendered.toc,
		navigation,
		previous: currentIndex > 0 ? pages[currentIndex - 1] : undefined,
		next: currentIndex >= 0 && currentIndex < pages.length - 1 ? pages[currentIndex + 1] : undefined
	};
};
