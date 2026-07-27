export interface SimulationMotionState {
	readonly reducedMotion: boolean;
	readonly userPaused: boolean;
	/** An explicit request to animate despite an active reduced-motion preference. */
	readonly reducedMotionOverride: boolean;
}

export const initialSimulationMotionState = (reducedMotion = false): SimulationMotionState => ({
	reducedMotion,
	userPaused: false,
	reducedMotionOverride: false
});

export const isSimulationMotionPaused = (state: SimulationMotionState): boolean =>
	state.userPaused || (state.reducedMotion && !state.reducedMotionOverride);

/** A newly enabled system preference always wins until the learner explicitly resumes. */
export const applyReducedMotionPreference = (
	state: SimulationMotionState,
	reducedMotion: boolean
): SimulationMotionState => ({
	...state,
	reducedMotion,
	reducedMotionOverride: reducedMotion ? false : state.reducedMotionOverride
});

export const toggleSimulationMotion = (state: SimulationMotionState): SimulationMotionState => {
	if (isSimulationMotionPaused(state)) {
		return {
			...state,
			userPaused: false,
			reducedMotionOverride: state.reducedMotion
		};
	}
	return { ...state, userPaused: true };
};
