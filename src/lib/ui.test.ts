import { describe, expect, test } from 'vitest';
import { parseBlueprintPreference } from './ui.svelte';

describe('UI preference parsing', () => {
	test('a stored print mode wins over the system scheme', () => {
		expect(parseBlueprintPreference('paper', true)).toBe('paper');
		expect(parseBlueprintPreference('negative', false)).toBe('negative');
	});

	test('with no usable choice, the system scheme decides', () => {
		/* Old mode names from the graphite design are not choices any more. */
		for (const stale of [null, 'hud', 'cyanotype', 'iso', 'constructor']) {
			expect(parseBlueprintPreference(stale)).toBe('paper');
			expect(parseBlueprintPreference(stale, true)).toBe('negative');
		}
	});
});
