import type { PageServerLoad } from './$types';
import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { getRegistry } from '$lib/server/registry';

/** Reference workload used for the installed-version benchmark. */
const BENCH_SOURCE = `port:P0 "in" at (60, 100) #blue
resistor:R1 "R" at (200, 100) #amber
capacitor:C1 "C" at (340, 100) #cyan
nand:N1 "N" at (480, 160) #purple
ground:G1 "gnd" at (340, 220) #slate
port:P1 "out" at (600, 160) #emerald
P0.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> N1.in1 #cyan [ortho]
C1.out -> G1.in #slate [ortho]
N1.out -> P1.in #purple [ortho arrow]`;

interface Benchmark {
	readonly version: string;
	readonly medianMs: number;
	readonly svgBytes: number;
}

let benchmarkCache: Benchmark | undefined;

/** Median-of-nine timing for the installed compiler; cached per process. */
function runBenchmark(installedVersion: string): Benchmark {
	if (benchmarkCache && benchmarkCache.version === installedVersion) return benchmarkCache;
	const fence = parseSchematicFence('schemd bounds="680x340" title="Benchmark workload"');
	if (!fence) throw new Error('Unreachable: canonical benchmark fence.');
	const timings: number[] = [];
	let svgBytes = 0;
	for (let run = 0; run < 9; run += 1) {
		const startedAt = performance.now();
		const compiled = compileSchematic(BENCH_SOURCE, { ...fence, idPrefix: `bench${run}` });
		timings.push(performance.now() - startedAt);
		svgBytes = compiled.metrics.svgBytes;
	}
	timings.sort((a, b) => a - b);
	benchmarkCache = {
		version: installedVersion,
		medianMs: Math.round(timings[4]! * 1000) / 1000,
		svgBytes
	};
	return benchmarkCache;
}

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	return {
		releases: registry.releases,
		latest: registry.latest,
		live: registry.live,
		syncedAt: registry.syncedAt,
		benchmark: runBenchmark('0.2.1')
	};
};
