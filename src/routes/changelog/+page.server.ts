import { getReleaseRegistry } from '$lib/server/release-registry';
import { BENCHMARK_METHOD, RELEASE_BENCHMARKS } from '$lib/server/benchmark-archive';
import type { PageServerLoad } from './$types';

const NOTES: Readonly<Record<string, readonly string[]>> = Object.freeze({
	'0.2.1': Object.freeze([
		'Stabilized server-native compileSchematic metrics and full semantic hook output.',
		'Published deterministic node, port, and wire datasets for delegated interaction.',
		'Expanded route validation and bounded SVG output accounting.'
	]),
	'0.2.0': Object.freeze([
		'Introduced the three-level output budget: default, embedded CSS, and full.',
		'Added UML structural and behavioral primitives to the shared parser.',
		'Promoted semantic hook configuration to the public root API.'
	]),
	'0.1.6': Object.freeze([
		'Refined orthogonal routing lanes and dense crossing limits.',
		'Calibrated passive, logic, analog, and quantum visual geometry.'
	]),
	'0.1.2': Object.freeze([
		'Added intrinsic SSR sizing and expanded math-label measurement.',
		'Introduced UML primitives and hard wire-crossing limits.'
	]),
	'0.1.1': Object.freeze([
		'Shipped the initial dependency-free renderer and component registry.',
		'Established source, component, connection, and SVG output budgets.'
	])
});

export const load: PageServerLoad = async ({ fetch, setHeaders }) => {
	const registry = await getReleaseRegistry(fetch);
	setHeaders({ 'cache-control': 'public, max-age=60, stale-while-revalidate=300' });
	return {
		registry,
		benchmarkMethod: BENCHMARK_METHOD,
		benchmarks: RELEASE_BENCHMARKS,
		timeline: registry.releases.map((release) => ({
			...release,
			notes: NOTES[release.version] ?? [
				'Registry release metadata synchronized from npm and GitHub.'
			]
		}))
	};
};
