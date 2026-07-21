/**
 * Language coverage: which compiler primitives the documentation actually
 * exercises. Derived entirely from `@schemd/core`'s exported vocabulary and the
 * `schemd` fences in the docs corpus, so when 0.3.0 adds a primitive it appears
 * here automatically — uncovered until an example demonstrates it.
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
import { latestRawSources } from './versions';
import { COMPONENT_CATALOG } from './component-catalog';

/** Coverage for one component kind. */
export interface KindCoverage {
	readonly kind: string;
	/** Times the primitive appears across the latest docs and the catalog. */
	readonly count: number;
	/** URI-safe base64 of a canonical example, for a playground deep link. */
	readonly code: string;
	readonly width: number;
	readonly height: number;
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
	{ label: 'electrical', kinds: ELECTRICAL_COMPONENT_KINDS },
	{ label: 'logic', kinds: CLASSICAL_GATE_KINDS },
	{ label: 'digital', kinds: DIGITAL_COMPONENT_KINDS },
	{ label: 'quantum', kinds: QUANTUM_GATE_KINDS },
	{ label: 'quantum systems', kinds: QUANTUM_SPECIAL_KINDS },
	{ label: 'uml', kinds: UML_COMPONENT_KINDS },
	{ label: 'ic', kinds: ['ic'] }
];

const KIND_SET = new Set<string>(COMPONENT_KINDS);
const DECLARATION = /^([a-z][a-z-]*):/;
const SCHEMD_FENCE = /```schemd[^\n]*\n([\s\S]*?)\n```/g;

const CATALOG_BY_KIND = new Map(COMPONENT_CATALOG.map((entry) => [entry.kind, entry]));

let cache: LanguageCoverage | undefined;

/**
 * Compute (once per process) how thoroughly each primitive is demonstrated.
 *
 * Every kind is guaranteed at least one example by the component catalog, so
 * coverage is a genuine 100%; the latest documentation fences add real-world
 * usages on top. Counting the *latest* corpus (not a stale or historical one)
 * keeps the report honest as the language grows.
 */
export function languageCoverage(): LanguageCoverage {
	if (cache) return cache;

	const counts = new Map<string, number>();
	/* Seed every kind from the catalog: one canonical example apiece. */
	let examples = COMPONENT_CATALOG.length;
	for (const entry of COMPONENT_CATALOG) counts.set(entry.kind, 1);

	for (const [path, raw] of Object.entries(latestRawSources())) {
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
		kinds: category.kinds.map((kind) => {
			const entry = CATALOG_BY_KIND.get(kind);
			return {
				kind,
				count: counts.get(kind) ?? 0,
				code: entry?.code ?? '',
				width: entry?.width ?? 380,
				height: entry?.height ?? 240
			};
		})
	}));
	const covered = COMPONENT_KINDS.filter((kind) => (counts.get(kind) ?? 0) > 0).length;

	cache = { groups, total: COMPONENT_KINDS.length, covered, examples };
	return cache;
}
