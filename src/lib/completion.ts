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

export interface CompletionVocabulary {
	readonly kinds: readonly string[];
	readonly colors: readonly string[];
	readonly orientations: readonly string[];
}

export type CompletionKind = 'kind' | 'color' | 'orientation';

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
	if ((head.match(/"/g)?.length ?? 0) % 2 === 1) return undefined;

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
	const kind = /^([A-Za-z][A-Za-z-]*)?$/.exec(head);
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

/** Text inserted when an item is accepted — kinds carry their `:` separator. */
export function completionInsertion(item: string, kind: CompletionKind): string {
	return kind === 'kind' ? `${item}:` : item;
}
