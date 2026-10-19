/* ======================================================================
 * Class-D amplifier
 * ====================================================================== */

/** A symmetric triangle carrier in [−1, 1], period 1. */
export function triangleWave(phase: number): number {
	const p = ((phase % 1) + 1) % 1;
	return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

/** Natural-sampling PWM: high (+1) while the audio exceeds the carrier. */
export function classDPwm(audio: number, carrier: number): 1 | -1 {
	return audio >= carrier ? 1 : -1;
}

/** Second-order LC low-pass magnitude with quality factor Q (Butterworth at Q = 1/√2). */
export function lcLowPass(frequency: number, cutoff: number, q = Math.SQRT1_2): number {
	if (cutoff <= 0) throw new RangeError('The filter cutoff must be positive.');
	const r = frequency / cutoff;
	return 1 / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2);
}

/**
 * Filter a sampled signal through a second-order low-pass (RBJ biquad, bilinear
 * transform): the discrete twin of an LC filter, and the same response Web
 * Audio's lowpass BiquadFilterNode applies.
 */
export function biquadLowPass(
	signal: readonly number[],
	sampleRate: number,
	cutoff: number,
	q = Math.SQRT1_2
): number[] {
	const w = (2 * Math.PI * Math.min(cutoff, sampleRate * 0.45)) / sampleRate;
	const alpha = Math.sin(w) / (2 * q);
	const cos = Math.cos(w);
	const a0 = 1 + alpha;
	const b0 = (1 - cos) / 2 / a0;
	const b1 = (1 - cos) / a0;
	const a1 = (-2 * cos) / a0;
	const a2 = (1 - alpha) / a0;
	const out: number[] = [];
	let x1 = 0;
	let x2 = 0;
	let y1 = 0;
	let y2 = 0;
	for (const x of signal) {
		const y = b0 * x + b1 * x1 + b0 * x2 - a1 * y1 - a2 * y2;
		out.push(y);
		x2 = x1;
		x1 = x;
		y2 = y1;
		y1 = y;
	}
	return out;
}

export function lcCutoff(inductance: number, capacitance: number): number {
	if (inductance <= 0 || capacitance <= 0) throw new RangeError('L and C must be positive.');
	return 1 / (2 * Math.PI * Math.sqrt(inductance * capacitance));
}

export interface ClassDMetrics {
	/** Audio gain through the filter at the tone. */
	readonly audioGain: number;
	/** Carrier fundamental left at the output, relative to the switch-node swing. */
	readonly residual: number;
	/** Audio-to-carrier ratio at the speaker, dB. */
	readonly cleanliness: number;
}

/** What the filter keeps of the tone and leaves of the carrier. */
export function classDMetrics(input: {
	readonly audioFrequency: number;
	readonly carrierFrequency: number;
	readonly cutoff: number;
	readonly depth: number;
	readonly filterOpen?: boolean;
}): ClassDMetrics {
	const audioGain = input.filterOpen ? 1 : lcLowPass(input.audioFrequency, input.cutoff);
	/* The carrier's fundamental in a ±1 PWM wave is (4/π)·sin(π·d)-ish; for the
	   lightly modulated case, 4/π is the honest ceiling. */
	const carrierAmplitude = 4 / Math.PI;
	const residual =
		carrierAmplitude * (input.filterOpen ? 1 : lcLowPass(input.carrierFrequency, input.cutoff));
	const audio = input.depth * audioGain;
	return {
		audioGain,
		residual,
		cleanliness: 20 * Math.log10(Math.max(audio, 1e-9) / Math.max(residual, 1e-9))
	};
}
