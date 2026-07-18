export interface SourcePosition {
	readonly line: number;
	readonly column: number;
}

export class DocumentationSyntaxError extends Error {
	readonly position: SourcePosition;
	readonly sourceName: string;

	constructor(message: string, position: SourcePosition, sourceName: string) {
		super(`${sourceName}:${position.line}:${position.column}: ${message}`);
		this.name = 'DocumentationSyntaxError';
		this.position = position;
		this.sourceName = sourceName;
	}
}

export interface DocumentationMetadata {
	readonly id: string;
	readonly label: string;
	readonly title: string;
	readonly summary: string;
	readonly category: string;
	readonly order: number;
}

export interface SectionMetadata {
	readonly id: string;
	readonly eyebrow: string;
	readonly title: string;
}

export type InlineNode =
	| { readonly kind: 'text'; readonly value: string }
	| { readonly kind: 'code'; readonly value: string }
	| { readonly kind: 'strong'; readonly children: readonly InlineNode[] }
	| { readonly kind: 'emphasis'; readonly children: readonly InlineNode[] }
	| { readonly kind: 'link'; readonly href: string; readonly children: readonly InlineNode[] };

interface BlockBase {
	readonly position: SourcePosition;
}

export type DocumentationBlock =
	| (BlockBase & { readonly kind: 'paragraph'; readonly children: readonly InlineNode[] })
	| (BlockBase & {
			readonly kind: 'heading';
			readonly level: 3;
			readonly id: string;
			readonly children: readonly InlineNode[];
	  })
	| (BlockBase & {
			readonly kind: 'list';
			readonly ordered: boolean;
			readonly items: readonly (readonly InlineNode[])[];
	  })
	| (BlockBase & { readonly kind: 'callout'; readonly children: readonly InlineNode[] })
	| (BlockBase & {
			readonly kind: 'code';
			readonly id: string;
			readonly language: string;
			readonly metadata: string;
			readonly value: string;
	  })
	| (BlockBase & {
			readonly kind: 'table';
			readonly headers: readonly (readonly InlineNode[])[];
			readonly rows: readonly (readonly (readonly InlineNode[])[])[];
	  });

export interface DocumentationSection {
	readonly metadata: SectionMetadata;
	readonly position: SourcePosition;
	readonly blocks: readonly DocumentationBlock[];
}

export interface DocumentationAst {
	readonly metadata: DocumentationMetadata;
	readonly sections: readonly DocumentationSection[];
	readonly sourceName: string;
}

export interface TocEntry {
	readonly id: string;
	readonly title: string;
	readonly depth: 2 | 3;
}

export interface RenderDocumentationOptions {
	readonly renderSchemd?: (block: Extract<DocumentationBlock, { kind: 'code' }>) => string;
}

const MAX_DOCUMENT_CHARACTERS = 131_072;
const IDENTIFIER_CHARACTERS = 'abcdefghijklmnopqrstuvwxyz0123456789-';
const SAFE_LINK_PREFIXES = ['/', '#', 'https://', 'mailto:'] as const;
const CODE_KEYWORDS = new Set([
	'import', 'export', 'from', 'const', 'let', 'function', 'return', 'if', 'else', 'type', 'interface',
	'new', 'throw', 'true', 'false', 'undefined', 'class', 'resistor', 'capacitor', 'inductor',
	'diode', 'transistor', 'port', 'ground', 'and', 'nand', 'or', 'nor', 'xor', 'not', 'hadamard',
	'cnot', 'qgate', 'ic', 'actor', 'usecase', 'state', 'lifeline', 'note', 'package', 'initial', 'final'
]);

function position(line: number, column = 1): SourcePosition {
	return { line, column };
}

function fail(message: string, line: number, sourceName: string, column = 1): never {
	throw new DocumentationSyntaxError(message, position(line, column), sourceName);
}

