export interface ReleaseBenchmark {
	readonly version: string;
	readonly meanMilliseconds: number;
	readonly p95Milliseconds: number;
	readonly installKibibytes: number;
	readonly svgBytes: number;
}

/**
 * Reproducible release archive, sampled 2026-07-18 on Node 26.4 / arm64.
 * Each entry is 20 warmups + 250 measured parse/render passes against the
 * canonical three-node RC source. Footprint is allocated package-directory KiB.
 */
export const RELEASE_BENCHMARKS: readonly ReleaseBenchmark[] = Object.freeze([
	Object.freeze({
		version: '0.1.1',
		meanMilliseconds: 0.0746,
		p95Milliseconds: 0.1482,
		installKibibytes: 164,
		svgBytes: 3409
	}),
	Object.freeze({
		version: '0.1.2',
		meanMilliseconds: 0.1244,
		p95Milliseconds: 0.3013,
		installKibibytes: 212,
		svgBytes: 3543
	}),
	Object.freeze({
		version: '0.2.0',
		meanMilliseconds: 0.0946,
		p95Milliseconds: 0.1609,
		installKibibytes: 212,
		svgBytes: 3543
	}),
	Object.freeze({
		version: '0.2.1',
		meanMilliseconds: 0.0883,
		p95Milliseconds: 0.135,
		installKibibytes: 240,
		svgBytes: 3543
	})
]);

export const BENCHMARK_METHOD =
	'Node 26.4 · arm64 · 20 warmups · 250 passes · canonical 3-node RC source';
