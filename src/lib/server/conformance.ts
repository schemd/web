/**
 * Conformance: every documented diagram, checked against the compiler's own
 * design rules.
 *
 * A checker demonstrated on toy fixtures proves nothing. This runs
 * `verifyNetlist` over the entire published corpus — every `schemd` fence in
 * every documentation page — and publishes the tally, so the rules are
 * evidenced on real material that readers can open in the playground.
 *
 * Results are computed once per process from the same sources the gallery uses.
 */
import {
	inspectSchematic,
	parseSchematic,
	parseSchematicFence,
	SCHEMATIC_RULES,
	type SchematicDiagnostic,
	type SchematicRuleCode
} from '@schemd/core';
import { encodeWorkspaceState } from '$lib/state-uri';
import { latestRawSources } from './versions';
import { fencedDiagrams } from '$lib/schemd-fence';

/**
 * Documentation deliberately contains diagrams that break rules — a page that
 * teaches `shorted-supply` must show a shorted supply, and a component
 * reference shows primitives with nothing wired to them. Those are declared, so
 * the report can separate a demonstration from a defect:
 *
 *   `<!-- schemd-expect: shorted-supply -->` immediately before a fence
 *   `<!-- schemd-expect-page: unconnected-component -->` anywhere in the page
 */
const PAGE_EXPECT = /<!--\s*schemd-expect-page:\s*([^>]*?)\s*-->/g;
const FENCE_EXPECT = /<!--\s*schemd-expect:\s*([^>]*?)\s*-->\s*$/;

/** One documented diagram and what the rules said about it. */
export interface ConformanceEntry {
	readonly id: string;
	readonly title: string;
	/** Documentation page slug the diagram lives on. */
	readonly doc: string;
	readonly source: string;
	/** Playground deep link, so a reader can open and edit the diagram. */
	readonly code: string;
	/** Diagnostics the page did not declare as expected. */
	readonly diagnostics: readonly SchematicDiagnostic[];
	/** Diagnostics the page declared as intentional demonstrations. */
	readonly expected: readonly SchematicDiagnostic[];
	/** Worst unexpected severity present, or `clean`. */
	readonly verdict: 'clean' | 'info' | 'warning' | 'error';
}

/** The corpus-wide result. */
export interface ConformanceReport {
	readonly entries: readonly ConformanceEntry[];
	readonly totals: {
		readonly diagrams: number;
		readonly clean: number;
		readonly errors: number;
		readonly warnings: number;
		readonly infos: number;
		/** Diagrams whose only findings were declared demonstrations. */
		readonly demonstrations: number;
	};
	/** How often each rule fired across the corpus, highest first. */
	readonly byRule: readonly {
		readonly code: SchematicRuleCode;
		readonly severity: string;
		readonly summary: string;
		readonly count: number;
	}[];
}

const docSlug = (path: string): string => path.split('/').pop()!.replace(/\.md$/, '');

/** Worst severity wins: an error outranks a warning outranks a note. */
function verdictOf(diagnostics: readonly SchematicDiagnostic[]): ConformanceEntry['verdict'] {
	if (diagnostics.some((entry) => entry.severity === 'error')) return 'error';
	if (diagnostics.some((entry) => entry.severity === 'warning')) return 'warning';
	if (diagnostics.length > 0) return 'info';
	return 'clean';
}

let cache: ConformanceReport | undefined;

/**
 * Inspect every documented diagram (cached per process).
 *
 * A fence that fails to *compile* is already a documentation build failure, so
 * it is skipped here rather than reported twice.
 */
export function loadConformance(): ConformanceReport {
	if (cache) return cache;

	const entries: ConformanceEntry[] = [];
	const ruleCounts = new Map<SchematicRuleCode, number>();

	for (const [path, raw] of Object.entries(latestRawSources())) {
		const slug = docSlug(path);
		if (slug === 'tone1' || slug === 'tone2') continue;
		const pageExpected = new Set(
			[...raw.matchAll(PAGE_EXPECT)].flatMap((match) =>
				match[1]!.split(',').map((code) => code.trim())
			)
		);
		for (const { spec, source, offset, ordinal } of fencedDiagrams(raw)) {
			const fence = parseSchematicFence(spec);
			if (!fence) continue;
			const index = ordinal;
			const preamble = raw.slice(0, offset);
			const fenceExpected = new Set([
				...pageExpected,
				...(FENCE_EXPECT.exec(preamble.trimEnd())?.[1]
					?.split(',')
					.map((code) => code.trim()) ?? [])
			]);
			try {
				const { diagnostics } = inspectSchematic(parseSchematic(source, fence));
				const expected = diagnostics.filter((entry) => fenceExpected.has(entry.code));
				const unexpected = diagnostics.filter((entry) => !fenceExpected.has(entry.code));
				for (const diagnostic of unexpected) {
					ruleCounts.set(diagnostic.code, (ruleCounts.get(diagnostic.code) ?? 0) + 1);
				}
				entries.push({
					id: `${slug}-${index}`,
					title: fence.title,
					doc: slug,
					source,
					code: encodeWorkspaceState(source),
					diagnostics: unexpected,
					expected,
					verdict: verdictOf(unexpected)
				});
			} catch {
				/* Compilation failures are the documentation build's business. */
			}
		}
	}

	const byRule = [...ruleCounts.entries()]
		.map(([code, count]) => ({
			code,
			severity: SCHEMATIC_RULES[code].severity,
			summary: SCHEMATIC_RULES[code].summary,
			count
		}))
		.sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));

	cache = {
		entries,
		byRule,
		totals: {
			diagrams: entries.length,
			clean: entries.filter((entry) => entry.verdict === 'clean').length,
			demonstrations: entries.filter(
				(entry) => entry.verdict === 'clean' && entry.expected.length > 0
			).length,
			errors: entries.filter((entry) => entry.verdict === 'error').length,
			warnings: entries.filter((entry) => entry.verdict === 'warning').length,
			infos: entries.filter((entry) => entry.verdict === 'info').length
		}
	};
	return cache;
}
