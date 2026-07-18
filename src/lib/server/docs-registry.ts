import { compileSchematic, parseSchematicFence } from '@schemd/core';
import {
	documentationPlainText,
	documentationToc,
	parseDocumentation,
	renderDocumentation,
	type DocumentationAst,
	type TocEntry
} from '$lib/docs/parser';
import { searchDocuments, type SearchDocument, type SearchResult } from '$lib/search';
import { getVersion, type VersionId } from '$lib/versioning/manifest';

export interface DocumentationNavigationPage {
	readonly id: string;
	readonly label: string;
	readonly title: string;
	readonly category: string;
	readonly order: number;
	readonly sections: readonly { readonly id: string; readonly title: string }[];
}

export interface DocumentationNavigationGroup {
	readonly label: string;
	readonly pages: readonly DocumentationNavigationPage[];
}

interface RegisteredDocument {
	readonly version: VersionId;
	readonly ast: DocumentationAst;
}

const rawModules = import.meta.glob<string>('/src/lib/content/docs/*/*.md', {
	eager: true,
	query: '?raw',
	import: 'default'
});

function versionFromPath(path: string): VersionId {
	const marker = '/content/docs/';
	const start = path.indexOf(marker);
	const rest = start < 0 ? '' : path.slice(start + marker.length);
	const end = rest.indexOf('/');
	const value = end < 0 ? '' : rest.slice(0, end);
	const version = getVersion(value);
	if (!version) throw new Error(`Documentation source ${path} uses unsupported version ${value || '(missing)'}.`);
	return version.id;
}

const documents = Object.entries(rawModules).map(([path, source]) => ({
	version: versionFromPath(path),
	ast: parseDocumentation(source, path)
})).sort((left, right) => left.ast.metadata.order - right.ast.metadata.order || left.ast.metadata.id.localeCompare(right.ast.metadata.id));

const documentKeys = new Set<string>();
for (const document of documents) {
	const key = `${document.version}/${document.ast.metadata.id}`;
	if (documentKeys.has(key)) throw new Error(`Duplicate documentation page ${key}.`);
	documentKeys.add(key);
}

function versionDocuments(version: VersionId): readonly RegisteredDocument[] {
	return documents.filter((document) => document.version === version);
}

export function getDocumentationAst(version: VersionId, id: string): DocumentationAst | undefined {
	return documents.find((document) => document.version === version && document.ast.metadata.id === id)?.ast;
}

export function getDocumentationNavigation(version: VersionId): readonly DocumentationNavigationGroup[] {
	const pages = versionDocuments(version).map(({ ast }) => ({
		id: ast.metadata.id,
		label: ast.metadata.label,
		title: ast.metadata.title,
		category: ast.metadata.category,
		order: ast.metadata.order,
		sections: ast.sections.map((section) => ({ id: section.metadata.id, title: section.metadata.title }))
	}));
	const groups = new Map<string, DocumentationNavigationPage[]>();
	for (const page of pages) {
		const group = groups.get(page.category) ?? [];
		group.push(page);
		groups.set(page.category, group);
	}
	return [...groups.entries()].map(([label, groupPages]) => ({ label, pages: groupPages }));
}

export function renderDocumentationPage(version: VersionId, id: string): { readonly html: string; readonly toc: readonly TocEntry[] } | undefined {
	const ast = getDocumentationAst(version, id);
	if (!ast) return undefined;
	return {
		html: renderDocumentation(ast, {
			renderSchemd(block) {
				const fence = parseSchematicFence(`schemd ${block.metadata}`, ast.metadata.title);
				if (!fence) throw new Error(`${ast.sourceName}:${block.position.line}: invalid Schemd fence metadata.`);
				return compileSchematic(block.value, {
					...fence,
					mode: 'embedded-css',
					idPrefix: `docs-${version}-${id}-${block.id}`
				}).svg;
			}
		}),
		toc: documentationToc(ast)
	};
}

const searchIndex: readonly SearchDocument[] = documents.map(({ version, ast }) => ({
	id: `${version}-${ast.metadata.id}`,
	title: ast.metadata.title,
	summary: ast.metadata.summary,
	category: ast.metadata.category,
	path: `/docs/${version}/${ast.metadata.id}`,
	text: documentationPlainText(ast)
}));

export function searchDocumentation(query: string): readonly SearchResult[] {
	return searchDocuments(searchIndex, query);
}

export function documentationPaths(): readonly string[] {
	return searchIndex.map((document) => document.path);
}

export function allDocumentationAsts(): readonly RegisteredDocument[] {
	return documents;
}
