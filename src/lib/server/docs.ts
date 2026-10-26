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
import {
	renderMarkdownDoc,
	parseDocFrontmatter,
	scanDocSections,
	type DocSection,
	type RenderedDoc
} from './markdown';
import { localized, type Locale } from '#lib/i18n/index.ts';
import { DOCUMENTED_VERSIONS, LATEST_DOCUMENTED_VERSION, versionedRawSources } from './versions';

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

function slugFromPath(path: string): string {
	return path.split('/').pop()!.replace(/\.md$/, '');
}

const EXCLUDED = new Set(['tone1', 'tone2']);

/** Raw markdown keyed by slug, and the ordered manifest — built once per version. */
interface DocCorpus {
	readonly rawBySlug: ReadonlyMap<string, string>;
	readonly sectionsBySlug: ReadonlyMap<string, readonly DocSection[]>;
	readonly manifest: readonly DocPageMeta[];
}

function buildCorpus(sources: Readonly<Record<string, string>>): DocCorpus {
	const rawBySlug = new Map<string, string>();
	const sectionsBySlug = new Map<string, readonly DocSection[]>();
	const entries: { meta: DocPageMeta; order: number }[] = [];
	for (const [path, raw] of Object.entries(sources)) {
		const slug = slugFromPath(path);
		if (EXCLUDED.has(slug)) continue;
		const front = parseDocFrontmatter(raw, slug);
		if (!front) continue;
		rawBySlug.set(front.slug, raw);
		sectionsBySlug.set(front.slug, scanDocSections(raw));
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
	return { rawBySlug, sectionsBySlug, manifest: entries.map((entry) => entry.meta) };
}

/** One corpus per discovered version, built once at module load. */
const CORPORA = new Map<string, DocCorpus>(
	DOCUMENTED_VERSIONS.map((version) => [version, buildCorpus(versionedRawSources(version)!)])
);

const spanishSources = import.meta.glob<string>('/src/lib/content/schemd/es/*/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});
const SPANISH_CORPORA = new Map<string, DocCorpus>();
for (const version of ['1.2', '1.3']) {
	const sources = Object.fromEntries(
		Object.entries(spanishSources).filter(([path]) => path.includes(`/es/${version}/`))
	);
	if (Object.keys(sources).length) SPANISH_CORPORA.set(version, buildCorpus(sources));
}
export const SPANISH_DOC_VERSIONS = [...SPANISH_CORPORA.keys()];
function corpusFor(version: string, locale: Locale = 'en'): DocCorpus | undefined {
	return (locale === 'es' ? SPANISH_CORPORA.get(version) : undefined) ?? CORPORA.get(version);
}

export function docManifest(version: string, locale: Locale = 'en'): readonly DocPageMeta[] {
	return corpusFor(version, locale)?.manifest ?? [];
}

/**
 * Every documented line mapped to the slugs it actually publishes.
 *
 * The version switcher needs this on the client: lines do not carry identical
 * corpora (0.4 documents `netlist` and `limits`; 0.2 never did), so switching
 * lines has to keep the reader's page when the target line has it and land on
 * the overview when it does not, instead of navigating into a 404.
 */
export const DOC_SLUGS_BY_LINE: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
	DOCUMENTED_VERSIONS.map((version) => [version, docManifest(version).map((page) => page.slug)])
);

/** Latest manifest retained for sitemap and build-time callers. */
export const DOC_MANIFEST: readonly DocPageMeta[] = docManifest(LATEST_DOCUMENTED_VERSION);

/* Compile-time invariant: a release must never silently ship an empty corpus. */
if (DOC_MANIFEST.length === 0) {
	throw new Error(`No documentation corpus found for ${LATEST_DOCUMENTED_VERSION}.`);
}

/* Previous implementation built one global corpus. Keep the cache version-keyed. */
const rendered = new Map<string, RenderedDoc>();

/** Load one versioned documentation page, rendering and caching on first hit. */
export function loadDoc(
	version: string,
	slug: string,
	locale: Locale = 'en'
): RenderedDoc | undefined {
	const key = `${locale}\0${version}\0${slug}`;
	const cached = rendered.get(key);
	if (cached) return cached;
	const raw = corpusFor(version, locale)?.rawBySlug.get(slug);
	if (!raw) return undefined;
	let doc = renderMarkdownDoc(raw, `${version}-${slug}`);
	if (locale === 'es')
		doc = {
			...doc,
			html: doc.html
				.replace(
					/href="(\/(?:docs|playground|components|simulations|inspector|changelog|templates|examples)[^"]*)"/g,
					(_, path: string) => `href="${localized(path, locale)}"`
				)
				.replace(/aria-label="Scrollable ([^"]*)"/g, 'aria-label="Código desplazable: $1"')
		};
	rendered.set(key, doc);
	return doc;
}

/** Flat palette/search index across one historically accurate corpus. */
export function docSearchIndex(
	version: string,
	locale: Locale = 'en'
): readonly { title: string; hint: string; href: string }[] {
	const corpus = corpusFor(version, locale);
	return docManifest(version, locale).flatMap((page) => {
		const base = `/docs/${version}/${page.slug}`;
		const root = { title: page.label, hint: `docs · v${version}`, href: base };
		const children =
			corpus?.sectionsBySlug.get(page.slug)?.map((section) => ({
				title: section.title,
				hint: `docs · v${version} · ${page.label}`,
				href: `${base}#${section.id}`
			})) ?? [];
		return [root, ...children];
	});
}
