import { json } from '@sveltejs/kit';
import { searchDocumentation } from '$lib/server/docs-registry';
import type { RequestHandler } from './$types';

const platformResults = Object.freeze([
	{
		title: 'Schemd home',
		summary: 'Compiler overview, installation, architecture, and verified measurements.',
		category: 'Platform',
		path: '/'
	},
	{
		title: 'Playground',
		summary: 'Edit source and compile a versioned diagram in an isolated worker.',
		category: 'Tool',
		path: '/playground/v0.2.1'
	},
	{
		title: 'Simulation laboratory',
		summary: 'Explore five deterministic engineering models.',
		category: 'Tool',
		path: '/simulations/v0.2.1'
	},
	{
		title: 'Implementation timeline',
		summary: 'Planned, active, blocked, and completed work.',
		category: 'Project',
		path: '/timeline'
	},
	{
		title: 'Changelog',
		summary: 'Published releases and verified package history.',
		category: 'Project',
		path: '/changelog'
	}
]);

export const GET: RequestHandler = ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });
	const query = (url.searchParams.get('q') ?? '').trim().slice(0, 80);
	if (query.length === 0) return json(platformResults.slice(0, 5));
	const words = query.toLocaleLowerCase().split(/\s+/u).filter(Boolean);
	const platform = platformResults.filter((result) => {
		const haystack = `${result.title} ${result.summary} ${result.category}`.toLocaleLowerCase();
		return words.every((word) => haystack.includes(word));
	});
	return json([...platform, ...searchDocumentation(query)].slice(0, 10));
};
