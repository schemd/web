import { compileSchematic, type SchematicCompilationMetrics } from '@schemd/core';
import { error } from '@sveltejs/kit';
import { interactiveSchematicSvg } from '$lib/server/interactive-svg';
import {
	getSimulation,
	publicSimulation,
	SIMULATIONS,
	SIMULATION_VERSION,
	SUPPORTED_SIMULATION_VERSION,
	type PublicSimulationDefinition,
	type SimulationVersion
} from './manifest';

export interface SimulationPagePayload {
	readonly version: SimulationVersion;
	readonly definition: PublicSimulationDefinition;
	readonly svg: string;
	readonly compileMetrics: SchematicCompilationMetrics;
}

export function assertSimulationVersion(versionValue: string): SimulationVersion {
	if (versionValue !== SUPPORTED_SIMULATION_VERSION) {
		error(404, `Simulation compiler ${versionValue} is not available.`);
	}
	return SIMULATION_VERSION;
}

export function simulationIndexData(versionValue: string): {
	readonly version: SimulationVersion;
	readonly simulations: readonly PublicSimulationDefinition[];
} {
	const version = assertSimulationVersion(versionValue);
	return {
		version,
		simulations: SIMULATIONS.map(publicSimulation)
	};
}

export function simulationPageData(versionValue: string, id: string): SimulationPagePayload {
	const version = assertSimulationVersion(versionValue);
	const definition = getSimulation(id);
	if (!definition) error(404, `Simulation ${id} is not available.`);

	const compiled = compileSchematic(definition.source, {
		bounds: definition.bounds,
		title: definition.title,
		mode: 'full',
		semanticHooks: ['nodes', 'ports', 'wires'],
		idPrefix: `simulation-${version.id}-${definition.id}`
	});

	return {
		version,
		definition: publicSimulation(definition),
		svg: interactiveSchematicSvg(compiled.svg),
		compileMetrics: compiled.metrics
	};
}
