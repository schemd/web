import type { Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { parse } from 'svelte/compiler';
import { collectMessages } from './collect-messages.ts';
import { messageKey } from '../src/lib/i18n/message-key.ts';

/** Only real message calls are transformed; examples, comments and source strings are preserved. */
export function compactMessageSource(source: string, messages: ReadonlySet<string>): string {
	const edits: { start: number; end: number; value: string }[] = [];
	function visit(value: unknown): void {
		if (!value || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			value.forEach(visit);
			return;
		}
		const node = value as {
			type?: string;
			callee?: { name?: string };
			arguments?: { value?: unknown; start: number; end: number }[];
		};
		const argument = node.arguments?.[0];
		if (
			node.type === 'CallExpression' &&
			node.callee?.name === 't' &&
			typeof argument?.value === 'string'
		) {
			const message = argument.value.replace(/\s+/g, ' ').trim();
			if (messages.has(message))
				edits.push({
					start: argument.start,
					end: argument.end,
					value: JSON.stringify(messageKey(message))
				});
		}
		for (const [key, child] of Object.entries(value))
			if (!['loc', 'metadata'].includes(key)) visit(child);
	}
	visit(parse(source, { modern: true }));
	for (const edit of edits.sort((a, b) => b.start - a.start))
		source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
	return source;
}

/** Static prose travels in the selected page catalog, with compact keys in JavaScript. */
export function compactMessages(): Plugin {
	let sources = new Set<string>();
	return {
		name: 'schemd-compact-messages',
		enforce: 'pre',
		apply: 'build',
		async buildStart() {
			await collectMessages();
			sources = new Set(
				Object.keys(JSON.parse(readFileSync('src/lib/server/messages.en.json', 'utf8')))
			);
		},
		transform(source, id) {
			if (!id.endsWith('.svelte')) return;
			const code = compactMessageSource(source, sources);
			return code === source ? undefined : { code, map: null };
		}
	};
}
