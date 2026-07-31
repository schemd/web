/**
 * Rewriting a declaration's position without disturbing anything else on it.
 *
 * Dragging a component in the preview has to edit *source*, not a canvas, and
 * the edit has to be surgical: the label, the colour, the options, the comment
 * someone left at the end of the line, and their own spacing all survive
 * byte-for-byte. Only the numbers move.
 *
 * Two forms need handling, because 0.5 gave declarations two ways to state a
 * position. An `at (x, y)` line takes new coordinates. A relative line —
 * `right-of VIN by 190` — takes a new `by` distance instead, so the author's
 * *intent* survives the drag rather than being flattened into coordinates the
 * moment they nudge something. That is the whole point: direct manipulation
 * that edits the relationship, not the arithmetic.
 *
 * Everything here is a pure string function so it can be tested without a DOM.
 * The pointer handling lives in the playground; this module never sees an event.
 *
 * (The spec proposed putting these in `editor-operations.ts`. That file is
 * grammar-agnostic text editing — indent, comment, find — and these functions
 * know the schemd declaration grammar, so they live apart rather than blurring
 * what that module is.)
 */

/** Where a declaration's position came from, and what an edit did to it. */
export type PlacementEdit =
	| { readonly kind: 'absolute'; readonly text: string; readonly x: number; readonly y: number }
	| { readonly kind: 'relative'; readonly text: string; readonly gap: number }
	| { readonly kind: 'unsupported'; readonly reason: string };

/** The `at (x, y)` span, captured so the author's spacing can be put back. */
const ABSOLUTE = /(\bat\s*\(\s*)(-?\d+(?:\.\d+)?)(\s*,\s*)(-?\d+(?:\.\d+)?)(\s*\))/;

/** `kind:ID "label" ` — everything before the position clause. */
const DECLARATION_HEAD = /^(\s*[A-Za-z][A-Za-z0-9_-]*:[A-Za-z][A-Za-z0-9_-]*\s+"[^"]*"\s+)/;

/** One direction relation, with its optional distance. */
const DIRECTION =
	/^(right-of|left-of|above|below)\s+([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_+-]*)?)(\s+by\s+(-?\d+(?:\.\d+)?))?\s*/;

/** One alignment relation, which never carries a distance. */
const ALIGNMENT =
	/^(aligned-x|aligned-y)\s+with\s+([A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_+-]*)?)\s*/;

/** The axis defaults the compiler applies when `by` is omitted. */
export const HORIZONTAL_GAP = 160;
export const VERTICAL_GAP = 140;

/** Grid a drag settles onto, in viewBox units. */
export const SNAP_GRID = 10;

/** Round to the grid, so a drag produces numbers an author would have typed. */
export function snapToGrid(value: number, grid: number = SNAP_GRID): number {
	if (!Number.isFinite(value) || grid <= 0) return value;
	return Math.round(value / grid) * grid;
}

/**
 * Format a number the way an author writes one.
 *
 * Three decimals matches the compiler's writer, and trailing zeros are dropped
 * because nobody types `at (330.000, 150.000)`.
 */
function number(value: number): string {
	return String(Number(value.toFixed(3)));
}

/** Split one line into its head, its relation clause, and the tail after it. */
function splitRelative(
	line: string
): { head: string; relations: string; tail: string } | undefined {
	const head = line.match(DECLARATION_HEAD)?.[1];
	if (head === undefined) return undefined;
	let rest = line.slice(head.length);
	let consumed = 0;
	/* Relations are consumed from the front one at a time, the way the compiler's
	   own parser reads them. One combined pattern would need a nested quantifier
	   over the same text, which is how a lexer acquires a backtracking cliff. */
	for (;;) {
		const match = rest.match(DIRECTION) ?? rest.match(ALIGNMENT);
		if (!match) break;
		consumed += match[0].length;
		rest = rest.slice(match[0].length);
	}
	if (consumed === 0) return undefined;
	return {
		head,
		relations: line.slice(head.length, head.length + consumed),
		tail: rest
	};
}

