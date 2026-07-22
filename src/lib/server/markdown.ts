/**
 * Documentation Markdown pipeline for the `content/schemd` corpus.
 *
 * The corpus is authored with HTML-comment directives rather than `##`
 * headings: a `schemd-doc` header carries page metadata, and each
 * `schemd-section … /schemd-section` block is one scroll-synced unit with an
 * anchored `h2`, prose (rendered by `marked` + KaTeX), and an optional
 * ` ```schemd ` fence that is compiled by the real `@schemd/core` and surfaced
 * in the right rail. Every vector on the docs site is engine output.
 */
import { Marked } from 'marked';
import { compileSchematic, parseSchematicFence, SchematicSyntaxError } from '@schemd/core';
import { highlightSourceHtml } from '$lib/tokenizer';
import mathExtension from './math-extension';

/** One `h2` navigation section extracted while rendering. */
export interface DocSection {
	readonly id: string;
	readonly title: string;
}

/** One compiled `schemd` fence, keyed to the section that contains it. */
export interface DocExample {
	readonly id: string;
	readonly sectionId: string;
	readonly title: string;
	readonly source: string;
	readonly sourceHtml: string;
	readonly svg: string;
}

/** Page-level metadata parsed from the `schemd-doc` directive. */
export interface DocFrontmatter {
	readonly slug: string;
	readonly title: string;
	readonly label: string;
	readonly summary: string;
	readonly group: string;
	readonly order: number;
}

/** Fully rendered document ready for the three-column shell. */
export interface RenderedDoc {
	readonly html: string;
	readonly sections: readonly DocSection[];
	readonly examples: readonly DocExample[];
}

const ESCAPES: Record<string, string> = {
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;'
};

function escapeHtml(value: string): string {
	return value.replace(/[&<>"]/g, (char) => ESCAPES[char] ?? char);
}

/** Marked instance: GFM + KaTeX, with non-schemd code blocks themed inline. */
const marked = new Marked({ gfm: true });
marked.use(mathExtension());
marked.use({
	renderer: {
		code({ text, lang }) {
			const attr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
			const label = lang ? `Scrollable ${escapeHtml(lang)} code` : 'Scrollable code block';
			return `<pre class="codeblock" tabindex="0" role="region" aria-label="${label}"${attr}><code>${escapeHtml(text)}</code></pre>`;
		}
	}
});

const DOC_META = /<!--\s*schemd-doc:\s*([\s\S]*?)-->/;
const SECTION = /<!--\s*schemd-section:\s*([\s\S]*?)-->([\s\S]*?)<!--\s*\/schemd-section\s*-->/g;
const SCHEMD_FENCE = /```(schemd[^\n]*)\n([\s\S]*?)\n```/g;

/** Parse a `k=v; k=v` directive body into a lookup. */
function parseAttrs(raw: string): Record<string, string> {
	const attrs: Record<string, string> = {};
	for (const part of raw.split(';')) {
		const eq = part.indexOf('=');
		if (eq === -1) continue;
		const key = part.slice(0, eq).trim();
		if (key) attrs[key] = part.slice(eq + 1).trim();
	}
	return attrs;
}

/**
 * Read section navigation metadata without rendering Markdown or compiling any
 * schematic fences. Global navigation calls this on every cold process; using
 * the full renderer there would eagerly compile the entire documentation
 * corpus before an unrelated landing-page request could complete.
 */
export function scanDocSections(source: string): readonly DocSection[] {
	const sections: DocSection[] = [];
	SECTION.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = SECTION.exec(source)) !== null) {
		const attrs = parseAttrs(match[1]!);
		const id = attrs.id ?? `section-${sections.length + 1}`;
		sections.push({ id, title: attrs.title ?? id });
	}
	return sections;
}

/** Page metadata from the `schemd-doc` header, or undefined when absent. */
export function parseDocFrontmatter(source: string, slug: string): DocFrontmatter | undefined {
	const match = DOC_META.exec(source);
	if (!match) return undefined;
	const attrs = parseAttrs(match[1]!);
	return {
		slug: attrs.id ?? slug,
		title: attrs.title ?? slug,
		label: attrs.label ?? attrs.title ?? slug,
		summary: attrs.summary ?? '',
		group: attrs.category ?? 'Documentation',
		order: Number(attrs.order ?? 999)
	};
}

