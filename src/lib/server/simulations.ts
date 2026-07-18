import { compileSchematic } from '@schemd/core';
import { error } from '@sveltejs/kit';
import { getSimulation } from '$lib/simulations/manifest';
import { getVersion } from '$lib/versioning/manifest';
import { exposeInteractiveSvg } from './interactive-svg';

export function simulationPageData(versionValue: string, id: string) {
	const version = getVersion(versionValue);
	if (!version) error(404, `Simulation compiler ${versionValue} is not available.`);
	const definition = getSimulation(id);
	if (!definition) error(404, `Simulation ${id} is not available.`);
	const compiled = compileSchematic(definition.source, {
		bounds: definition.bounds,
		title: definition.title,
		mode: 'full',
		idPrefix: `simulation-${version.id}-${id}`
	});
	return {
		version,
		definition: {
			id: definition.id,
			domain: definition.domain,
			title: definition.title,
			summary: definition.summary,
			idea: definition.idea,
			docsPath: definition.docsPath
		},
		svg: exposeInteractiveSvg(compiled.svg)
	};
}