/**
 * Move the component declared on one line to a new position.
 *
 * @param source - The whole document.
 * @param line - One-based source line, as `data-source-line` reports it.
 * @param to - Where the component should end up, in viewBox units.
 * @param from - Where it currently sits, needed to turn a drag into a distance
 *   when the declaration is relative.
 * @returns The rewritten document, or why the line could not be edited.
 */
export function moveDeclaration(
	source: string,
	line: number,
	to: { x: number; y: number },
	from: { x: number; y: number }
): PlacementEdit {
	const lines = source.split('\n');
	const index = line - 1;
	const original = lines[index];
	if (original === undefined) {
		return { kind: 'unsupported', reason: `Line ${line} is not in the document.` };
	}

	const absolute = original.match(ABSOLUTE);
	if (absolute) {
		const x = snapToGrid(to.x);
		const y = snapToGrid(to.y);
		/* Only the two captured numbers change; the separators the author typed —
		   `at(90,150)` or `at (90, 150)` — are put back exactly as found. */
		lines[index] = original.replace(ABSOLUTE, `$1${number(x)}$3${number(y)}$5`);
		return { kind: 'absolute', text: lines.join('\n'), x, y };
	}

	const parts = splitRelative(original);
	if (parts === undefined) {
		return {
			kind: 'unsupported',
			reason: `Line ${line} does not state a position this can rewrite.`
		};
	}

	const direction = parts.relations.match(DIRECTION);
	if (!direction) {
		/* Only alignments: there is no distance to adjust, and inventing a
		   direction relation would be authoring rather than editing. */
		return {
			kind: 'unsupported',
			reason: 'This component is only aligned, so it has no distance to drag.'
		};
	}

	const axis = direction[1] === 'right-of' || direction[1] === 'left-of' ? 'x' : 'y';
	const current =
		direction[4] === undefined
			? axis === 'x'
				? HORIZONTAL_GAP
				: VERTICAL_GAP
			: Number(direction[4]);
	/* Dragging away from the reference lengthens the gap; dragging toward it
	   shortens it. `left-of` and `above` measure in the opposite direction, so
	   the delta is negated for them. */
	const delta = axis === 'x' ? to.x - from.x : to.y - from.y;
	const signed = direction[1] === 'left-of' || direction[1] === 'above' ? -delta : delta;
	const gap = Math.max(0, snapToGrid(current + signed));

	const rewritten =
		direction[4] === undefined
			? parts.relations.replace(
					DIRECTION,
					(_whole, kind: string, reference: string) => `${kind} ${reference} by ${number(gap)} `
				)
			: parts.relations.replace(/(\bby\s+)(-?\d+(?:\.\d+)?)/, `$1${number(gap)}`);

	lines[index] = `${parts.head}${rewritten}${parts.tail}`;
	return { kind: 'relative', text: lines.join('\n'), gap };
}

/** One resolved placement, as `compileSchematic` reports it. */
export interface ResolvedPlacement {
	readonly line: number;
	readonly resolved: { readonly x: number; readonly y: number };
}

/**
 * Rewrite every relative declaration as the coordinates it resolved to.
 *
 * The inverse — lifting coordinates back into relations — is deliberately not
 * offered. It would have to guess which component an author meant to anchor
 * against, and a wrong guess rewrites a document into something they did not
 * write. Freezing loses intent but invents nothing.
 *
 * @param source - The whole document.
 * @param placements - `compilation.placements`, which is empty when the
 *   document already used only coordinates.
 * @returns The document with every relation replaced by `at (x, y)`.
 */
export function freezeToAbsolute(source: string, placements: readonly ResolvedPlacement[]): string {
	if (placements.length === 0) return source;
	const lines = source.split('\n');
	for (const placement of placements) {
		const index = placement.line - 1;
		const original = lines[index];
		if (original === undefined) continue;
		const parts = splitRelative(original);
		if (parts === undefined) continue;
		lines[index] =
			`${parts.head}at (${number(placement.resolved.x)}, ${number(placement.resolved.y)}) ${parts.tail}`;
	}
	return lines.join('\n');
}
