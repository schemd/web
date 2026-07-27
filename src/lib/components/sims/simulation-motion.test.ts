import { describe, expect, test } from 'vitest';
import {
	applyReducedMotionPreference,
	initialSimulationMotionState,
	isSimulationMotionPaused,
	toggleSimulationMotion
} from './simulation-motion';

describe('simulation motion policy', () => {
	test('blocks automatic motion when the system requests reduced motion', () => {
		const state = initialSimulationMotionState(true);
		expect(isSimulationMotionPaused(state)).toBe(true);
	});

	test('allows an explicit resume without discarding the system preference', () => {
		const resumed = toggleSimulationMotion(initialSimulationMotionState(true));
		expect(resumed.reducedMotion).toBe(true);
		expect(resumed.reducedMotionOverride).toBe(true);
		expect(isSimulationMotionPaused(resumed)).toBe(false);
		expect(isSimulationMotionPaused(toggleSimulationMotion(resumed))).toBe(true);
	});

	test('an incoming reduced-motion change immediately revokes a prior override', () => {
		const resumed = toggleSimulationMotion(initialSimulationMotionState(true));
		const preferenceCleared = applyReducedMotionPreference(resumed, false);
		const reducedAgain = applyReducedMotionPreference(preferenceCleared, true);
		expect(reducedAgain.reducedMotionOverride).toBe(false);
		expect(isSimulationMotionPaused(reducedAgain)).toBe(true);
	});

	test('keeps an explicit user pause when the system preference changes', () => {
		const paused = toggleSimulationMotion(initialSimulationMotionState(false));
		expect(isSimulationMotionPaused(applyReducedMotionPreference(paused, true))).toBe(true);
		expect(isSimulationMotionPaused(applyReducedMotionPreference(paused, false))).toBe(true);
	});
});
