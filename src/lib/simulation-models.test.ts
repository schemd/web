import { describe, expect, test } from 'vitest';
import {
	bellAmplitudes,
	bellAmplitudesAtStage,
	bellChsh,
	bellCorrelator,
	buckMetrics,
	chuaDerivative,
	chuaNonlinearity,
	chuaStep,
	groverPhases,
	groverOptimalRounds,
	groverState,
	lfsrPeriod,
	lfsrStep,
	nextTrafficState,
	pllLocked,
	pllPpmError,
	pllTargetFrequency,
	qecAccused,
	qecFidelity,
	qecResidual,
	qecSyndrome,
	rcLowPass,
	rippleCarry,
	teleportFidelity,
	teleportState,
	timer555,
	timer555AstableWaveform,
	timer555MonostableCapacitor,
	timer555PresentationFrequency,
	wienDamping,
	wienFrequency,
	wienRegime
} from './simulation-models';

const close = (actual: number, expected: number, precision = 10): void =>
	expect(actual).toBeCloseTo(expected, precision);

describe('simulation reference models', () => {
	test('ripple-carry addition agrees with integer arithmetic across the entire 8-bit domain', () => {
		const mismatches: string[] = [];
		for (let a = 0; a < 256; a += 1) {
			for (let b = 0; b < 256; b += 1) {
				const result = rippleCarry(a, b);
				const expectedSum = (a + b) & 0xff;
				const expectedCarry = a + b > 0xff ? 1 : 0;
				if (
					result.sum !== expectedSum ||
					result.carry !== expectedCarry ||
					result.stages.length !== 8
				) {
					mismatches.push(
						`${a}+${b}: received ${result.carry}:${result.sum}, expected ${expectedCarry}:${expectedSum}`
					);
					if (mismatches.length === 16) break;
				}
			}
			if (mismatches.length === 16) break;
		}
		expect(mismatches).toEqual([]);
		expect(rippleCarry(0xff, 0, 1)).toMatchObject({ sum: 0, carry: 1 });
		expect(rippleCarry(0xff, 1, 0, 8, true)).toMatchObject({ sum: 0xfe, carry: 0 });
		expect(() => rippleCarry(0, 0, 0, 0)).toThrow(/bits/);
	});

	test('Bell preparation is normalized and reaches Tsirelson while a broken entangler does not', () => {
		for (const q0 of [0, 1] as const) {
			for (const q1 of [0, 1] as const) {
				const entangled = bellAmplitudes(q0, q1);
				close(
					Object.values(entangled).reduce((sum, amplitude) => sum + amplitude ** 2, 0),
					1
				);
				close(bellChsh(entangled), 2 * Math.SQRT2);
				close(bellChsh(bellAmplitudes(q0, q1, true)), 2);
			}
		}
		const phiPlus = bellAmplitudes(0, 0);
		close(bellCorrelator(phiPlus, 0, 0), 1);
		close(bellCorrelator(phiPlus, 0, Math.PI), -1);
	});

	test('Bell stage replay does not reveal entanglement before H and CNOT execute', () => {
		expect(bellAmplitudesAtStage(0, 1, 0)).toEqual({ '00': 0, '01': 1, '10': 0, '11': 0 });
		const afterH = bellAmplitudesAtStage(0, 1, 1);
		close(afterH['01'], 1 / Math.SQRT2);
		close(afterH['11'], 1 / Math.SQRT2);
		close(bellChsh(afterH), 2);
		close(bellChsh(bellAmplitudesAtStage(0, 1, 2)), 2 * Math.SQRT2);
		close(bellChsh(bellAmplitudesAtStage(0, 1, 2, true)), 2);
		expect(() => bellAmplitudesAtStage(0, 0, -1)).toThrow(/stage/);
	});

	test('RC response pins DC, cutoff, high-frequency attenuation, and the open-capacitor limit', () => {
		const atDc = rcLowPass(10_000, 100e-9, 0);
		close(atDc.magnitude, 1);
		close(atDc.phase, 0);
		const cutoff = 1 / (2 * Math.PI * 10_000 * 100e-9);
		const atCutoff = rcLowPass(10_000, 100e-9, cutoff);
		close(atCutoff.cutoff, cutoff);
		close(atCutoff.magnitude, 1 / Math.SQRT2);
		close(atCutoff.phase, -Math.PI / 4);
		close(atCutoff.attenuationDb, -3.0102999566, 8);
		expect(rcLowPass(10_000, 100e-9, 1e12).magnitude).toBeLessThan(1e-8);
		expect(rcLowPass(10_000, 100e-9, 1e12, true)).toEqual({
			cutoff: Number.POSITIVE_INFINITY,
			magnitude: 1,
			phase: 0,
			attenuationDb: 0
		});
		expect(() => rcLowPass(0, 1, 1)).toThrow(/positive/);
	});

	test('RC magnitude is monotone across six frequency decades and every component sweep', () => {
		for (const resistance of [100, 1_000, 10_000, 100_000]) {
			for (const capacitance of [1e-9, 10e-9, 100e-9, 1e-6]) {
				let previous = 1;
				for (let exponent = -1; exponent <= 6; exponent += 0.25) {
					const response = rcLowPass(resistance, capacitance, 10 ** exponent);
					expect(response.magnitude).toBeLessThanOrEqual(previous + Number.EPSILON);
					expect(response.magnitude).toBeGreaterThan(0);
					previous = response.magnitude;
				}
			}
		}
	});

	test('555 timing equations preserve physical frequency, duty, period, and one-shot width', () => {
		const result = timer555(5_000, 10_000, 10e-6);
		close(result.frequency, 5.76);
		close(result.duty, 0.6);
		close(result.period, 1 / 5.76);
		close(result.pulseWidth, 0.055);
		expect(timer555(5_000, 10_000, 10e-6, true).period).toBe(Number.POSITIVE_INFINITY);
		expect(() => timer555(-1, 1, 1)).toThrow(/positive/);
	});

	test('555 capacitor presentation preserves exponential thresholds and duty split', () => {
		const ra = 5_000;
		const rb = 10_000;
		const duty = (ra + rb) / (ra + 2 * rb);
		close(timer555AstableWaveform(0, ra, rb).capacitorRatio, 1 / 3);
		close(timer555AstableWaveform(duty, ra, rb).capacitorRatio, 2 / 3);
		close(timer555AstableWaveform(1, ra, rb).capacitorRatio, 1 / 3);
		let previous = 1 / 3;
		for (let index = 1; index < 100; index += 1) {
			const value = timer555AstableWaveform((duty * index) / 100, ra, rb).capacitorRatio;
			expect(value).toBeGreaterThan(previous);
			previous = value;
		}
		previous = 2 / 3;
		for (let index = 1; index < 100; index += 1) {
			const phase = duty + ((1 - duty) * index) / 100;
			const value = timer555AstableWaveform(phase, ra, rb).capacitorRatio;
			expect(value).toBeLessThan(previous);
			previous = value;
		}
		expect(() => timer555AstableWaveform(Number.NaN, ra, rb)).toThrow(/phase/);
		close(timer555PresentationFrequency(0.4), 0.4);
		close(timer555PresentationFrequency(48_000), 1.5);
		expect(() => timer555PresentationFrequency(-1)).toThrow(/presentation/);
		close(timer555MonostableCapacitor(0, ra, 10e-6), 0);
		close(timer555MonostableCapacitor(1.1 * ra * 10e-6, ra, 10e-6), 2 / 3, 2);
		expect(() => timer555MonostableCapacitor(-1, ra, 10e-6)).toThrow(/elapsed/);
	});

	test('buck estimates obey the ideal conversion and fault limits', () => {
		const metrics = buckMetrics({
			vin: 18,
			duty: 0.5,
			load: 6,
			inductance: 47e-6,
			capacitance: 220e-6,
			frequency: 120e3,
			outputVoltage: 9,
			inductorCurrent: 1.5
		});
		close(metrics.idealOutput, 9);
		close(metrics.loadCurrent, 1.5);
		expect(metrics.rippleCurrent).toBeGreaterThan(0);
		expect(metrics.rippleVoltage).toBeGreaterThan(0);
		expect(metrics.efficiency).toBeGreaterThan(0);
		expect(metrics.efficiency).toBeLessThan(1);
		expect(
			buckMetrics({
				vin: 18,
				duty: 0.5,
				load: 6,
				inductance: 47e-6,
				capacitance: 220e-6,
				frequency: 120e3,
				outputVoltage: 9,
				inductorCurrent: 1.5,
				gateLost: true
			})
		).toMatchObject({ idealOutput: 0, rippleCurrent: 0, efficiency: 0 });
	});

	test('Chua diode is continuous, piecewise-linear, and its RK4 step remains finite', () => {
		const m0 = -1.143;
		const m1 = -0.714;
		close(chuaNonlinearity(0, m0, m1), 0);
		close(chuaNonlinearity(1 - 1e-9, m0, m1), chuaNonlinearity(1 + 1e-9, m0, m1), 7);
		close(chuaNonlinearity(0.4, m0, m1, true), 0.4);
		expect(chuaDerivative([0.11, 0, 0], 15.6, 28, m0, m1)).toHaveLength(3);
		const next = chuaStep([0.11, 0, 0], 0.0045, 15.6, 28, m0, m1);
		expect(next.every(Number.isFinite)).toBe(true);
		expect(next).not.toEqual([0.11, 0, 0]);
	});

	test('Grover identifies the exact two-round optimum and exposes a third-round over-rotation', () => {
		expect(groverOptimalRounds()).toBe(2);
		expect(groverPhases()).toEqual([
			'super',
			'oracle',
			'mean',
			'diffuse',
			'oracle',
			'mean',
			'diffuse',
			'measure'
		]);
		const initial = groverState(5, 0);
		for (const amplitude of initial.amplitudes) close(amplitude, 1 / Math.sqrt(8));
		expect(groverState(5, 2).mean).toBeDefined();
		const final = groverState(5, 7);
		close(final.amplitudes[5]! ** 2, 0.9453125);
		expect(groverState(5, 7, 8, true).amplitudes[5]! ** 2).toBeLessThan(0.02);
		expect(groverPhases(8, 3)).toHaveLength(11);
		const optimalCheckpoint = groverState(5, 6, 8, false, 3);
		const overRotated = groverState(5, 9, 8, false, 3);
		close(optimalCheckpoint.amplitudes[5]! ** 2, 0.9453125);
		close(overRotated.amplitudes[5]! ** 2, 0.330078125);
		expect(overRotated.amplitudes[5]! ** 2).toBeLessThan(optimalCheckpoint.amplitudes[5]! ** 2);
		expect(() => groverPhases(8, -1)).toThrow(/rounds/);
		expect(() => groverState(8, 0)).toThrow(/target/);
	});

	test('Grover replay remains normalized for every target and intermediate stage', () => {
		for (let target = 0; target < 8; target += 1) {
			for (let phase = 0; phase < groverPhases().length; phase += 1) {
				const norm = groverState(target, phase).amplitudes.reduce(
					(total, amplitude) => total + amplitude * amplitude,
					0
				);
				close(norm, 1);
			}
		}
	});

	test('Grover optimal-round selection maximizes the exact amplitude rotation', () => {
		for (let items = 2; items <= 128; items += 1) {
			const theta = Math.asin(1 / Math.sqrt(items));
			const rounds = groverOptimalRounds(items);
			const probability = (count: number): number => Math.sin((2 * count + 1) * theta) ** 2;
			expect(probability(rounds)).toBeGreaterThanOrEqual(
				probability(Math.max(0, rounds - 1)) - 1e-14
			);
			expect(probability(rounds)).toBeGreaterThanOrEqual(probability(rounds + 1) - 1e-14);
		}
	});

	test('the primitive LFSR visits all non-zero states and the moved tap shortens the cycle', () => {
		const seed = [1, 0, 0, 0] as const;
		expect(lfsrStep(seed)).toEqual([0, 1, 0, 0]);
		expect(lfsrPeriod(seed)).toBe(15);
		expect(lfsrPeriod(seed, true)).toBeLessThan(15);
		expect(lfsrPeriod([0, 0, 0, 0])).toBe(0);
	});

	test('every non-zero state belongs to the same maximal primitive LFSR cycle', () => {
		for (let value = 1; value < 16; value += 1) {
			const seed = [0, 1, 2, 3].map((bit) => ((value >>> bit) & 1) as 0 | 1) as [
				0 | 1,
				0 | 1,
				0 | 1,
				0 | 1
			];
			expect(lfsrPeriod(seed)).toBe(15);
		}
	});

	test('the bit-flip code uniquely diagnoses and repairs each single-qubit error', () => {
		const errors = [
			[1, 0, 0],
			[0, 1, 0],
			[0, 0, 1]
		] as const;
		for (const [qubit, error] of errors.entries()) {
			expect(qecAccused(qecSyndrome(error))).toBe(qubit);
			expect(qecResidual(error, true)).toEqual([0, 0, 0]);
			expect(qecFidelity(error, true)).toBe(1);
			expect(qecFidelity(error, false)).toBe(0);
		}
		expect(qecAccused([0, 0])).toBeUndefined();
		expect(qecFidelity([1, 0, 0], true, true)).toBe(0);
	});

	test('teleportation preserves normalization and exposes every lost-correction fidelity', () => {
		const state = teleportState(Math.PI / 3, Math.PI / 4);
		close(state.p0 + state.p1, 1);
		for (const m1 of [0, 1] as const)
			for (const m2 of [0, 1] as const) close(teleportFidelity(state, m1, m2), 1);
		close(teleportFidelity(state, 0, 0, true), 1);
		close(teleportFidelity(state, 1, 0, true), 0.25);
		close(teleportFidelity(state, 0, 1, true), 0.375);
		close(teleportFidelity(state, 1, 1, true), 0.375);
	});

	test('teleportation stays normalized and fidelity-bounded across the Bloch sphere', () => {
		for (let thetaStep = 0; thetaStep <= 24; thetaStep += 1) {
			for (let phiStep = 0; phiStep < 24; phiStep += 1) {
				const state = teleportState((thetaStep / 24) * Math.PI, (phiStep / 24) * 2 * Math.PI);
				close(state.p0 + state.p1, 1);
				for (const m1 of [0, 1] as const) {
					for (const m2 of [0, 1] as const) {
						close(teleportFidelity(state, m1, m2), 1);
						const lost = teleportFidelity(state, m1, m2, true);
						expect(lost).toBeGreaterThanOrEqual(-Number.EPSILON);
						expect(lost).toBeLessThanOrEqual(1 + Number.EPSILON);
					}
				}
			}
		}
	});

	test('PLL lock uses the target ratio, ppm window, confidence, and reference health', () => {
		expect(pllTargetFrequency(10_000, 8)).toBe(80_000);
		close(pllPpmError(80_004, 80_000), 50);
		expect(pllLocked(49.999, 0.83)).toBe(true);
		expect(pllLocked(50, 1)).toBe(false);
		expect(pllLocked(0, 0.82)).toBe(false);
		expect(pllLocked(0, 1, true)).toBe(false);
		expect(() => pllTargetFrequency(0, 1)).toThrow(/positive/);
	});

	test('the traffic controller cycles deterministically and the inverted guard deadlocks yellow', () => {
		expect(nextTrafficState('RED')).toBe('GREEN');
		expect(nextTrafficState('GREEN')).toBe('YELLOW');
		expect(nextTrafficState('YELLOW')).toBe('RED');
		expect(nextTrafficState('YELLOW', true)).toBe('YELLOW');
	});

	test('Wien bridge equations identify the Barkhausen threshold and faulted clipping regime', () => {
		close(wienFrequency(10_000, 10e-9), 1 / (2 * Math.PI * 10_000 * 10e-9));
		expect(wienDamping(3)).toBe(0);
		expect(wienRegime(wienDamping(2.9))).toContain('DECAYING');
		expect(wienRegime(wienDamping(3))).toContain('MARGINAL');
		expect(wienRegime(wienDamping(3.1))).toContain('OSCILLATING');
		expect(wienRegime(wienDamping(3.1), true)).toContain('CLIPPING');
		expect(() => wienFrequency(0, 1)).toThrow(/positive/);
	});
});
