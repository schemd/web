import { describe, expect, test } from 'vitest';
import { parseBlueprintPreference } from './ui.svelte';

describe('UI preference parsing', () => {
	test('accepts only persisted blueprint modes with an explicit visual implementation', () => {
		expect(parseBlueprintPreference('cyanotype')).toBe('cyanotype');
		expect(parseBlueprintPreference('iso')).toBe('iso');
		expect(parseBlueprintPreference('hud')).toBe('hud');
		expect(parseBlueprintPreference('constructor')).toBe('hud');
		expect(parseBlueprintPreference(null)).toBe('hud');
	});
});