function isIdentifier(value: string): boolean {
	if (value.startsWith('-') || value.endsWith('-') || value.includes('--')) return false;
	for (const character of value) if (!IDENTIFIER_CHARACTERS.includes(character)) return false;
	return true;
}

function parseMetadataFields(value: string, line: number, sourceName: string): ReadonlyMap<string, string> {
	const fields = new Map<string, string>();
	let start = 0;
	for (let index = 0; index <= value.length; index += 1) {
		if (index !== value.length && value[index] !== ';') continue;
		const field = value.slice(start, index).trim();
		start = index + 1;
		if (field.length === 0) continue;
		const separator = field.indexOf('=');
		if (separator < 1) fail(`Malformed metadata field "${field}".`, line, sourceName);
		const key = field.slice(0, separator).trim().toLowerCase();
		const fieldValue = field.slice(separator + 1).trim();
		if (fieldValue.length === 0) fail(`Metadata field "${key}" requires a value.`, line, sourceName);
		if (fields.has(key)) fail(`Duplicate metadata field "${key}".`, line, sourceName);
		fields.set(key, fieldValue);
	}
	return fields;
}

function requiredField(fields: ReadonlyMap<string, string>, key: string, line: number, sourceName: string): string {
	const value = fields.get(key);
	if (value === undefined) fail(`Missing required metadata field "${key}".`, line, sourceName);
	return value;
}

function identifierField(fields: ReadonlyMap<string, string>, key: string, line: number, sourceName: string): string {
	const value = requiredField(fields, key, line, sourceName);
	if (!isIdentifier(value)) fail(`Metadata field "${key}" must be lowercase kebab-case.`, line, sourceName);
	return value;
}

function metadataComment(line: string, prefix: string): string | undefined {
	const opening = `<!-- ${prefix}:`;
	if (!line.startsWith(opening) || !line.endsWith('-->')) return undefined;
	return line.slice(opening.length, -3).trim();
}

function parseInline(value: string): readonly InlineNode[] {
	const nodes: InlineNode[] = [];
	let textStart = 0;
	const pushText = (end: number): void => {
		if (end > textStart) nodes.push({ kind: 'text', value: value.slice(textStart, end) });
	};

	for (let index = 0; index < value.length; index += 1) {
		const character = value[index];
		if (character === '`') {
			const end = value.indexOf('`', index + 1);
			if (end > index + 1) {
				pushText(index);
				nodes.push({ kind: 'code', value: value.slice(index + 1, end) });
				index = end;
				textStart = end + 1;
			}
			continue;
		}
		if (character === '[') {
			const labelEnd = value.indexOf('](', index + 1);
			const hrefEnd = labelEnd < 0 ? -1 : value.indexOf(')', labelEnd + 2);
			if (labelEnd > index + 1 && hrefEnd > labelEnd + 2) {
				pushText(index);
				nodes.push({
					kind: 'link',
					href: value.slice(labelEnd + 2, hrefEnd),
					children: parseInline(value.slice(index + 1, labelEnd))
				});
				index = hrefEnd;
				textStart = hrefEnd + 1;
			}
			continue;
		}
		if (character === '*' && value[index + 1] === '*') {
			const end = value.indexOf('**', index + 2);
			if (end > index + 2) {
				pushText(index);
				nodes.push({ kind: 'strong', children: parseInline(value.slice(index + 2, end)) });
				index = end + 1;
				textStart = end + 2;
			} else index += 1;
			continue;
		}
		if (character === '*') {
			const end = value.indexOf('*', index + 1);
			if (end > index + 1) {
				pushText(index);
				nodes.push({ kind: 'emphasis', children: parseInline(value.slice(index + 1, end)) });
				index = end;
				textStart = end + 1;
			}
		}
	}
	pushText(value.length);
	return nodes;
}

