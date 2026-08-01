import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/*
 * Laboratories still driven by a bespoke component. A migrated lab is not
 * exempt from this rule — its consumer simply moved from a component to the
 * model registry, which `modelRegistryConsumers` below checks the same way.
 */
const consumers = {
	RcSim: ['rcLowPass'],
	BuckSim: ['buckMetrics'],
	GroverSim: ['groverPhases', 'groverState'],
	QecSim: ['qecSyndrome', 'qecAccused', 'qecResidual', 'qecFidelity'],
	StatechartSim: ['nextTrafficState'],
	TeleportSim: ['teleportState', 'teleportFidelity'],
	TimerSim: [
		'timer555',
		'timer555AstableWaveform',
		'timer555MonostableCapacitor',
		'timer555PresentationFrequency'
	],
	WienSim: ['wienFrequency', 'wienDamping', 'wienRegime']
} as const;

/* Migrated laboratories: the adapter in the registry is now the consumer. */
const modelRegistryConsumers = {
	adder: ['rippleCarry'],
	bell: ['bellAmplitudesAtStage', 'bellChsh'],
	lfsr: ['lfsrFeedback', 'lfsrStep', 'lfsrPeriod']
} as const;

describe('simulation model architecture', () => {
	for (const [component, functions] of Object.entries(consumers)) {
		test(`${component} consumes its independently tested reference model`, () => {
			const source = readFileSync(
				new URL(`./components/sims/${component}.svelte`, import.meta.url),
				'utf8'
			);
			expect(source).toContain("from '$lib/simulation-models'");
			for (const name of functions) {
				const occurrences = source.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0;
				expect(occurrences, `${component} must import and invoke ${name}`).toBeGreaterThanOrEqual(
					2
				);
			}
		});
	}

	for (const [lab, functions] of Object.entries(modelRegistryConsumers)) {
		test(`${lab} consumes its reference model through the registry`, () => {
			const source = readFileSync(new URL('./lab-models.ts', import.meta.url), 'utf8');
			expect(source).toContain("from './simulation-models'");
			for (const name of functions) {
				const occurrences = source.match(new RegExp(`\\b${name}\\b`, 'g'))?.length ?? 0;
				expect(occurrences, `lab-models.ts must import and invoke ${name}`).toBeGreaterThanOrEqual(
					2
				);
			}
		});
	}

	test('every remaining component consumes the universal timeline instead of relying on SVG-only playback', () => {
		const projectionConsumers = new Set(['BuckSim', 'TimerSim', 'WienSim']);
		for (const component of Object.keys(consumers)) {
			const source = readFileSync(
				new URL(`./components/sims/${component}.svelte`, import.meta.url),
				'utf8'
			);
			expect(source, `${component}: typed timeline subscription`).toContain(
				'useSimulationTimelineModel'
			);
			expect(source, `${component}: stage affects model/projection`).toMatch(/\btimeline\.step\b/);
			expect(source, `${component}: observable model stage`).toContain('data-model-stage');
			if (projectionConsumers.has(component)) {
				expect(source, `${component}: named safe telemetry projection`).toContain(
					'timelineProjection'
				);
			}
		}
	});
});
