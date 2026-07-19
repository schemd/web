import type { SchematicCompilationMetrics } from '@schemd/core';
import type { PublicSimulationDefinition, SimulationVersion } from './manifest';

export interface SimulationLabProps {
	readonly version: SimulationVersion;
	readonly definition: PublicSimulationDefinition;
	readonly svg: string;
	readonly compileMetrics: SchematicCompilationMetrics;
}
