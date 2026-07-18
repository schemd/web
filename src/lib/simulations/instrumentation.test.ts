import { describe, expect, it } from 'vitest';
import { faultLabel, oscilloscopePath } from './instrumentation';

describe('simulation instrumentation', () => {
	it.each(['sine', 'square', 'logic', 'quantum'] as const)(
		'draws a bounded %s waveform',
		(kind) => {
			const path = oscilloscopePath(kind, -0.25, 120, 80, 8);
			expect(path.startsWith('M0.00 ')).toBe(true);
			expect(path.split('L')).toHaveLength(8);
			expect(path).toContain('120.00');
		}
	);

	it('validates scope inputs', () => {
		expect(() => oscilloscopePath('sine', Number.NaN)).toThrowError('phase must be finite');
		expect(() => oscilloscopePath('sine', 0, 0, 20)).toThrowError('dimensions must be positive');
		expect(() => oscilloscopePath('sine', 0, 20, Number.POSITIVE_INFINITY)).toThrowError(
			'dimensions must be positive'
		);
		expect(() => oscilloscopePath('sine', 0, 20, 20, 7)).toThrowError('8 through 512');
		expect(() => oscilloscopePath('sine', 0, 20, 20, 513)).toThrowError('8 through 512');
		expect(() => oscilloscopePath('sine', 0, 20, 20, 8.5)).toThrowError('8 through 512');
	});

	it('names every supported fault state', () => {
		expect(faultLabel('none')).toBe('Nominal circuit');
		expect(faultLabel('short-ground')).toBe('Short to ground');
		expect(faultLabel('open-circuit')).toBe('Open circuit');
		expect(faultLabel('degraded-resistor')).toBe('Degraded resistor');
	});
});
