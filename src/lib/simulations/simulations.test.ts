import { compileSchematic } from '@schemd/core';
import { describe, expect, it } from 'vitest';
import { astable555 } from './astable-555';
import { bellState, measureBell, nextBellStep } from './bell-state';
import { byteBinary, rippleCarry8 } from './digital-adder';
import { getSimulation, SIMULATIONS, SUPPORTED_SIMULATION_VERSION } from './manifest';
import { logarithmicFrequency, rcLowPass } from './rc-low-pass';
import { normalizeQubit, qubitFromDegrees, teleport } from './teleportation';

describe('digital ripple carry', () => {
	it('propagates all eight stages and overflow', () => {
		const result = rippleCarry8(255, 1, 0);
		expect(result.sum).toBe(0);
		expect(result.carryOut).toBe(1);
		expect(result.nineBitResult).toBe(256);
		expect(result.stages).toHaveLength(8);
		expect(result.stages[0]).toEqual({
			bit: 0,
			a: 1,
			b: 1,
			carryIn: 0,
			sum: 0,
			carryOut: 1
		});
		expect(byteBinary(5)).toBe('00000101');
		expect(rippleCarry8(0, 0, 1).sum).toBe(1);
	});

	it.each([
		[-1, 0, 0],
		[256, 0, 0],
		[1.2, 0, 0],
		[0, -1, 0],
		[0, 256, 0],
		[0, 0, 2]
	])('rejects invalid input %#', (a, b, carry) => {
		expect(() => rippleCarry8(a, b, carry as 0)).toThrowError(RangeError);
	});

	it('rejects invalid binary formatting input', () => {
		expect(() => byteBinary(300)).toThrowError(RangeError);
	});
});

describe('Bell state', () => {
	it('returns exact state-vector stages and wraps the cursor', () => {
		expect(bellState(0).probabilities).toEqual([1, 0, 0, 0]);
		expect(bellState(1).probabilities).toEqual([0.5, 0, 0.5, 0]);
		expect(bellState(2).probabilities).toEqual([0.5, 0, 0, 0.5]);
		expect(nextBellStep(0)).toBe(1);
		expect(nextBellStep(1)).toBe(2);
		expect(nextBellStep(2)).toBe(0);
		expect(measureBell(0)).toBe('00');
		expect(measureBell(0.499)).toBe('00');
		expect(measureBell(0.5)).toBe('11');
		expect(measureBell(0.999)).toBe('11');
	});

	it.each([-1, 1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid sample %s', (sample) => {
		expect(() => measureBell(sample)).toThrowError(RangeError);
	});
});

describe('RC low pass', () => {
	it('computes cutoff, gain, output, phase, and logarithmic frequency', () => {
		const cutoff = 1 / (2 * Math.PI * 10_000 * 100e-9);
		const response = rcLowPass(cutoff, 10_000, 100e-9, 5);
		expect(response.gain).toBeCloseTo(Math.SQRT1_2, 10);
		expect(response.gainDb).toBeCloseTo(-3.0103, 3);
		expect(response.phaseDegrees).toBeCloseTo(-45, 10);
		expect(response.outputVolts).toBeCloseTo(5 * Math.SQRT1_2, 10);
		expect(logarithmicFrequency(0)).toBe(10);
		expect(logarithmicFrequency(0.5)).toBe(1000);
		expect(logarithmicFrequency(1)).toBe(100_000);
	});

	it.each([
		[0, 1, 1, 1],
		[1, 0, 1, 1],
		[1, 1, 0, 1],
		[1, 1, 1, -1],
		[Number.NaN, 1, 1, 1]
	])('rejects invalid physical input %#', (frequency, resistance, capacitance, voltage) => {
		expect(() => rcLowPass(frequency, resistance, capacitance, voltage)).toThrowError(RangeError);
	});

	it('rejects invalid logarithmic slider bounds and positions', () => {
		expect(() => logarithmicFrequency(-0.1)).toThrowError(RangeError);
		expect(() => logarithmicFrequency(1.1)).toThrowError(RangeError);
		expect(() => logarithmicFrequency(Number.NaN)).toThrowError(RangeError);
		expect(() => logarithmicFrequency(0.5, 0, 10)).toThrowError(RangeError);
		expect(() => logarithmicFrequency(0.5, 10, 10)).toThrowError(RangeError);
	});
});

