import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

const consumers = {
	AdderSim: ['rippleCarry'],
	BellSim: ['bellAmplitudesAtStage', 'bellChsh'],
	BuckSim: ['buckMetrics'],
	ChuaSim: ['chuaNonlinearity', 'chuaStep'],
	GroverSim: ['groverPhases', 'groverState'],
	LfsrSim: ['lfsrFeedback', 'lfsrStep', 'lfsrPeriod'],
	PllSim: ['pllTargetFrequency', 'pllPpmError', 'pllLocked'],
	QecSim: ['qecSyndrome', 'qecAccused', 'qecResidual', 'qecFidelity'],
	RcSim: ['rcLowPass'],
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

	test('all thirteen models consume the universal timeline instead of relying on SVG-only playback', () => {
		const projectionConsumers = new Set(['BuckSim', 'ChuaSim', 'PllSim', 'TimerSim', 'WienSim']);
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
