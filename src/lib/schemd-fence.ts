/**
 * Finding `schemd` fences in markdown.
 *
 * Four modules carried their own copy of this pattern — the gallery, the docs
 * renderer, the conformance report and the coverage report — and one of them
 * had already drifted into a different capture shape. They all answer the same
 * question, so they should ask it the same way.
 *
 * Each call builds its own regex. A shared `/g` literal carries `lastIndex`
 * between callers, so two readers interleaving over different documents can
 * silently skip fences; that is a real bug waiting on an unlucky ordering, not
 * a style preference.
 */

/** One fenced diagram found in a markdown document. */
export interface FencedDiagram {
	/** The fence's info string, e.g. `schemd bounds="800x400" title="…"`. */
	readonly spec: string;
	/** Diagram source between the fences, trimmed. */
	readonly source: string;
	/** Character offset of the fence within the document. */
	readonly offset: number;
	/** One-based position among the schemd fences in this document. */
	readonly ordinal: number;
}

/** A fresh matcher; never shared, so `lastIndex` cannot leak between readers. */
export function schemdFencePattern(): RegExp {
	return /```(schemd[^\n]*)\n([\s\S]*?)\n```/g;
}

/**
 * Every schemd fence in a markdown document, in source order.
 *
 * @param markdown - Raw document text.
 */
export function* fencedDiagrams(markdown: string): Generator<FencedDiagram> {
	let ordinal = 0;
	for (const match of markdown.matchAll(schemdFencePattern())) {
		ordinal += 1;
		yield {
			spec: match[1]!.trim(),
			source: match[2]!.trim(),
			offset: match.index ?? 0,
			ordinal
		};
	}
}