describe('NE555 astable timing', () => {
	it('computes textbook charge and discharge intervals', () => {
		const timing = astable555(10_000, 47_000, 10e-6);
		expect(timing.highSeconds).toBeCloseTo(Math.LN2 * 57_000 * 10e-6, 12);
		expect(timing.lowSeconds).toBeCloseTo(Math.LN2 * 47_000 * 10e-6, 12);
		expect(timing.frequencyHz).toBeCloseTo(1 / timing.periodSeconds, 12);
		expect(timing.dutyCycle).toBeGreaterThan(0.5);
	});

	it.each([
		[0, 1, 1],
		[1, 0, 1],
		[1, 1, 0],
		[Number.NaN, 1, 1]
	])('rejects invalid timing input %#', (r1, r2, capacitance) => {
		expect(() => astable555(r1, r2, capacitance)).toThrowError(RangeError);
	});
});

describe('quantum teleportation', () => {
	it('normalizes real qubits and recovers every measurement branch', () => {
		expect(qubitFromDegrees(0)).toEqual({ alpha: 1, beta: 0 });
		expect(qubitFromDegrees(180).beta).toBeCloseTo(1, 12);
		expect(normalizeQubit({ alpha: 3, beta: 4 })).toEqual({ alpha: 0.6, beta: 0.8 });
		for (const z of [0, 1] as const) {
			for (const x of [0, 1] as const) {
				const result = teleport({ alpha: 3, beta: 4 }, z, x);
				expect(result.fidelity).toBeCloseTo(1, 12);
				expect(result.recovered).toEqual(result.message);
			}
		}
	});

	it('rejects invalid angles, amplitudes, and measurement bits', () => {
		expect(() => qubitFromDegrees(-1)).toThrowError(RangeError);
		expect(() => qubitFromDegrees(361)).toThrowError(RangeError);
		expect(() => qubitFromDegrees(Number.NaN)).toThrowError(RangeError);
		expect(() => teleport({ alpha: 0, beta: 0 }, 0, 0)).toThrowError(RangeError);
		expect(() => teleport({ alpha: Number.NaN, beta: 1 }, 0, 0)).toThrowError(RangeError);
		expect(() => teleport({ alpha: 1, beta: Number.POSITIVE_INFINITY }, 0, 0)).toThrowError(
			RangeError
		);
		expect(() => teleport({ alpha: 1, beta: 0 }, 2 as never, 0)).toThrowError(RangeError);
		expect(() => teleport({ alpha: 1, beta: 0 }, 0, 2 as never)).toThrowError(RangeError);
	});
});

describe('simulation manifest and compiler integration', () => {
	it('exposes five stable, documented routes', () => {
		expect(SUPPORTED_SIMULATION_VERSION).toBe('v0.2.1');
		expect(SIMULATIONS).toHaveLength(5);
		expect(new Set(SIMULATIONS.map((simulation) => simulation.id)).size).toBe(5);
		expect(
			SIMULATIONS.every(
				(simulation) =>
					simulation.source.length > 0 && simulation.docsPath.startsWith('/docs/v0.2.1/')
			)
		).toBe(true);
		expect(getSimulation('rc-low-pass')?.domain).toBe('Analog circuits');
		expect(getSimulation('missing')).toBeUndefined();
	});

	it.each(SIMULATIONS)('compiles $id in full semantic mode', (simulation) => {
		const compiled = compileSchematic(simulation.source, {
			bounds: simulation.bounds,
			title: simulation.title,
			idPrefix: `test-${simulation.id}`,
			mode: 'full',
			semanticHooks: ['nodes', 'ports', 'wires']
		});
		expect(compiled.metrics.components).toBeGreaterThan(0);
		expect(compiled.metrics.connections).toBeGreaterThan(0);
		expect(compiled.svg).toContain('data-node-id');
		expect(compiled.svg).toContain('data-wire-source');
		expect(compiled.svg).toContain('data-port-id');
	});
});
