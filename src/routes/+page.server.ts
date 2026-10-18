import type { PageServerLoad } from './$types';
import { getRegistry } from '#lib/server/registry.ts';
import { landingFigures } from '#lib/server/landing.ts';
import { languageCoverage } from '#lib/server/coverage.ts';
import { loadConformance } from '#lib/server/conformance.ts';
import junction08 from '#lib/assets/figures/junction-0.8.svg?raw';

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	const coverage = languageCoverage();
	const conformance = loadConformance().totals;
	return {
		...landingFigures(),
		junction08,
		latest: registry.latest,
		/* Figures the evidence pages compute, so the proof band never drifts from them. */
		evidence: {
			kinds: coverage.total,
			diagrams: conformance.diagrams,
			clean: conformance.clean,
			releases: registry.releases.length
		}
	};
};
