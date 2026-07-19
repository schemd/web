import {
	compileSchematic,
	parseSchematicFence,
	SchematicSyntaxError,
	type SchematicCompilationMetrics
} from '@schemd/core';
import { DOCUMENTATION_SOURCES } from '$lib/content/docs';
import { resolveVersion } from '$lib/platform';

const MAX_DOCUMENT_CHARACTERS = 131_072;
const MAX_METADATA_CHARACTERS = 2_048;
const MAX_INLINE_LINK_CHARACTERS = 2_048;
const IDENTIFIER_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const METADATA_KEY_PATTERN = /^[a-z][a-z0-9-]*$/u;
const DOCUMENT_PREFIX = '<!-- schemd-doc:';
const SECTION_PREFIX = '<!-- schemd-section:';
const COMMENT_SUFFIX = '-->';
const SECTION_END = '<!-- /schemd-section -->';

export interface DocumentationExample {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly source: string;
	readonly svg: string;
	readonly metrics: SchematicCompilationMetrics;
}

export interface DocumentationSection {
	readonly id: string;
	readonly eyebrow: string;
	readonly title: string;
	readonly html: string;
	readonly plainText: string;
	readonly example: DocumentationExample;
}

export interface DocumentationPage {
	readonly version: string;
	readonly slug: string;
	readonly label: string;
	readonly title: string;
	readonly description: string;
	readonly group: string;
	readonly order: number;
	readonly sections: readonly DocumentationSection[];
}

export interface DocumentationNavigationEntry {
	readonly slug: string;
	readonly label: string;
	readonly title: string;
	readonly group: string;
	readonly order: number;
	readonly sections: readonly {
		readonly id: string;
		readonly title: string;
	}[];
}

export interface DocumentationSearchResult {
	readonly id: string;
	readonly title: string;
	readonly summary: string;
	readonly category: string;
	readonly path: string;
}

interface ParsedFence {
	readonly language: string;
	readonly info: string;
	readonly body: string;
	readonly startLine: number;
	readonly endLine: number;
}

