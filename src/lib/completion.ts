/**
 * Source completion for the schemd editor.
 *
 * The playground already reads the entire vocabulary out of the installed
 * compiler — every component kind, semantic colour and orientation — but the
 * editor made you remember it. This resolves what the caret is in the middle of
 * typing and what could legally finish it.
 *
 * Pure and DOM-free so the grammar rules can be tested directly; the component
 * owns only the popup and the insertion.
 */

/** One option a kind accepts, from `@schemd/core/schema`: its name and, for an enum, its values. */
export interface CompletionOption {
	readonly name: string;
	readonly values: readonly string[];
}

export interface CompletionVocabulary {
	readonly kinds: readonly string[];
	readonly colors: readonly string[];
	readonly orientations: readonly string[];
	/** Each kind's options, so the brackets after a declaration offer only what it accepts. */
	readonly options?: Readonly<Record<string, readonly CompletionOption[]>>;
	/** Each declared part's terminals, by ID, from the last successful compile. */
	readonly ports?: Readonly<Record<string, readonly string[]>>;
}

export type CompletionKind = 'kind' | 'color' | 'orientation' | 'option' | 'value' | 'port';

export interface CompletionContext {
	/** Candidates in vocabulary order, best (shortest) match first. */
	readonly items: readonly string[];
	/** Absolute character range the accepted item replaces. */
	readonly from: number;
	readonly to: number;
	readonly kind: CompletionKind;
}

/** Beyond this the list stops being a hint and starts being a wall of text. */
const MAX_ITEMS = 8;

/**
 * `#am` → the colours starting with "am"; a bare `#` → every colour. Matching is
 * prefix-based and case-insensitive; an exact single match offers nothing, so it
 * is suppressed rather than shown as a no-op.
 */
function matches(vocabulary: readonly string[], prefix: string): string[] {
	const needle = prefix.toLowerCase();
	const hits = vocabulary
		.filter((entry) => entry.toLowerCase().startsWith(needle))
		.slice(0, MAX_ITEMS);
	if (hits.length === 1 && hits[0]?.toLowerCase() === needle) return [];
	return hits;
}

/**
 * What can complete the token the caret sits in.
 *
 * @param source - Full editor text.
 * @param caret - Absolute caret offset.
 * @param vocabulary - Kinds, colours and orientations from `@schemd/core`.
 * @returns The completion context, or `undefined` where nothing applies.
 */
export function completionAt(
	source: string,
	caret: number,
	vocabulary: CompletionVocabulary
): CompletionContext | undefined {
	if (caret < 0 || caret > source.length) return undefined;
	const lineStart = source.lastIndexOf('\n', caret - 1) + 1;
	const head = source.slice(lineStart, caret);
	/* Comments and string labels are prose, not grammar. */
	if (head.trimStart().startsWith('//')) return undefined;
	let quoted = false;
	let escaped = false;
	let bracketStart = -1;
	for (let index = 0; index < head.length; index += 1) {
		const character = head[index];
		if (escaped) {
			escaped = false;
			continue;
		}
		if (character === '\\' && quoted) {
			escaped = true;
			continue;
		}
		if (character === '"') quoted = !quoted;
		if (!quoted && character === '[') bracketStart = index;
		if (!quoted && character === ']') bracketStart = -1;
	}
	if (quoted) return undefined;

	/* A declaration's own kind decides which options and values its brackets accept. */
	const declared = /^\s*([A-Za-z][A-Za-z-]*):/.exec(head)?.[1]?.toLowerCase();
	const accepted =
		declared !== undefined &&
		vocabulary.options !== undefined &&
		Object.hasOwn(vocabulary.options, declared)
			? vocabulary.options[declared]
			: undefined;
	/* Inside an unclosed bracket on a declaration line, outside any quotes. */
	const bracket =
		!Array.isArray(accepted) || bracketStart < 0 ? undefined : head.slice(bracketStart + 1);
	if (accepted !== undefined && bracket !== undefined) {
		const value = /(?:^|\s)([a-z][a-z-]*)=([A-Za-z0-9_-]*)$/.exec(bracket);
		if (value) {
			const option = accepted.find((entry) => entry.name === value[1]);
			const prefix = value[2] ?? '';
			const items = option === undefined ? [] : matches(option.values, prefix);
			return items.length
				? { items, from: caret - prefix.length, to: caret, kind: 'value' }
				: undefined;
		}
		const prefix = /(?:^|\s)([a-z-]*)$/.exec(bracket)?.[1];
		if (prefix !== undefined) {
			const written = new Set([...bracket.matchAll(/([a-z][a-z-]*)=/g)].map((match) => match[1]));
			const items = matches(
				accepted.map((entry) => entry.name).filter((entry) => !written.has(entry)),
				prefix
			);
			if (items.length) return { items, from: caret - prefix.length, to: caret, kind: 'option' };
		}
		return undefined;
	}

	/* `ID.` offers the part's real terminals, known from the last compile. */
	const port = /(?:^\s*|->\s*)([A-Za-z][A-Za-z0-9_-]*)\.([A-Za-z0-9_+-]*)$/.exec(head);
	if (port && vocabulary.ports !== undefined) {
		const prefix = port[2] ?? '';
		const items = matches(
			Object.hasOwn(vocabulary.ports, port[1]!) ? vocabulary.ports[port[1]!]! : [],
			prefix
		);
		return items.length
			? { items, from: caret - prefix.length, to: caret, kind: 'port' }
			: undefined;
	}

	const orientation = /\[[^\]]*\borientation=([A-Za-z]*)$/.exec(head);
	if (orientation) {
		const prefix = orientation[1] ?? '';
		const items = matches(vocabulary.orientations, prefix);
		return items.length
			? { items, from: caret - prefix.length, to: caret, kind: 'orientation' }
			: undefined;
	}

	const color = /#([A-Za-z]*)$/.exec(head);
	if (color) {
		const prefix = color[1] ?? '';
		const items = matches(vocabulary.colors, prefix);
		return items.length
			? { items, from: caret - prefix.length, to: caret, kind: 'color' }
			: undefined;
	}

	/* A component declaration always opens its line: `resistor:R1 …`. */
	const kind = /^\s*([A-Za-z][A-Za-z-]*)?$/.exec(head);
	if (kind) {
		const prefix = kind[1] ?? '';
		if (prefix === '') return undefined;
		const items = matches(vocabulary.kinds, prefix);
		return items.length
			? { items, from: caret - prefix.length, to: caret, kind: 'kind' }
			: undefined;
	}

	return undefined;
}

/** Text inserted when an item is accepted: kinds carry their `:`, options their `=`. */
export function completionInsertion(item: string, kind: CompletionKind): string {
	if (kind === 'kind') return `${item}:`;
	if (kind === 'option') return `${item}=`;
	return item;
}
