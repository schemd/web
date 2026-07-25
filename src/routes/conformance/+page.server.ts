import type { PageServerLoad } from './$types';
import { loadConformance } from '$lib/server/conformance';

/** The published corpus, checked against the compiler's own design rules. */
export const load: PageServerLoad = async () => {
	const report = loadConformance();
	return {
		totals: report.totals,
		byRule: report.byRule,
		/* Only diagrams with something to say are listed; the clean majority is
		   represented by the tally. */
		flagged: report.entries.filter((entry) => entry.verdict !== 'clean'),
		demonstrations: report.entries.filter(
			(entry) => entry.verdict === 'clean' && entry.expected.length > 0
		)
	};
};
