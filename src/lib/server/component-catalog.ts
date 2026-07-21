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
import {
	PASSIVE_KINDS,
	ANALOG_KINDS,
	ELECTRICAL_COMPONENT_KINDS,
	CLASSICAL_GATE_KINDS,
	DIGITAL_COMPONENT_KINDS,
	QUANTUM_GATE_KINDS,
	QUANTUM_SPECIAL_KINDS,
	UML_COMPONENT_KINDS,
	COMPONENT_KINDS
} from '@schemd/core';
import { encodeWorkspaceState } from '$lib/state-uri';

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

/** Category label for each kind, resolved from the exported registries. */
const GROUP_BY_KIND = new Map<string, string>();
for (const [group, kinds] of [
	['passive', PASSIVE_KINDS],
	['analog', ANALOG_KINDS],
	['electrical', ELECTRICAL_COMPONENT_KINDS],
	['logic', CLASSICAL_GATE_KINDS],
	['digital', DIGITAL_COMPONENT_KINDS],
	['quantum', QUANTUM_GATE_KINDS],
	['quantum systems', QUANTUM_SPECIAL_KINDS],
	['uml', UML_COMPONENT_KINDS],
	['ic', ['ic']]
] as const) {
	for (const kind of kinds) GROUP_BY_KIND.set(kind, group);
}

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
		group: GROUP_BY_KIND.get(kind) ?? 'other',
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
