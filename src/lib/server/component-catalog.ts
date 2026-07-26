/**
 * Canonical component catalog — one compiling example for **every** primitive in
 * `@schemd/core`'s vocabulary.
 *
 * The catalog is generated from the exported `COMPONENT_KINDS` registry, so it is
 * complete by construction: when the compiler adds a primitive it appears here
 * automatically (and the coverage test fails until it compiles). This is what
 * lets `/coverage` report 100% honestly rather than counting whichever kinds the
 * prose docs happen to mention.
 */
import { COMPONENT_KINDS } from '@schemd/core';
import { encodeWorkspaceState } from '$lib/state-uri';
import { groupOfKind } from './kinds';

/** One demonstrable primitive: its kind, category, source, and openable link. */
export interface CatalogEntry {
	readonly kind: string;
	readonly group: string;
	readonly source: string;
	readonly width: number;
	readonly height: number;
	/** URI-safe base64 of the source for a `?code=` playground deep link. */
	readonly code: string;
}

/** Kinds whose minimal declaration needs required options to compile. */
const SPECIAL_OPTIONS: Readonly<Record<string, string>> = {
	ic: '[left="a,b" right="y"]'
};

const COLORS = ['amber', 'blue', 'cyan', 'purple', 'slate', 'emerald'] as const;
const CATALOG_WIDTH = 380;
const CATALOG_HEIGHT = 240;

function declarationFor(kind: string, index: number): string {
	const color = COLORS[index % COLORS.length];
	const options = SPECIAL_OPTIONS[kind];
	return `${kind}:N1 "${kind}" at (190, 120) #${color}${options ? ` ${options}` : ''}`;
}

/** One catalog entry per exported kind, in the compiler's declaration order. */
export const COMPONENT_CATALOG: readonly CatalogEntry[] = COMPONENT_KINDS.map((kind, index) => {
	const source = declarationFor(kind, index);
	return {
		kind,
		group: groupOfKind(kind) ?? 'other',
		source,
		width: CATALOG_WIDTH,
		height: CATALOG_HEIGHT,
		code: encodeWorkspaceState(source)
	};
});

/** The set of kinds the catalog demonstrates — every kind, by construction. */
export const CATALOG_KINDS: ReadonlySet<string> = new Set(
	COMPONENT_CATALOG.map((entry) => entry.kind)
);
