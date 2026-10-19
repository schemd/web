/* ======================================================================
 * Transmission-line reflections (time-domain reflectometry)
 * ====================================================================== */

/** Γ = (Z − Z₀)/(Z + Z₀); an open end (Z = ∞) reflects +1, a short −1. */
export function reflectionCoefficient(impedance: number, characteristic: number): number {
	if (characteristic <= 0) throw new RangeError('Characteristic impedance must be positive.');
	if (!Number.isFinite(impedance)) return 1;
	if (impedance < 0) throw new RangeError('Impedance cannot be negative.');
	return (impedance - characteristic) / (impedance + characteristic);
}

export interface TdrResponse {
	readonly gammaSource: number;
	readonly gammaLoad: number;
	/** The first wave launched into the line. */
	readonly launched: number;
	/** Voltage steps at the source end: time (in one-way delays) and size. */
	readonly sourceSteps: readonly { readonly time: number; readonly step: number }[];
	readonly loadSteps: readonly { readonly time: number; readonly step: number }[];
	/** Where both ends settle: the DC divider of R_s and Z_L. */
	readonly settled: number;
}

/**
 * Step response of a lossless line by the lattice (bounce) diagram.
 *
 * A step V_s behind R_s launches V₁ = V_s·Z₀/(R_s+Z₀). The k-th wave reaching
 * the load is V₁(Γ_LΓ_S)^k and adds itself times (1+Γ_L) there; its reflection
 * returns one delay later and adds itself times (1+Γ_S) at the source.
 */
export function tdrResponse(
	sourceVoltage: number,
	sourceResistance: number,
	characteristic: number,
	loadImpedance: number,
	bounces = 16
): TdrResponse {
	const gammaSource = reflectionCoefficient(sourceResistance, characteristic);
	const gammaLoad = reflectionCoefficient(loadImpedance, characteristic);
	const launched = (sourceVoltage * characteristic) / (sourceResistance + characteristic);
	const sourceSteps = [{ time: 0, step: launched }];
	const loadSteps: { time: number; step: number }[] = [];
	let wave = launched;
	for (let k = 0; k < bounces; k += 1) {
		loadSteps.push({ time: 2 * k + 1, step: wave * (1 + gammaLoad) });
		const reflected = wave * gammaLoad;
		sourceSteps.push({ time: 2 * k + 2, step: reflected * (1 + gammaSource) });
		wave = reflected * gammaSource;
		if (Math.abs(wave) < 1e-6) break;
	}
	const settled = Number.isFinite(loadImpedance)
		? (sourceVoltage * loadImpedance) / (sourceResistance + loadImpedance)
		: sourceVoltage;
	return { gammaSource, gammaLoad, launched, sourceSteps, loadSteps, settled };
}

/** The voltage at one end of the line at time `t` (in one-way delays). */
export function tdrVoltageAt(steps: readonly { time: number; step: number }[], t: number): number {
	let total = 0;
	for (const { time, step } of steps) if (t >= time) total += step;
	return total;
}

/**
 * The voltage at fractional position `x` (0 = near end, 1 = far end) at time
 * `t` (in one-way delays): every forward wave that has reached x, plus every
 * reflected wave that has travelled back as far as x. Forward wave k leaves
 * the source at 2k; its reflection leaves the load at 2k + 1.
 */
export function tdrLineVoltage(response: TdrResponse, x: number, t: number): number {
	let total = 0;
	let wave = response.launched;
	for (let k = 0; k < 64 && Math.abs(wave) > 1e-6; k += 1) {
		if (t >= 2 * k + x) total += wave;
		const reflected = wave * response.gammaLoad;
		if (t >= 2 * k + 2 - x) total += reflected;
		wave = reflected * response.gammaSource;
	}
	return total;
}
