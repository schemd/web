import { browser } from '$app/environment';
import { onMount } from 'svelte';
import {
	applyReducedMotionPreference,
	initialSimulationMotionState,
	isSimulationMotionPaused,
	toggleSimulationMotion,
	type SimulationMotionState
} from './simulation-motion';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export interface SimulationMotion {
	readonly paused: boolean;
	/** Includes the synchronous media-query gate used before onMount. */
	readonly animationBlocked: boolean;
	readonly reducedMotion: boolean;
	readonly status: string;
	toggle(): void;
}

/**
 * Shared motion policy for continuously animated labs.
 *
 * System reduced motion pauses before the first animation frame in the browser.
 * A learner can still opt in explicitly, and a later system preference change
 * immediately tears down the owning component's reactive RAF effect.
 */
export function createSimulationMotion(label = 'Simulation animation'): SimulationMotion {
	const media = browser ? window.matchMedia(REDUCED_MOTION_QUERY) : undefined;
	/* Keep SSR and hydration markup identical. onMount applies the browser
	 * preference before a queued animation frame can paint, cancelling it. */
	let state = $state<SimulationMotionState>(initialSimulationMotionState());

	onMount(() => {
		if (!media) return;
		const update = (): void => {
			state = applyReducedMotionPreference(state, media.matches);
		};
		update();
		media.addEventListener('change', update);
		return () => media.removeEventListener('change', update);
	});

	return {
		get paused() {
			return isSimulationMotionPaused(state);
		},
		get animationBlocked() {
			return (
				isSimulationMotionPaused(state) || Boolean(media?.matches && !state.reducedMotionOverride)
			);
		},
		get reducedMotion() {
			return state.reducedMotion;
		},
		get status() {
			if (isSimulationMotionPaused(state)) {
				return state.reducedMotion && !state.reducedMotionOverride
					? `${label} paused to respect the reduced-motion preference.`
					: `${label} paused.`;
			}
			return `${label} running.`;
		},
		toggle(): void {
			state = toggleSimulationMotion(state);
		}
	};
}
