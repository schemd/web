/* ======================================================================
 * Phase-locked loop
 * ====================================================================== */

export interface PllParams {
	/** Reference frequency, rad/s (presentation-scaled). */
	readonly reference: number;
	/** VCO free-running frequency, rad/s. */
	readonly freeRunning: number;
	/** VCO gain, rad/s per volt. */
	readonly vcoGain: number;
	/** Phase-detector gain, volts per radian (peak of its sine). */
	readonly detectorGain: number;
	/** Loop-filter time constant, seconds. */
	readonly filterTau: number;
	/** Loop filter shorted to ground: the VCO never hears the detector. */
	readonly filterShorted?: boolean;
}

/**
 * State derivatives (θ_e, v_c) of a PLL with a sinusoidal phase detector and a
 * first-order loop filter: θ̇_e = ω_ref − (ω₀ + K_v v_c), v̇_c = (K_d sin θ_e − v_c)/τ.
 */
export function pllDerivatives(
	phaseError: number,
	control: number,
	params: PllParams
): readonly [number, number] {
	const vco = params.freeRunning + params.vcoGain * (params.filterShorted ? 0 : control);
	const dPhase = params.reference - vco;
	const dControl = params.filterShorted
		? -control / params.filterTau
		: (params.detectorGain * Math.sin(phaseError) - control) / params.filterTau;
	return [dPhase, dControl];
}

/** Hold-in range: the widest detuning the loop can track, K_v·K_d. */
export function pllLockRange(params: PllParams): number {
	return params.filterShorted ? 0 : params.vcoGain * params.detectorGain;
}

/** Can the loop hold this reference at all? */
export function pllCanLock(params: PllParams): boolean {
	return Math.abs(params.reference - params.freeRunning) < pllLockRange(params);
}
