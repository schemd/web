/**
 * Language coverage: which compiler primitives the documentation actually
 * exercises. Derived entirely from `@schemd/core`'s exported vocabulary and the
 * `schemd` fences in the docs corpus, so when 0.3.0 adds a primitive it appears
 * here automatically — uncovered until an example demonstrates it.
 */
import {
	PASSIVE_KINDS,
	ANALOG_KINDS,
	CLASSICAL_GATE_KINDS,
	QUANTUM_GATE_KINDS,
	UML_COMPONENT_KINDS,
	COMPONENT_KINDS
} from '@schemd/core';

/** Coverage for one component kind. */
export interface KindCoverage {
	readonly kind: string;
	readonly count: number;
}

/** A category of kinds with its own coverage roll-up. */
export interface CoverageGroup {
	readonly label: string;
	readonly kinds: readonly KindCoverage[];
}

/** Whole-corpus coverage report. */
export interface LanguageCoverage {
	readonly groups: readonly CoverageGroup[];
	readonly total: number;
	readonly covered: number;
	readonly examples: number;
}

const CATEGORIES: readonly { readonly label: string; readonly kinds: readonly string[] }[] = [
	{ label: 'passive', kinds: PASSIVE_KINDS },
	{ label: 'analog', kinds: ANALOG_KINDS },
	{ label: 'logic', kinds: CLASSICAL_GATE_KINDS },
	{ label: 'quantum', kinds: QUANTUM_GATE_KINDS },
	{ label: 'uml', kinds: UML_COMPONENT_KINDS },
	{ label: 'ic', kinds: ['ic'] }
];

const KIND_SET = new Set<string>(COMPONENT_KINDS);
const DECLARATION = /^([a-z]+):/;
const SCHEMD_FENCE = /```schemd[^\n]*\n([\s\S]*?)\n```/g;

const docSources = import.meta.glob<string>('$lib/content/schemd/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

let cache: LanguageCoverage | undefined;

/** Compute (once per process) how often each primitive appears in doc examples. */
export function languageCoverage(): LanguageCoverage {
	if (cache) return cache;

	const counts = new Map<string, number>();
	let examples = 0;
	for (const [path, raw] of Object.entries(docSources)) {
		if (path.endsWith('/tone1.md') || path.endsWith('/tone2.md')) continue;
		for (const fence of raw.matchAll(SCHEMD_FENCE)) {
			examples += 1;
			for (const line of fence[1]!.split('\n')) {
				const match = DECLARATION.exec(line.trim());
				const kind = match?.[1];
				if (kind && KIND_SET.has(kind)) counts.set(kind, (counts.get(kind) ?? 0) + 1);
			}
		}
	}

	const groups = CATEGORIES.map((category) => ({
		label: category.label,
		kinds: category.kinds.map((kind) => ({ kind, count: counts.get(kind) ?? 0 }))
	}));
	const covered = COMPONENT_KINDS.filter((kind) => (counts.get(kind) ?? 0) > 0).length;

	cache = { groups, total: COMPONENT_KINDS.length, covered, examples };
	return cache;
}