function slugify(value: string): string {
	let result = '';
	let separatorPending = false;
	for (const character of value.toLowerCase()) {
		const isAsciiLetter = character >= 'a' && character <= 'z';
		const isDigit = character >= '0' && character <= '9';
		if (isAsciiLetter || isDigit) {
			if (separatorPending && result.length > 0) result += '-';
			result += character;
			separatorPending = false;
		} else if (result.length > 0) separatorPending = true;
	}
	return result || 'section';
}

function inlineText(nodes: readonly InlineNode[]): string {
	return nodes
		.map((node) => (node.kind === 'text' || node.kind === 'code' ? node.value : inlineText(node.children)))
		.join('');
}

function isListLine(line: string): boolean {
	if (line.startsWith('- ')) return true;
	let index = 0;
	while (index < line.length && line[index] >= '0' && line[index] <= '9') index += 1;
	return index > 0 && line.slice(index, index + 2) === '. ';
}

function orderedListValue(line: string): string | undefined {
	let index = 0;
	while (index < line.length && line[index] >= '0' && line[index] <= '9') index += 1;
	return index > 0 && line.slice(index, index + 2) === '. ' ? line.slice(index + 2) : undefined;
}

function tableCells(line: string): readonly string[] {
	const trimmed = line.trim();
	const body = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
	const withoutEnd = body.endsWith('|') ? body.slice(0, -1) : body;
	return withoutEnd.split('|').map((cell) => cell.trim());
}

function isTableDivider(line: string): boolean {
	const cells = tableCells(line);
	return cells.every((cell) => {
		let hyphens = 0;
		for (const character of cell) {
			if (character === '-') hyphens += 1;
			else if (character !== ':' && character !== ' ') return false;
		}
		return hyphens >= 3;
	});
}

function isBlockStart(lines: readonly string[], index: number): boolean {
	const line = lines[index];
	return line.length === 0 || line.startsWith('```') || line.startsWith('### ') || line.startsWith('> ') ||
		isListLine(line) || (line.includes('|') && isTableDivider(lines[index + 1] ?? '')) ||
		line.startsWith('<!-- schemd-section:');
}

