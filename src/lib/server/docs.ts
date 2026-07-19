/**
 * Documentation corpus loader.
 *
 * Markdown lives in `src/lib/content/docs`. Rendering — including compiling
 * every embedded `schemd` fence through `@schemd/core` — happens once per
 * process per page, then persists in an in-memory cache for the lifetime of
 * the `adapter-node` server.
 */
import { renderMarkdownDoc, type RenderedDoc } from './markdown';

/** Ordered navigation manifest for the left index tree. */
export interface DocPageMeta {
	readonly slug: string;
	readonly title: string;
	readonly summary: string;
	readonly group: 'Foundations' | 'The Language' | 'Compilation';
}

export const DOC_MANIFEST: readonly DocPageMeta[] = [
	{
		slug: 'overview',
		title: 'Overview',
		summary: 'What schemd is, how the compiler pipeline works, and a first schematic.',
		group: 'Foundations'
	},
	{
		slug: 'language',
		title: 'The schemd Language',
		summary: 'Fence grammar, declarations, comments, colors, and micro-math labels.',
		group: 'The Language'
	},
	{
		slug: 'components',
		title: 'Component Primitives',
		summary: 'Passives, analog devices, logic gates, quantum operators, and custom ICs.',
		group: 'The Language'
	},
	{
		slug: 'uml',
		title: 'UML Nodes & Relations',
		summary: 'Classes, actors, states, lifelines, and the ten relationship kinds.',
		group: 'The Language'
	},
	{
		slug: 'connections',
		title: 'Connections & Routing',
		summary: 'Ports, routing strategies, markers, and connection labels.',
		group: 'The Language'
	},
	{
		slug: 'output-modes',
		title: 'Output Modes & Theming',
		summary: 'default, embedded-css, and full — plus every CSS custom property hook.',
		group: 'Compilation'
	},
	{
		slug: 'limits',
		title: 'Limits & Security Model',
		summary: 'Hard compiler budgets and the immutable-AST provenance boundary.',
		group: 'Compilation'
	},
	{
		slug: 'api',
		title: 'API Reference',
		summary: 'Every stable export of @schemd/core, entry point by entry point.',
		group: 'Compilation'
	}
];

const sources = import.meta.glob<string>('$lib/content/docs/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

/** Process-lifetime render cache. */
const rendered = new Map<string, RenderedDoc>();

/** Load one documentation page by slug, rendering and caching on first hit. */
export function loadDoc(slug: string): RenderedDoc | undefined {
	const meta = DOC_MANIFEST.find((page) => page.slug === slug);
	if (!meta) return undefined;
	const cached = rendered.get(slug);
	if (cached) return cached;
	const entry = Object.entries(sources).find(([path]) => path.endsWith(`/${slug}.md`));
	if (!entry) return undefined;
	const doc = renderMarkdownDoc(entry[1], slug);
	rendered.set(slug, doc);
	return doc;
}

/** Flat palette/search index across the whole corpus. */
export function docSearchIndex(
	version: string
): readonly { title: string; hint: string; href: string }[] {
	return DOC_MANIFEST.flatMap((page) => {
		const doc = loadDoc(page.slug);
		const base = `/docs/${version}/${page.slug}`;
		const root = { title: page.title, hint: 'docs', href: base };
		const children =
			doc?.sections.map((section) => ({
				title: section.title,
				hint: `docs · ${page.title}`,
				href: `${base}#${section.id}`
			})) ?? [];
		return [root, ...children];
	});
}
