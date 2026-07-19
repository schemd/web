import { json } from '@sveltejs/kit';
import { PLATFORM_SEARCH_ENTRIES } from '$lib/platform';
import { searchDocumentation, type DocumentationSearchResult } from '$lib/server/documentation';
import type { RequestHandler } from './$types';

function platformMatches(query: string): readonly DocumentationSearchResult[] {
	const tokens = query
		.toLocaleLowerCase('en-US')
		.split(/\s+/u)
		.filter((token) => token.length > 0)
		.slice(0, 8);
	return PLATFORM_SEARCH_ENTRIES.filter((entry) => {
		if (tokens.length === 0) return true;
		const text =
			`${entry.title} ${entry.summary} ${entry.category} ${entry.keywords.join(' ')}`.toLocaleLowerCase(
				'en-US'
			);
		return tokens.every((token) => text.includes(token));
	}).map((entry) => ({
		id: entry.id,
		title: entry.title,
		summary: entry.summary,
		category: entry.category,
		path: entry.path
	}));
}

export const GET: RequestHandler = ({ url, setHeaders }) => {
	setHeaders({
		'cache-control': 'public, max-age=60, stale-while-revalidate=300',
		'x-content-type-options': 'nosniff'
	});
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	const results = [...platformMatches(query), ...searchDocumentation(query)].slice(0, 14);
	return json(results);
};