function parseBlocks(
	lines: readonly string[],
	startLine: number,
	sectionId: string,
	sourceName: string
): readonly DocumentationBlock[] {
	const blocks: DocumentationBlock[] = [];
	const headingCounts = new Map<string, number>();
	let index = 0;
	let codeIndex = 0;

	while (index < lines.length) {
		const line = lines[index];
		const lineNumber = startLine + index;
		if (line.trim().length === 0) {
			index += 1;
			continue;
		}
		if (line.startsWith('<')) fail('Raw HTML is not supported in documentation prose.', lineNumber, sourceName);
		if (line.startsWith('```')) {
			const info = line.slice(3).trim();
			const space = info.indexOf(' ');
			const language = (space < 0 ? info : info.slice(0, space)).toLowerCase();
			const metadata = space < 0 ? '' : info.slice(space + 1).trim();
			if (language.length === 0) fail('Code fences require a language identifier.', lineNumber, sourceName);
			const codeLines: string[] = [];
			index += 1;
			while (index < lines.length && lines[index] !== '```') {
				codeLines.push(lines[index]);
				index += 1;
			}
			if (index >= lines.length) fail('Unclosed code fence.', lineNumber, sourceName);
			codeIndex += 1;
			blocks.push({
				kind: 'code', position: position(lineNumber), id: `${sectionId}-example-${codeIndex}`,
				language, metadata, value: codeLines.join('\n')
			});
			index += 1;
			continue;
		}
		if (line.startsWith('### ')) {
			const children = parseInline(line.slice(4).trim());
			const baseId = slugify(inlineText(children));
			const count = (headingCounts.get(baseId) ?? 0) + 1;
			headingCounts.set(baseId, count);
			blocks.push({
				kind: 'heading', level: 3, id: count === 1 ? baseId : `${baseId}-${count}`,
				position: position(lineNumber), children
			});
			index += 1;
			continue;
		}
		if (line.startsWith('> ')) {
			const values: string[] = [];
			while (index < lines.length && lines[index].startsWith('> ')) {
				values.push(lines[index].slice(2));
				index += 1;
			}
			blocks.push({ kind: 'callout', position: position(lineNumber), children: parseInline(values.join(' ')) });
			continue;
		}
		if (isListLine(line)) {
			const ordered = orderedListValue(line) !== undefined;
			const items: (readonly InlineNode[])[] = [];
			while (index < lines.length && isListLine(lines[index])) {
				const current = lines[index];
				const orderedValue = orderedListValue(current);
				if ((orderedValue !== undefined) !== ordered) break;
				const itemValue = orderedValue === undefined ? current.slice(2) : orderedValue;
				items.push(parseInline(itemValue));
				index += 1;
			}
			blocks.push({ kind: 'list', position: position(lineNumber), ordered, items });
			continue;
		}
		if (line.includes('|') && isTableDivider(lines[index + 1] ?? '')) {
			const headers = tableCells(line).map(parseInline);
			const dividerCells = tableCells(lines[index + 1]);
			if (headers.length !== dividerCells.length) fail('Table divider must match its header width.', lineNumber + 1, sourceName);
			index += 2;
			const rows: (readonly (readonly InlineNode[])[])[] = [];
			while (index < lines.length && lines[index].includes('|') && lines[index].trim().length > 0) {
				const cells = tableCells(lines[index]);
				if (cells.length !== headers.length) fail('Table row must match its header width.', startLine + index, sourceName);
				rows.push(cells.map(parseInline));
				index += 1;
			}
			blocks.push({ kind: 'table', position: position(lineNumber), headers, rows });
			continue;
		}

		const paragraph: string[] = [];
		while (index < lines.length && !isBlockStart(lines, index)) {
			const current = lines[index];
			if (current.startsWith('<')) fail('Raw HTML is not supported in documentation prose.', startLine + index, sourceName);
			paragraph.push(current.trim());
			index += 1;
		}
		blocks.push({ kind: 'paragraph', position: position(lineNumber), children: parseInline(paragraph.join(' ')) });
	}
	return blocks;
}

export function parseDocumentation(source: string, sourceName = 'documentation.md'): DocumentationAst {
	const normalized = source.replaceAll('\r\n', '\n').replaceAll('\r', '\n');
	if (normalized.length > MAX_DOCUMENT_CHARACTERS) fail(`Document exceeds ${MAX_DOCUMENT_CHARACTERS} characters.`, 1, sourceName);
	const lines = normalized.split('\n');
	let cursor = 0;
	while (cursor < lines.length && lines[cursor].trim().length === 0) cursor += 1;
	const firstLine = lines[cursor] ?? '';
	const documentMetadataSource = metadataComment(firstLine, 'schemd-doc');
	if (documentMetadataSource === undefined) fail('Document must begin with a schemd-doc metadata comment.', cursor + 1, sourceName);
	const documentFields = parseMetadataFields(documentMetadataSource, cursor + 1, sourceName);
	const orderValue = Number(requiredField(documentFields, 'order', cursor + 1, sourceName));
	if (!Number.isSafeInteger(orderValue) || orderValue < 0) fail('Metadata field "order" must be a non-negative integer.', cursor + 1, sourceName);
	const metadata: DocumentationMetadata = {
		id: identifierField(documentFields, 'id', cursor + 1, sourceName),
		label: requiredField(documentFields, 'label', cursor + 1, sourceName),
		title: requiredField(documentFields, 'title', cursor + 1, sourceName),
		summary: requiredField(documentFields, 'summary', cursor + 1, sourceName),
		category: requiredField(documentFields, 'category', cursor + 1, sourceName),
		order: orderValue
	};

	const sections: DocumentationSection[] = [];
	const sectionIds = new Set<string>();
	cursor += 1;
	while (cursor < lines.length) {
		const line = lines[cursor];
		if (line.trim().length === 0) {
			cursor += 1;
			continue;
		}
		const sectionMetadataSource = metadataComment(line, 'schemd-section');
		if (sectionMetadataSource === undefined) fail('Expected a schemd-section metadata comment.', cursor + 1, sourceName);
		const sectionLine = cursor + 1;
		const fields = parseMetadataFields(sectionMetadataSource, sectionLine, sourceName);
		const id = identifierField(fields, 'id', sectionLine, sourceName);
		if (sectionIds.has(id)) fail(`Duplicate section id "${id}".`, sectionLine, sourceName);
		sectionIds.add(id);
		cursor += 1;
		const blockStart = cursor;
		while (cursor < lines.length && lines[cursor].trim() !== '<!-- /schemd-section -->') cursor += 1;
		if (cursor >= lines.length) fail(`Section "${id}" is missing its closing comment.`, sectionLine, sourceName);
		const blocks = parseBlocks(lines.slice(blockStart, cursor), blockStart + 1, id, sourceName);
		if (blocks.length === 0) fail(`Section "${id}" must contain content.`, sectionLine, sourceName);
		sections.push({
			metadata: {
				id,
				eyebrow: requiredField(fields, 'eyebrow', sectionLine, sourceName),
				title: requiredField(fields, 'title', sectionLine, sourceName)
			},
			position: position(sectionLine),
			blocks
		});
		cursor += 1;
	}
	if (sections.length === 0) fail('Document must contain at least one section.', 1, sourceName);
	return { metadata, sections, sourceName };
}