interface FenceExtraction {
	readonly markdown: string;
	readonly examples: DocExample[];
	readonly figures: Map<string, string>;
}

/**
 * Pull `schemd` fences out of a section body: compile each to SVG for the rail,
 * replace it in the prose with a placeholder that later becomes a source
 * figure. Non-schemd fences (` ```sh `, ` ```ts `) are left for `marked`.
 *
 * @throws {SchematicSyntaxError} A broken example must fail the build.
 */
function extractSchemdFences(
	body: string,
	docSlug: string,
	sectionId: string,
	exampleTitle: string,
	counter: { value: number }
): FenceExtraction {
	const examples: DocExample[] = [];
	const figures = new Map<string, string>();
	const markdown = body.replace(SCHEMD_FENCE, (whole, info: string, code: string) => {
		const fence = parseSchematicFence(info.trim());
		if (!fence) return whole;
		counter.value += 1;
		const id = `${docSlug}-example-${counter.value}`;
		const source = code.trim();
		const compiled = compileSchematic(source, { ...fence, mode: 'embedded-css', idPrefix: id });
		const sourceHtml = highlightSourceHtml(source);
		examples.push({
			id,
			sectionId,
			title: exampleTitle || fence.title,
			source,
			sourceHtml,
			svg: compiled.svg
		});
		const placeholder = `%%SCHEMD_FENCE_${counter.value}%%`;
		figures.set(
			placeholder,
			`<figure class="doc-example" data-example="${id}">` +
				`<pre class="codeblock" tabindex="0" role="region" aria-label="Scrollable schemd source" data-lang="schemd"><code>${sourceHtml}</code></pre>` +
				`<figcaption class="microlabel">compiled by @schemd/core → shown in the rail</figcaption>` +
				`</figure>`
		);
		return `\n\n${placeholder}\n\n`;
	});
	return { markdown, examples, figures };
}

/** Render prose to HTML, then swap fence placeholders for their figures. */
function renderProse(markdown: string, figures: Map<string, string>): string {
	let html = marked.parse(markdown, { async: false });
	for (const [placeholder, figure] of figures) {
		html = html.split(`<p>${placeholder}</p>`).join(figure).split(placeholder).join(figure);
	}
	return html;
}

/**
 * Render one `content/schemd` document.
 *
 * @param source - Raw Markdown with `schemd-doc`/`schemd-section` directives.
 * @param docSlug - Stable prefix for example and SVG definition IDs.
 */
export function renderMarkdownDoc(source: string, docSlug: string): RenderedDoc {
	const normalized = source.replace(/\r\n?/g, '\n');
	const sections: DocSection[] = [];
	const examples: DocExample[] = [];
	const out: string[] = [];
	const counter = { value: 0 };

	/* Preamble: any prose between the header and the first section is intro. */
	const firstSection = normalized.search(/<!--\s*schemd-section:/);
	const headerEnd = normalized.search(/-->/);
	const preambleStart = headerEnd === -1 ? 0 : headerEnd + 3;
	const preamble = normalized
		.slice(preambleStart, firstSection === -1 ? undefined : firstSection)
		.trim();
	if (preamble) {
		const {
			markdown,
			examples: exs,
			figures
		} = extractSchemdFences(preamble, docSlug, 'intro', '', counter);
		examples.push(...exs);
		out.push(renderProse(markdown, figures));
	}

	SECTION.lastIndex = 0;
	let match: RegExpExecArray | null;
	while ((match = SECTION.exec(normalized)) !== null) {
		const attrs = parseAttrs(match[1]!);
		const id = attrs.id ?? `section-${sections.length + 1}`;
		const title = attrs.title ?? id;
		const eyebrow = attrs.eyebrow ?? '';
		sections.push({ id, title });

		const {
			markdown,
			examples: exs,
			figures
		} = extractSchemdFences(match[2]!, docSlug, id, attrs['example-title'] ?? title, counter);
		examples.push(...exs);

		out.push(
			`<h2 id="${id}">${eyebrow ? `<span class="doc-eyebrow">${escapeHtml(eyebrow)}</span>` : ''}${escapeHtml(title)}</h2>`
		);
		out.push(renderProse(markdown, figures));
	}

	return { html: out.join('\n'), sections, examples };
}

export { SchematicSyntaxError };
