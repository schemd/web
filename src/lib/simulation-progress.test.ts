import { describe, expect, test } from 'vitest';
import {
	completedLabCount,
	browserSimulationProgressStorage,
	emptySimulationProgress,
	isLabComplete,
	parseSimulationProgress,
	readSimulationProgress,
	recordDiagnosis,
	recordFaultObservation,
	recordGuidedAction,
	recordLabAction,
	recordPrediction,
	simulationProgressKey,
	writeSimulationProgress,
	type ProgressStorage
} from './simulation-progress';

function memoryStorage(initial: Record<string, string> = {}): ProgressStorage & {
	values: Record<string, string>;
} {
	return {
		values: { ...initial },
		getItem(key) {
			return this.values[key] ?? null;
		},
		setItem(key, value) {
			this.values[key] = value;
		}
	};
}

describe('simulation curriculum progress', () => {
	test('is version-scoped, immutable, and completes only after every learning phase', () => {
		const initial = emptySimulationProgress();
		const predicted = recordPrediction(initial, 'rc', 'lower', 3, '2026-07-26T00:00:00.000Z');
		const actionOne = recordLabAction(predicted, 'rc', 3, '2026-07-26T00:00:01.000Z');
		const actionTwo = recordLabAction(actionOne, 'rc', 3, '2026-07-26T00:00:02.000Z');
		const faultObserved = recordFaultObservation(actionTwo, 'rc', 3, '2026-07-26T00:00:03.000Z');
		const diagnosed = recordDiagnosis(faultObserved, 'rc', 3, '2026-07-26T00:00:04.000Z');
		const completed = recordLabAction(diagnosed, 'rc', 3, '2026-07-26T00:00:05.000Z');

		expect(simulationProgressKey('0.4.0')).toBe('schemd.simulation-progress.v1:0.4.0');
		expect(initial.labs.rc).toBeUndefined();
		expect(isLabComplete(diagnosed, 'rc')).toBe(false);
		expect(isLabComplete(completed, 'rc')).toBe(true);
		expect(completed.labs.rc?.completedAt).toBe('2026-07-26T00:00:05.000Z');
		expect(completedLabCount(completed, ['rc', 'bell'])).toBe(1);
	});

	test('bounds hostile localStorage input and ignores unknown schemas', () => {
		expect(parseSimulationProgress('{broken')).toEqual(emptySimulationProgress());
		expect(parseSimulationProgress('{"schema":99,"labs":{}}')).toEqual(emptySimulationProgress());
		expect(parseSimulationProgress(' '.repeat(64_001))).toEqual(emptySimulationProgress());
		expect(
			parseSimulationProgress(
				JSON.stringify({
					schema: 1,
					labs: {
						rc: {
							predictionChoice: 'lower',
							actions: 999,
							diagnosisAttempted: true,
							completedAt: 'not-a-date'
						},
						'../../bad': { actions: 2 },
						bell: null
					}
				})
			)
		).toEqual({
			schema: 1,
			labs: {
				rc: {
					predictionChoice: 'lower',
					actions: 32,
					actionEvents: 0,
					faultObserved: false,
					diagnosisAttempted: true,
					completedAt: undefined
				}
			}
		});
	});

	test('does not complete a multi-event guided contract early', () => {
		const predicted = recordPrediction(emptySimulationProgress(), 'lfsr', 'shorter', 1);
		let progress = predicted;
		for (let index = 0; index < 14; index += 1) {
			progress = recordGuidedAction(progress, 'lfsr', 1, 15);
		}
		expect(progress.labs.lfsr?.actions).toBe(0);
		expect(progress.labs.lfsr?.actionEvents).toBe(14);

		progress = recordGuidedAction(progress, 'lfsr', 1, 15);
		expect(progress.labs.lfsr?.actions).toBe(1);
		expect(progress.labs.lfsr?.actionEvents).toBe(0);
	});

	test('treats fault activation as evidence, never as a diagnosis commitment', () => {
		const predicted = recordPrediction(emptySimulationProgress(), 'adder', 'ripple', 1);
		const actionComplete = recordGuidedAction(predicted, 'adder', 1, 1);

		expect(actionComplete.labs.adder?.actions).toBe(1);
		expect(actionComplete.labs.adder?.faultObserved).toBe(false);
		expect(actionComplete.labs.adder?.diagnosisAttempted).toBe(false);
		expect(isLabComplete(actionComplete, 'adder')).toBe(false);

		const prematureDiagnosis = recordDiagnosis(actionComplete, 'adder', 1);
		expect(isLabComplete(prematureDiagnosis, 'adder')).toBe(false);

		const faultEvidence = recordFaultObservation(prematureDiagnosis, 'adder', 1);
		expect(faultEvidence.labs.adder?.faultObserved).toBe(true);
		const committed = recordDiagnosis(faultEvidence, 'adder', 1);
		expect(committed.labs.adder?.diagnosisAttempted).toBe(true);
		expect(isLabComplete(committed, 'adder')).toBe(true);
	});

	test('round-trips through storage and degrades when policy blocks it', () => {
		const storage = memoryStorage();
		const progress = recordPrediction(emptySimulationProgress(), 'adder', 'ripple', 2);
		expect(writeSimulationProgress(storage, '0.4.0', progress)).toBe(true);

		expect(readSimulationProgress(storage, '0.4.0')).toEqual(progress);
		expect(readSimulationProgress(storage, '0.3.8')).toEqual(emptySimulationProgress());

		const blocked: ProgressStorage = {
			getItem: () => {
				throw new Error('blocked');
			},
			setItem: () => {
				throw new Error('blocked');
			}
		};
		expect(readSimulationProgress(blocked, '0.4.0')).toEqual(emptySimulationProgress());
		expect(writeSimulationProgress(blocked, '0.4.0', progress)).toBe(false);
		expect(readSimulationProgress(undefined, '0.4.0')).toEqual(emptySimulationProgress());
		expect(writeSimulationProgress(undefined, '0.4.0', progress)).toBe(false);
		expect(browserSimulationProgressStorage()).toBeUndefined();
	});
});