interface SectionSource {
	readonly metadata: Readonly<Record<string, string>>;
	readonly body: string;
	readonly sourceLine: number;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function safeLinkTarget(value: string): string | undefined {
	const target = value.trim();
	if (target.length === 0 || target.length > MAX_INLINE_LINK_CHARACTERS) return undefined;
	if (target.startsWith('/') || target.startsWith('#')) return target;
	try {
		const url = new URL(target);
		return url.protocol === 'https:' || url.protocol === 'mailto:' ? url.href : undefined;
	} catch {
		return undefined;
	}
}

function renderInline(source: string): string {
	let html = '';
	let index = 0;
	while (index < source.length) {
		if (source[index] === '`') {
			const end = source.indexOf('`', index + 1);
			if (end > index + 1) {
				html += `<code>${escapeHtml(source.slice(index + 1, end))}</code>`;
				index = end + 1;
				continue;
			}
		}
		if (source.startsWith('**', index)) {
			const end = source.indexOf('**', index + 2);
			if (end > index + 2) {
				html += `<strong>${renderInline(source.slice(index + 2, end))}</strong>`;
				index = end + 2;
				continue;
			}
		}
		if (source[index] === '*') {
			const end = source.indexOf('*', index + 1);
			if (end > index + 1) {
				html += `<em>${renderInline(source.slice(index + 1, end))}</em>`;
				index = end + 1;
				continue;
			}
		}
		if (source[index] === '[') {
			const labelEnd = source.indexOf(']', index + 1);
			if (labelEnd > index + 1 && source[labelEnd + 1] === '(') {
				const targetEnd = source.indexOf(')', labelEnd + 2);
				if (targetEnd > labelEnd + 2) {
					const target = safeLinkTarget(source.slice(labelEnd + 2, targetEnd));
					if (target !== undefined) {
						const external = target.startsWith('https://');
						html += `<a href="${escapeHtml(target)}"${external ? ' rel="noreferrer"' : ''}>${escapeHtml(source.slice(index + 1, labelEnd))}</a>`;
						index = targetEnd + 1;
						continue;
					}
				}
			}
		}
		html += escapeHtml(source[index] ?? '');
		index += 1;
	}
	return html;
}

function fenceOpening(
	line: string
): { readonly marker: string; readonly info: string } | undefined {
	const trimmed = line.trimStart();
	const markerCharacter = trimmed[0];
	if (markerCharacter !== '`' && markerCharacter !== '~') return undefined;
	let count = 0;
	while (trimmed[count] === markerCharacter) count += 1;
	if (count < 3) return undefined;
	return {
		marker: markerCharacter.repeat(count),
		info: trimmed.slice(count).trim()
	};
}

function isFenceClosing(line: string, marker: string): boolean {
	const trimmed = line.trim();
	if (trimmed.length < marker.length || trimmed[0] !== marker[0]) return false;
	let count = 0;
	while (trimmed[count] === marker[0]) count += 1;
	return count >= marker.length && trimmed.slice(count).trim().length === 0;
}

function splitFenceInfo(info: string): { readonly language: string; readonly metadata: string } {
	let separator = 0;
	while (separator < info.length && !/\s/u.test(info[separator] ?? '')) separator += 1;
	return {
		language: info.slice(0, separator).toLocaleLowerCase('en-US'),
		metadata: info.slice(separator).trim()
	};
}

function scanFences(markdown: string, context: string): readonly ParsedFence[] {
	const lines = markdown.split('\n');
	const fences: ParsedFence[] = [];
	for (let index = 0; index < lines.length; index += 1) {
		const opening = fenceOpening(lines[index] ?? '');
		if (opening === undefined) continue;
		const split = splitFenceInfo(opening.info);
		const body: string[] = [];
		const startLine = index + 1;
		let closed = false;
		for (index += 1; index < lines.length; index += 1) {
			const line = lines[index] ?? '';
			if (isFenceClosing(line, opening.marker)) {
				fences.push({
					language: split.language,
					info: split.metadata,
					body: body.join('\n'),
					startLine,
					endLine: index + 1
				});
				closed = true;
				break;
			}
			body.push(line);
		}
		if (!closed) throw new Error(`${context}:${startLine}: unclosed code fence.`);
	}
	return fences;
}

function stripLineRange(markdown: string, startLine: number, endLine: number): string {
	return markdown
		.split('\n')
		.filter((_line, index) => index + 1 < startLine || index + 1 > endLine)
		.join('\n')
		.trim();
}

function renderMarkdown(markdown: string, context: string): string {
	const lines = markdown.split('\n');
	const blocks: string[] = [];
	let paragraph: string[] = [];
	let listItems: string[] = [];

	const flushParagraph = (): void => {
		if (paragraph.length === 0) return;
		blocks.push(`<p>${renderInline(paragraph.join(' ').trim())}</p>`);
		paragraph = [];
	};
	const flushList = (): void => {
		if (listItems.length === 0) return;
		blocks.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join('')}</ul>`);
		listItems = [];
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		const opening = fenceOpening(line);
		if (opening !== undefined) {
			flushParagraph();
			flushList();
			const split = splitFenceInfo(opening.info);
			const body: string[] = [];
			const startLine = index + 1;
			let closed = false;
			for (index += 1; index < lines.length; index += 1) {
				const candidate = lines[index] ?? '';
				if (isFenceClosing(candidate, opening.marker)) {
					closed = true;
					break;
				}
				body.push(candidate);
			}
			if (!closed) throw new Error(`${context}:${startLine}: unclosed code fence.`);
			const languageClass =
				IDENTIFIER_PATTERN.test(split.language) && split.language.length <= 32
					? ` class="language-${split.language}"`
					: '';
			blocks.push(`<pre><code${languageClass}>${escapeHtml(body.join('\n'))}</code></pre>`);
			continue;
		}
		const unordered = line.startsWith('- ') ? line.slice(2).trim() : undefined;
		if (unordered !== undefined) {
			flushParagraph();
			listItems.push(unordered);
			continue;
		}
		if (line.trim().length === 0) {
			flushParagraph();
			flushList();
			continue;
		}
		flushList();
		paragraph.push(line.trim());
	}
	flushParagraph();
	flushList();
	return blocks.join('');
}

function plainText(markdown: string): string {
	return markdown
		.replace(/[`*_#[\]()]/gu, ' ')
		.replace(/\s+/gu, ' ')
		.trim();
}

function metadataFromComment(
	line: string,
	prefix: string,
	context: string
): Readonly<Record<string, string>> {
	const trimmed = line.trim();
	if (
		!trimmed.startsWith(prefix) ||
		!trimmed.endsWith(COMMENT_SUFFIX) ||
		trimmed.length > MAX_METADATA_CHARACTERS
	) {
		throw new Error(`${context}: malformed metadata comment.`);
	}
	const content = trimmed.slice(prefix.length, -COMMENT_SUFFIX.length).trim();
	const metadata: Record<string, string> = {};
	for (const rawField of content.split(';')) {
		const field = rawField.trim();
		if (field.length === 0) continue;
		const separator = field.indexOf('=');
		if (separator <= 0) throw new Error(`${context}: malformed metadata field "${field}".`);
		const key = field.slice(0, separator).trim().toLocaleLowerCase('en-US');
		const value = field.slice(separator + 1).trim();
		if (!METADATA_KEY_PATTERN.test(key) || value.length === 0) {
			throw new Error(`${context}: metadata fields require a valid key and value.`);
		}
		if (Object.hasOwn(metadata, key)) {
			throw new Error(`${context}: duplicate metadata key "${key}".`);
		}
		metadata[key] = value;
	}
	return Object.freeze(metadata);
}

function requiredMetadata(
	metadata: Readonly<Record<string, string>>,
	key: string,
	context: string
): string {
	const value = metadata[key];
	if (value === undefined) throw new Error(`${context}: missing metadata "${key}".`);
	return value;
}

function requiredIdentifier(
	metadata: Readonly<Record<string, string>>,
	key: string,
	context: string
): string {
	const value = requiredMetadata(metadata, key, context);
	if (!IDENTIFIER_PATTERN.test(value)) {
		throw new Error(`${context}: metadata "${key}" must be lowercase kebab-case.`);
	}
	return value;
}

function extractSections(lines: readonly string[], context: string): readonly SectionSource[] {
	const sections: SectionSource[] = [];
	for (let index = 1; index < lines.length; index += 1) {
		const line = lines[index] ?? '';
		if (!line.trim().startsWith(SECTION_PREFIX)) continue;
		const sourceLine = index + 1;
		const metadata = metadataFromComment(line, SECTION_PREFIX, `${context}:${sourceLine}`);
		const body: string[] = [];
		let closed = false;
		for (index += 1; index < lines.length; index += 1) {
			const candidate = lines[index] ?? '';
			if (candidate.trim() === SECTION_END) {
				closed = true;
				break;
			}
			body.push(candidate);
		}
		if (!closed) throw new Error(`${context}:${sourceLine}: unclosed documentation section.`);
		sections.push({ metadata, body: body.join('\n').trim(), sourceLine });
	}
	if (sections.length === 0) throw new Error(`${context}: document contains no sections.`);
	return sections;
}

function parseDocumentationSource(
	version: string,
	sourceName: string,
	rawMarkdown: string
): DocumentationPage {
	const markdown = rawMarkdown.replace(/\r\n?/gu, '\n');
	if (markdown.length > MAX_DOCUMENT_CHARACTERS) {
		throw new Error(`${sourceName}: document exceeds ${MAX_DOCUMENT_CHARACTERS} characters.`);
	}
	if (resolveVersion(version) === undefined) {
		throw new Error(`${sourceName}: unsupported documentation version "${version}".`);
	}
	const lines = markdown.split('\n');
	const documentLine = lines.find((line) => line.trim().length > 0);
	if (documentLine === undefined) throw new Error(`${sourceName}: empty documentation source.`);
	const documentMetadata = metadataFromComment(documentLine, DOCUMENT_PREFIX, sourceName);
	const slug = requiredIdentifier(documentMetadata, 'id', sourceName);
	const order = Number(requiredMetadata(documentMetadata, 'order', sourceName));
	if (!Number.isSafeInteger(order) || order < 0) {
		throw new Error(`${sourceName}: order must be a non-negative safe integer.`);
	}
	const sectionIds = new Set<string>();
	const sections = extractSections(lines, sourceName).map((sectionSource) => {
		const context = `${sourceName}:${sectionSource.sourceLine}`;
		const id = requiredIdentifier(sectionSource.metadata, 'id', context);
		if (sectionIds.has(id)) throw new Error(`${context}: duplicate section id "${id}".`);
		sectionIds.add(id);
		const fences = scanFences(sectionSource.body, context);
		const examples = fences.filter((fence) => fence.language === 'schemd');
		if (examples.length !== 1) {
			throw new Error(`${context}: each section requires exactly one schemd fence.`);
		}
		const example = examples[0];
		if (example === undefined) throw new Error(`${context}: missing schemd example.`);
		const fence = parseSchematicFence(
			`schemd${example.info.length === 0 ? '' : ` ${example.info}`}`,
			requiredMetadata(sectionSource.metadata, 'example-title', context)
		);
		if (fence === undefined) throw new Error(`${context}: invalid schemd fence.`);
		let compilation;
		try {
			compilation = compileSchematic(example.body, {
				...fence,
				mode: 'embedded-css',
				idPrefix: `docs-${version}-${slug}-${id}`
			});
		} catch (reason) {
			const detail = reason instanceof Error ? reason.message : 'Unknown compiler failure.';
			throw new Error(`${context}: Schemd example failed: ${detail}`, { cause: reason });
		}
		const prose = stripLineRange(sectionSource.body, example.startLine, example.endLine);
		return Object.freeze({
			id,
			eyebrow: requiredMetadata(sectionSource.metadata, 'eyebrow', context),
			title: requiredMetadata(sectionSource.metadata, 'title', context),
			html: renderMarkdown(prose, context),
			plainText: plainText(prose),
			example: Object.freeze({
				id: `${slug}-${id}`,
				title: requiredMetadata(sectionSource.metadata, 'example-title', context),
				summary: requiredMetadata(sectionSource.metadata, 'example-summary', context),
				source: example.body,
				svg: compilation.svg,
				metrics: Object.freeze({ ...compilation.metrics })
			})
		});
	});
	return Object.freeze({
		version,
		slug,
		label: requiredMetadata(documentMetadata, 'label', sourceName),
		title: requiredMetadata(documentMetadata, 'title', sourceName),
		description: requiredMetadata(documentMetadata, 'description', sourceName),
		group: requiredMetadata(documentMetadata, 'group', sourceName),
		order,
		sections: Object.freeze(sections)
	});
}

const DOCUMENTATION_PAGES: readonly DocumentationPage[] = Object.freeze(
	DOCUMENTATION_SOURCES.map((source) =>
		parseDocumentationSource(source.version, source.sourceName, source.markdown)
	).sort((left, right) => left.order - right.order || left.slug.localeCompare(right.slug))
);

const DOCUMENTATION_BY_PATH = new Map<string, DocumentationPage>();
for (const page of DOCUMENTATION_PAGES) {
	const key = `${page.version}/${page.slug}`;
	if (DOCUMENTATION_BY_PATH.has(key)) throw new Error(`Duplicate documentation page "${key}".`);
	DOCUMENTATION_BY_PATH.set(key, page);
}

export function getDocumentationPage(version: string, slug: string): DocumentationPage | undefined {
	return DOCUMENTATION_BY_PATH.get(`${version}/${slug}`);
}

export function getDocumentationNavigation(
	version: string
): readonly DocumentationNavigationEntry[] {
	return Object.freeze(
		DOCUMENTATION_PAGES.filter((page) => page.version === version).map((page) =>
			Object.freeze({
				slug: page.slug,
				label: page.label,
				title: page.title,
				group: page.group,
				order: page.order,
				sections: Object.freeze(
					page.sections.map((section) => Object.freeze({ id: section.id, title: section.title }))
				)
			})
		)
	);
}

export function documentationPaths(): readonly string[] {
	return Object.freeze(DOCUMENTATION_PAGES.map((page) => `/docs/${page.version}/${page.slug}`));
}

function queryTokens(query: string): readonly string[] {
	return Object.freeze(
		query
			.trim()
			.toLocaleLowerCase('en-US')
			.slice(0, 80)
			.split(/\s+/u)
			.filter((token) => token.length > 0)
			.slice(0, 8)
	);
}

export function searchDocumentation(query: string): readonly DocumentationSearchResult[] {
	const tokens = queryTokens(query);
	if (tokens.length === 0) {
		return DOCUMENTATION_PAGES.slice(0, 6).map((page) => ({
			id: `docs-${page.version}-${page.slug}`,
			title: page.title,
			summary: page.description,
			category: page.group,
			path: `/docs/${page.version}/${page.slug}`
		}));
	}
	const scored: { readonly score: number; readonly result: DocumentationSearchResult }[] = [];
	for (const page of DOCUMENTATION_PAGES) {
		const pageText =
			`${page.title} ${page.label} ${page.description} ${page.group}`.toLocaleLowerCase('en-US');
		for (const section of page.sections) {
			const sectionText =
				`${section.title} ${section.eyebrow} ${section.plainText} ${section.example.title}`.toLocaleLowerCase(
					'en-US'
				);
			if (!tokens.every((token) => pageText.includes(token) || sectionText.includes(token)))
				continue;
			const score = tokens.reduce(
				(total, token) =>
					total +
					(page.title.toLocaleLowerCase('en-US').includes(token) ? 8 : 0) +
					(section.title.toLocaleLowerCase('en-US').includes(token) ? 5 : 0) +
					(pageText.includes(token) ? 2 : 0) +
					(sectionText.includes(token) ? 1 : 0),
				0
			);
			scored.push({
				score,
				result: {
					id: `docs-${page.version}-${page.slug}-${section.id}`,
					title: section.title,
					summary: page.description,
					category: page.group,
					path: `/docs/${page.version}/${page.slug}#${section.id}`
				}
			});
		}
	}
	return scored
		.sort(
			(left, right) =>
				right.score - left.score || left.result.title.localeCompare(right.result.title)
		)
		.slice(0, 12)
		.map(({ result }) => result);
}

export function documentationPageCount(): number {
	return DOCUMENTATION_PAGES.length;
}

export function documentationSectionCount(): number {
	return DOCUMENTATION_PAGES.reduce((total, page) => total + page.sections.length, 0);
}

export function compilerDiagnostic(reason: unknown): {
	readonly message: string;
	readonly line: number | null;
} {
	if (reason instanceof SchematicSyntaxError) {
		return { message: reason.message, line: reason.line ?? null };
	}
	return {
		message: reason instanceof Error ? reason.message : 'The compiler rejected the schematic.',
		line: null
	};
}
