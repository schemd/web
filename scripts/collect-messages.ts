/** Rebuild the English message inventory and its route sections after editing interface copy. */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';
import ts from 'typescript';
import { format } from 'prettier';
import prettierConfig from '../prettier.config.js';
import { messageKey } from '../src/lib/i18n/message-key.ts';

const inventory = new Map<string, Set<string>>();
function group(file: string): string {
	const route = /^src\/routes\/([^/]+)/.exec(file)?.[1];
	if (route) return route.startsWith('+') ? 'home' : route;
	if (/\/sims\/|\/labs\/|simulation|lab-manifest|lab-model/.test(file)) return 'simulations';
	if (/\/server\/components\.ts$/.test(file)) return 'components';
	if (/\/server\/templates\.ts$/.test(file)) return 'templates';
	return 'global';
}
function add(value: string, file: string, required = false): void {
	const source = value.replace(/\s+/g, ' ').trim();
	if (
		!required &&
		(!source ||
			!/[A-Za-z]/.test(source) ||
			source.length > 2000 ||
			/^(?:https?:|\/|[.#@]|--)/.test(source))
	)
		return;
	if (!required && !source.includes(' ') && !/^[A-Z][a-zA-Z]+[.!?:]?$/.test(source)) return;
	const groups = inventory.get(source) ?? new Set<string>();
	groups.add(
		file.startsWith('src/routes/+layout.') || file.includes('/+error.svelte')
			? 'global'
			: group(file)
	);
	if (file.endsWith('/server/components.ts')) groups.add('playground');
	inventory.set(source, groups);
}
function javascript(source: string, file: string): void {
	const ast = ts.createSourceFile(file + '.ts', source, ts.ScriptTarget.Latest, true);
	function visit(node: ts.Node): void {
		if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) add(node.text, file);
		else if (ts.isTemplateExpression(node))
			add(
				node.head.text +
					node.templateSpans.map((span, index) => `{${index}}${span.literal.text}`).join(''),
				file
			);
		ts.forEachChild(node, visit);
	}
	visit(ast);
}
function scan(directory: string): void {
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const file = join(directory, entry.name);
		if (entry.isDirectory() && !['assets', 'content', 'i18n'].includes(entry.name)) scan(file);
		else if (
			entry.isFile() &&
			/\.(?:svelte|ts)$/.test(file) &&
			!/(?:test|\.d)\.ts$/.test(file) &&
			!file.includes('/message-catalog.ts')
		) {
			const source = readFileSync(file, 'utf8');
			if (file.endsWith('.svelte')) {
				// Parse validates the source; TypeScript's scanner also finds messages inside markup expressions.
				const ast = parse(source, { modern: true });
				function visit(value: unknown): void {
					if (!value || typeof value !== 'object') return;
					if (Array.isArray(value)) {
						value.forEach(visit);
						return;
					}
					const node = value as {
						type?: string;
						callee?: { name?: string };
						arguments?: { type?: string; value?: unknown }[];
					};
					if (
						node.type === 'CallExpression' &&
						node.callee?.name === 't' &&
						typeof node.arguments?.[0]?.value === 'string'
					)
						add(node.arguments[0].value, file, true);
					for (const [key, child] of Object.entries(value))
						if (!['loc', 'metadata'].includes(key)) visit(child);
				}
				visit(ast);
				if (ast.instance) {
					const content = ast.instance.content;
					if (
						!('start' in content) ||
						typeof content.start !== 'number' ||
						!('end' in content) ||
						typeof content.end !== 'number'
					)
						throw new Error(`Missing script source range: ${file}`);
					javascript(source.slice(content.start, content.end), file);
				}
			} else javascript(source, file);
		}
	}
}
export async function collectMessages(): Promise<void> {
	inventory.clear();
	scan('src');
	for (const label of ['left', 'right', 'top', 'bottom', 'electrical', 'digital', 'quantum', 'uml'])
		add(label, 'src/lib/shared.ts', true);
	// A collision must fail the build, never silently display an unrelated message.
	const keys = new Map<string, string>();
	for (const source of inventory.keys()) {
		const key = messageKey(source);
		if (keys.has(key) && keys.get(key) !== source)
			throw new Error(`Message key collision: ${source}`);
		keys.set(key, source);
	}
	const output = Object.fromEntries(
		[...inventory]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, groups]) => [key, [...groups].sort()])
	);
	writeFileSync(
		'src/lib/server/messages.en.json',
		await format(JSON.stringify(output), { ...prettierConfig, parser: 'json' })
	);
	console.info(`Collected ${inventory.size} interface messages.`);
}
if (import.meta.main) await collectMessages();
