/**
 * Documentation corpus loader.
 *
 * Markdown lives in `src/lib/content/schemd` and is authored with
 * `schemd-doc`/`schemd-section` directives (see {@link renderMarkdownDoc}).
 * The manifest is derived from each file's `schemd-doc` header — ordered by its
 * `order`, grouped by its `category` — and rendered output (including every
 * compiled `schemd` fence) is cached for the lifetime of the `adapter-node`
 * server.
 */
import { renderMarkdownDoc, parseDocFrontmatter, type RenderedDoc } from './markdown';

/** Ordered navigation manifest for the left index tree. */
export interface DocPageMeta {
	readonly slug: string;
	/** Long title for the page header and SEO. */
	readonly title: string;
	/** Short label for the navigation tree. */
	readonly label: string;
	readonly summary: string;
	readonly group: string;
}

/** Raw sources; the tone references are voice guides, not documentation. */
const sources = import.meta.glob<string>('$lib/content/schemd/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

function slugFromPath(path: string): string {
	return path.split('/').pop()!.replace(/\.md$/, '');
}

const EXCLUDED = new Set(['tone1', 'tone2']);

/** Raw markdown keyed by slug, and the ordered manifest — built once. */
const { rawBySlug, manifest } = ((): {
	rawBySlug: Map<string, string>;
	manifest: readonly DocPageMeta[];
} => {
	const rawBySlug = new Map<string, string>();
	const entries: { meta: DocPageMeta; order: number }[] = [];
	for (const [path, raw] of Object.entries(sources)) {
		const slug = slugFromPath(path);
		if (EXCLUDED.has(slug)) continue;
		const front = parseDocFrontmatter(raw, slug);
		if (!front) continue;
		rawBySlug.set(front.slug, raw);
		entries.push({
			order: front.order,
			meta: {
				slug: front.slug,
				title: front.title,
				label: front.label,
				summary: front.summary,
				group: front.group
			}
		});
	}
	entries.sort((a, b) => a.order - b.order);
	return { rawBySlug, manifest: entries.map((entry) => entry.meta) };
})();

export const DOC_MANIFEST: readonly DocPageMeta[] = manifest;

/** Process-lifetime render cache. */
const rendered = new Map<string, RenderedDoc>();

/** Load one documentation page by slug, rendering and caching on first hit. */
export function loadDoc(slug: string): RenderedDoc | undefined {
	const cached = rendered.get(slug);
	if (cached) return cached;
	const raw = rawBySlug.get(slug);
	if (!raw) return undefined;
	const doc = renderMarkdownDoc(raw, slug);
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
		const root = { title: page.label, hint: 'docs', href: base };
		const children =
			doc?.sections.map((section) => ({
				title: section.title,
				hint: `docs · ${page.label}`,
				href: `${base}#${section.id}`
			})) ?? [];
		return [root, ...children];
	});
}
