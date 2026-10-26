import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'svelte/compiler';
import spanish from './messages.es.json';

function messageLiterals(directory: string): string[] {
	const result: string[] = [];
	function walk(value: unknown): void {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach(walk);
			return;
		}
		const node = value as {
			type?: string;
			callee?: { name?: string };
			arguments?: { value?: unknown }[];
		};
		if (
			node.type === 'CallExpression' &&
			node.callee?.name === 't' &&
			typeof node.arguments?.[0]?.value === 'string'
		)
			result.push(node.arguments[0].value.replace(/\s+/g, ' ').trim());
		for (const [key, child] of Object.entries(value))
			if (!['loc', 'metadata'].includes(key)) walk(child);
	}
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const file = join(directory, entry.name);
		if (entry.isDirectory() && !['content', 'assets'].includes(entry.name))
			result.push(...messageLiterals(file));
		else if (file.endsWith('.svelte')) walk(parse(readFileSync(file, 'utf8'), { modern: true }));
	}
	return result;
}

describe('interface translation coverage', () => {
	it('has a Spanish entry for every literal interface message', () => {
		const missing = [...new Set(messageLiterals('src'))].filter(
			(message) => /[A-Za-z]/.test(message) && !Object.hasOwn(spanish, message)
		);
		expect(missing).toEqual([]);
	});
	it('preserves message parameters and numeric TeX braces', () => {
		const parameters = (message: string) =>
			[...message.matchAll(/\{\d+\}/g)].map((match) => match[0]).sort();
		for (const [english, translation] of Object.entries(spanish))
			expect(parameters(translation), english).toEqual(parameters(english));
	});
});
