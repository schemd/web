import { describe, expect, test } from 'vitest';
import { _estimateInp, _maxClsSessionWindow, vitalRating } from './telemetry';

describe('dependency-free Web Vital calculations', () => {
	test('uses the largest CLS session window instead of summing the page lifetime', () => {
		expect(
			_maxClsSessionWindow([
				{ startTime: 0, value: 0.04 },
				{ startTime: 500, value: 0.05 },
				{ startTime: 1_600, value: 0.2 },
				{ startTime: 6_700, value: 0.9 }
			])
		).toBe(0.9);
		expect(
			_maxClsSessionWindow([
				{ startTime: 0, value: 0.04 },
				{ startTime: 500, value: 0.05 },
				{ startTime: 1_300, value: 0.06 }
			])
		).toBeCloseTo(0.15);
	});

	test('selects the p98-ranked interaction from the ten longest candidates', () => {
		expect(_estimateInp([120, 600, 240], 3)).toBe(600);
		expect(_estimateInp([120, 600, 240], 50)).toBe(240);
		expect(_estimateInp([], 1_000)).toBe(0);
	});

	test('classifies exact threshold boundaries consistently with ingestion', () => {
		expect(vitalRating('CLS', 0.1)).toBe('good');
		expect(vitalRating('INP', 201)).toBe('needs-improvement');
		expect(vitalRating('LCP', 4_001)).toBe('poor');
	});
});
