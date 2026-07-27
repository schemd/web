/**
 * Semantic evidence emitted by a live model when an authored experimental
 * outcome is actually reached. DOM clicks alone cannot prove that a learner
 * crossed a cutoff or changed a conduction regime.
 */
export const SIMULATION_EVIDENCE_EVENT = 'schemd:simulation-evidence';

export interface SimulationEvidenceDetail {
	readonly simulationId: string;
	readonly outcome: string;
}

export function reportSimulationEvidence(
	target: EventTarget,
	simulationId: string,
	outcome: string
): void {
	target.dispatchEvent(
		new CustomEvent<SimulationEvidenceDetail>(SIMULATION_EVIDENCE_EVENT, {
			bubbles: true,
			detail: { simulationId, outcome }
		})
	);
}
