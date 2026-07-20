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
import { WEBSITE_CORE_VERSION } from './registry';

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
const historicalSources = import.meta.glob<string>('$lib/content/schemd/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

const currentSources = import.meta.glob<string>('$lib/content/schemd/0.3.0/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

function slugFromPath(path: string): string {
	return path.split('/').pop()!.replace(/\.md$/, '');
}

const EXCLUDED = new Set(['tone1', 'tone2']);

/** Raw markdown keyed by slug, and the ordered manifest — built once. */
interface DocCorpus {
	readonly rawBySlug: ReadonlyMap<string, string>;
	readonly manifest: readonly DocPageMeta[];
}

function buildCorpus(sources: Readonly<Record<string, string>>): DocCorpus {
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
}

const historicalCorpus = buildCorpus(historicalSources);
const currentCorpus = buildCorpus(currentSources);

function corpusFor(version: string): DocCorpus {
	return version === WEBSITE_CORE_VERSION ? currentCorpus : historicalCorpus;
}

export function docManifest(version: string): readonly DocPageMeta[] {
	return corpusFor(version).manifest;
}

/** Current manifest retained for sitemap and build-time callers. */
export const DOC_MANIFEST: readonly DocPageMeta[] = currentCorpus.manifest;

/* Compile-time invariant: a release must never silently ship an empty corpus. */
if (DOC_MANIFEST.length === 0) {
	throw new Error(`No documentation corpus found for ${WEBSITE_CORE_VERSION}.`);
}

/* Previous implementation built one global corpus. Keep the cache version-keyed. */
const rendered = new Map<string, RenderedDoc>();

/** Load one versioned documentation page, rendering and caching on first hit. */
export function loadDoc(version: string, slug: string): RenderedDoc | undefined {
	const key = `${version}\0${slug}`;
	const cached = rendered.get(key);
	if (cached) return cached;
	const raw = corpusFor(version).rawBySlug.get(slug);
	if (!raw) return undefined;
	const doc = renderMarkdownDoc(raw, `${version}-${slug}`);
	rendered.set(key, doc);
	return doc;
}

/** Flat palette/search index across one historically accurate corpus. */
export function docSearchIndex(
	version: string
): readonly { title: string; hint: string; href: string }[] {
	return docManifest(version).flatMap((page) => {
		const doc = loadDoc(version, page.slug);
		const base = `/docs/${version}/${page.slug}`;
		const root = { title: page.label, hint: `docs · v${version}`, href: base };
		const children =
			doc?.sections.map((section) => ({
				title: section.title,
				hint: `docs · v${version} · ${page.label}`,
				href: `${base}#${section.id}`
			})) ?? [];
		return [root, ...children];
	});
}
