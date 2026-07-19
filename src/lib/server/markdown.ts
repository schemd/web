/**
 * Zero-dependency server-side Markdown pipeline.
 *
 * A deliberately small, deterministic renderer for the documentation corpus:
 * headings, paragraphs, lists, tables, inline marks, admonition blocks, and
 * fenced code. ` ```schemd ` fences are the interesting part — their bodies
 * are compiled through the real `@schemd/core` compiler at load time, so every
 * vector on the documentation site is engine output, not an illustration.
 */
import {
	compileSchematic,
	parseSchematicFence,
	SchematicSyntaxError
} from '@schemd/core';
import { highlightSourceHtml } from '$lib/tokenizer';

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

/** Deterministic, collision-suffixed heading slugs. */
function slugger(): (title: string) => string {
	const seen = new Map<string, number>();
	return (title: string): string => {
		const base =
			title
				.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, '')
				.trim()
				.replace(/\s+/g, '-') || 'section';
		const count = seen.get(base) ?? 0;
		seen.set(base, count + 1);
		return count === 0 ? base : `${base}-${count}`;
	};
}

/** Inline marks: code, bold, italic, links. Escapes first, marks second. */
function renderInline(source: string): string {
	let html = escapeHtml(source);
	html = html.replace(/`([^`]+)`/g, (_, code: string) => `<code>${code}</code>`);
	html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
	html = html.replace(/(^|[\s(])_([^_]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
	html = html.replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
	html = html.replace(
		/\[([^\]]+)\]\(([^)\s]+)\)/g,
		(_, text: string, href: string) =>
			`<a href="${href}"${href.startsWith('http') ? ' rel="noopener" target="_blank"' : ''}>${text}</a>`
	);
	return html;
}

function renderTable(rows: readonly string[]): string {
	const parse = (row: string): string[] =>
		row
			.replace(/^\||\|$/g, '')
			.split('|')
			.map((cell) => cell.trim());
	const header = parse(rows[0]!);
	const body = rows.slice(2).map(parse);
	const head = header.map((cell) => `<th>${renderInline(cell)}</th>`).join('');
	const cells = body
		.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`)
		.join('');
	return `<table><thead><tr>${head}</tr></thead><tbody>${cells}</tbody></table>`;
}

/**
 * Render one Markdown document, compiling every `schemd` fence.
 *
 * @param source - Raw Markdown.
 * @param docSlug - Stable prefix for example and SVG definition IDs.
 * @throws {SchematicSyntaxError} When an embedded fence fails to compile —
 *   documentation with a broken example must fail the build, not ship it.
 */
export function renderMarkdownDoc(source: string, docSlug: string): RenderedDoc {
	const slug = slugger();
	const lines = source.replace(/\r\n?/g, '\n').split('\n');
	const out: string[] = [];
	const sections: DocSection[] = [];
	const examples: DocExample[] = [];
	let currentSection = 'intro';
	let exampleIndex = 0;
	let index = 0;

	while (index < lines.length) {
		const line = lines[index]!;

		/* Fenced code */
		const fence = line.match(/^```(.*)$/);
		if (fence) {
			const info = fence[1]!.trim();
			const body: string[] = [];
			index += 1;
			while (index < lines.length && !/^```\s*$/.test(lines[index]!)) {
				body.push(lines[index]!);
				index += 1;
			}
			index += 1;
			const code = body.join('\n');
			const schemdFence = parseSchematicFence(info);
			if (schemdFence) {
				exampleIndex += 1;
				const id = `${docSlug}-example-${exampleIndex}`;
				const compiled = compileSchematic(code.trim(), {
					...schemdFence,
					mode: 'embedded-css',
					idPrefix: id
				});
				examples.push({
					id,
					sectionId: currentSection,
					title: schemdFence.title,
					source: code.trim(),
					sourceHtml: highlightSourceHtml(code.trim()),
					svg: compiled.svg
				});
				out.push(
					`<figure class="doc-example" data-example="${id}">` +
						`<pre class="codeblock" data-lang="schemd"><code>${highlightSourceHtml(code.trim())}</code></pre>` +
						`<figcaption class="microlabel">compiled by @schemd/core → shown in the rail</figcaption>` +
						`</figure>`
				);
			} else if (info === 'schemd-source' || info === 'text' || info === '') {
				out.push(
					`<pre class="codeblock"><code>${info === 'schemd-source' ? highlightSourceHtml(code) : escapeHtml(code)}</code></pre>`
				);
			} else {
				out.push(`<pre class="codeblock" data-lang="${escapeHtml(info)}"><code>${escapeHtml(code)}</code></pre>`);
			}
			continue;
		}

		/* Raw HTML passthrough (admonitions authored inline) */
		if (/^<\/?(div|span|p)\b/.test(line)) {
			out.push(line);
			index += 1;
			continue;
		}

		/* Headings */
		const heading = line.match(/^(#{1,3})\s+(.*)$/);
		if (heading) {
			const depth = heading[1]!.length;
			const title = heading[2]!.trim();
			const id = slug(title);
			if (depth === 2) {
				currentSection = id;
				sections.push({ id, title });
			}
			out.push(`<h${depth} id="${id}">${renderInline(title)}</h${depth}>`);
			index += 1;
			continue;
		}

		/* Tables */
		if (line.startsWith('|') && lines[index + 1]?.match(/^\|[\s:|-]+\|$/)) {
			const rows: string[] = [];
			while (index < lines.length && lines[index]!.startsWith('|')) {
				rows.push(lines[index]!);
				index += 1;
			}
			out.push(renderTable(rows));
			continue;
		}

		/* Unordered lists */
		if (/^-\s+/.test(line)) {
			const items: string[] = [];
			while (index < lines.length && /^-\s+/.test(lines[index]!)) {
				items.push(lines[index]!.replace(/^-\s+/, ''));
				index += 1;
			}
			out.push(`<ul>${items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
			continue;
		}

		/* Blank */
		if (line.trim() === '') {
			index += 1;
			continue;
		}

		/* Paragraph */
		const paragraph: string[] = [];
		while (
			index < lines.length &&
			lines[index]!.trim() !== '' &&
			!/^(#{1,3}\s|```|-\s|\||<\/?(?:div|span|p)\b)/.test(lines[index]!)
		) {
			paragraph.push(lines[index]!);
			index += 1;
		}
		out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
	}

	return { html: out.join('\n'), sections, examples };
}

export { SchematicSyntaxError };