export function escapeHtml(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

function isSafeHref(href: string): boolean {
	return SAFE_LINK_PREFIXES.some((prefix) => href.startsWith(prefix));
}

function renderInline(nodes: readonly InlineNode[]): string {
	return nodes.map((node) => {
		switch (node.kind) {
			case 'text': return escapeHtml(node.value);
			case 'code': return `<code>${escapeHtml(node.value)}</code>`;
			case 'strong': return `<strong>${renderInline(node.children)}</strong>`;
			case 'emphasis': return `<em>${renderInline(node.children)}</em>`;
			case 'link': {
				const label = renderInline(node.children);
				if (!isSafeHref(node.href)) return `${label} <span class="unsafe-link">[unsafe link removed]</span>`;
				const external = node.href.startsWith('https://');
				return `<a href="${escapeHtml(node.href)}"${external ? ' rel="noreferrer"' : ''}>${label}</a>`;
			}
		}
	}).join('');
}

type CodeTokenKind = 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'punctuation';
interface CodeToken { readonly kind: CodeTokenKind; readonly value: string }

function isWordCharacter(character: string): boolean {
	return (character >= 'a' && character <= 'z') || (character >= 'A' && character <= 'Z') ||
		(character >= '0' && character <= '9') || character === '_' || character === '-';
}

export function tokenizeCode(value: string): readonly CodeToken[] {
	const tokens: CodeToken[] = [];
	let index = 0;
	while (index < value.length) {
		const character = value[index];
		if ((character === '/' && value[index + 1] === '/') || (character === '#' && value[index + 1] === ' ')) {
			const end = value.indexOf('\n', index);
			const boundary = end < 0 ? value.length : end;
			tokens.push({ kind: 'comment', value: value.slice(index, boundary) });
			index = boundary;
			continue;
		}
		if (character === '"' || character === "'") {
			let end = index + 1;
			while (end < value.length) {
				if (value[end] === character && value[end - 1] !== '\\') { end += 1; break; }
				end += 1;
			}
			tokens.push({ kind: 'string', value: value.slice(index, end) });
			index = end;
			continue;
		}
		if (character >= '0' && character <= '9') {
			let end = index + 1;
			while (end < value.length && ((value[end] >= '0' && value[end] <= '9') || value[end] === '.')) end += 1;
			tokens.push({ kind: 'number', value: value.slice(index, end) });
			index = end;
			continue;
		}
		if (isWordCharacter(character)) {
			let end = index + 1;
			while (end < value.length && isWordCharacter(value[end])) end += 1;
			const word = value.slice(index, end);
			tokens.push({ kind: CODE_KEYWORDS.has(word) ? 'keyword' : 'plain', value: word });
			index = end;
			continue;
		}
		if ('{}[]():;,.=<>+-*'.includes(character)) tokens.push({ kind: 'punctuation', value: character });
		else tokens.push({ kind: 'plain', value: character });
		index += 1;
	}
	return tokens;
}

function renderCode(value: string): string {
	return tokenizeCode(value).map((token) => token.kind === 'plain' ? escapeHtml(token.value) : `<span class="tok-${token.kind}">${escapeHtml(token.value)}</span>`).join('');
}

function renderBlock(block: DocumentationBlock, options: RenderDocumentationOptions): string {
	switch (block.kind) {
		case 'paragraph': return `<p>${renderInline(block.children)}</p>`;
		case 'heading': return `<h3 id="${escapeHtml(block.id)}">${renderInline(block.children)}</h3>`;
		case 'list': {
			const tag = block.ordered ? 'ol' : 'ul';
			return `<${tag}>${block.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${tag}>`;
		}
		case 'callout': return `<aside class="doc-callout">${renderInline(block.children)}</aside>`;
		case 'table': return `<div class="table-scroll" role="region" aria-label="Scrollable data table" tabindex="0"><table><thead><tr>${block.headers.map((cell) => `<th scope="col">${renderInline(cell)}</th>`).join('')}</tr></thead><tbody>${block.rows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
		case 'code': {
			const source = `<div class="doc-code"><div class="doc-code__bar"><span>${escapeHtml(block.language)}</span><span>${escapeHtml(block.id)}</span></div><pre tabindex="0" role="region" aria-label="${escapeHtml(block.language)} code example"><code class="language-${escapeHtml(block.language)}">${renderCode(block.value)}</code></pre></div>`;
			if (block.language !== 'schemd' || !options.renderSchemd) return source;
			return `${source}<figure class="doc-diagram"><div class="schematic-host">${options.renderSchemd(block)}</div><figcaption>Compiled by the selected @schemd/core release during server rendering.</figcaption></figure>`;
		}
	}
}

export function renderDocumentation(ast: DocumentationAst, options: RenderDocumentationOptions = {}): string {
	return ast.sections.map((section) => `<section class="doc-section" id="${escapeHtml(section.metadata.id)}"><p class="eyebrow">${escapeHtml(section.metadata.eyebrow)}</p><h2>${escapeHtml(section.metadata.title)}</h2><div class="doc-prose">${section.blocks.map((block) => renderBlock(block, options)).join('')}</div></section>`).join('');
}

export function documentationToc(ast: DocumentationAst): readonly TocEntry[] {
	const entries: TocEntry[] = [];
	for (const section of ast.sections) {
		entries.push({ id: section.metadata.id, title: section.metadata.title, depth: 2 });
		for (const block of section.blocks) if (block.kind === 'heading') entries.push({ id: block.id, title: inlineText(block.children), depth: 3 });
	}
	return entries;
}

export function documentationPlainText(ast: DocumentationAst): string {
	const values = [ast.metadata.label, ast.metadata.title, ast.metadata.summary, ast.metadata.category];
	for (const section of ast.sections) {
		values.push(section.metadata.eyebrow, section.metadata.title);
		for (const block of section.blocks) {
			if (block.kind === 'code') values.push(block.value);
			else if (block.kind === 'table') {
				for (const cell of block.headers) values.push(inlineText(cell));
				for (const row of block.rows) for (const cell of row) values.push(inlineText(cell));
			} else if (block.kind === 'list') for (const item of block.items) values.push(inlineText(item));
			else values.push(inlineText(block.children));
		}
	}
	return values.join(' ');
}
