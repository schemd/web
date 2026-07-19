import { describe, expect, it } from 'vitest';
import { FAULT_MODES, faultLabel, formatEngineering, oscilloscopePath } from './instrumentation';

describe('simulation instrumentation', () => {
	it.each(['sine', 'quantum'] as const)('draws a bounded sampled %s waveform', (kind) => {
		const path = oscilloscopePath(kind, -0.25, 120, 80, 8);
		expect(path.startsWith('M0.00 ')).toBe(true);
		expect(path.split('L')).toHaveLength(8);
		expect(path).toContain('120.00');
	});

	it.each(['square', 'logic'] as const)('draws exact vertical edges for %s traces', (kind) => {
		const path = oscilloscopePath(kind, 0, 120, 80, 24);
		expect(path.startsWith('M0.00 ')).toBe(true);
		expect(path).toContain('H');
		expect(path).toContain('V');
		expect(path).not.toMatch(/L\d/);
	});

	it('validates the allocation and geometry budgets', () => {
		expect(() => oscilloscopePath('sine', Number.NaN)).toThrowError(RangeError);
		expect(() => oscilloscopePath('sine', 0, 0, 20)).toThrowError(RangeError);
		expect(() => oscilloscopePath('sine', 0, 20, Number.POSITIVE_INFINITY)).toThrowError(
			RangeError
		);
		expect(() => oscilloscopePath('sine', 0, 20, 20, 7)).toThrowError(RangeError);
		expect(() => oscilloscopePath('sine', 0, 20, 20, 513)).toThrowError(RangeError);
		expect(() => oscilloscopePath('sine', 0, 20, 20, 8.5)).toThrowError(RangeError);
	});

	it('names every supported fault state', () => {
		expect(FAULT_MODES.map(faultLabel)).toEqual([
			'Nominal',
			'Short to ground',
			'Open circuit',
			'Drifted resistance'
		]);
	});

	it('formats zero and engineering-scale values without a bogus nano prefix', () => {
		expect(formatEngineering(0, 'V')).toBe('0.00 V');
		expect(formatEngineering(1591.55, 'Hz')).toBe('1.59 kHz');
		expect(formatEngineering(100e-9, 'F')).toBe('100.00 nF');
		expect(formatEngineering(Number.NaN, 'V')).toBe('— V');
	});
});
