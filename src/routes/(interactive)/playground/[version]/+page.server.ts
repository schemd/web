import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { error } from '@sveltejs/kit';
import { CORE_METRICS } from '$lib/generated/core-metrics';
import { fenceInfo, PLAYGROUND_EXAMPLES } from '$lib/playground/examples';
import { getVersion, VERSIONS } from '$lib/versioning/manifest';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ params }) => {
	const version = getVersion(params.version);
	if (!version) error(404, `Playground compiler ${params.version} is not available.`);
	const example = PLAYGROUND_EXAMPLES[0];
	const fence = parseSchematicFence(fenceInfo(example), example.title);
	if (!fence) error(500, 'The default playground fence is invalid.');
	const compiled = compileSchematic(example.source, { ...fence, mode: 'embedded-css', idPrefix: 'playground-initial' });
	return {
		version,
		versions: VERSIONS,
		examples: PLAYGROUND_EXAMPLES,
		initialExample: example,
		initialSvg: compiled.svg,
		initialMetrics: compiled.metrics,
		maximumCharacters: CORE_METRICS.limits.sourceCharacters
	};
};
