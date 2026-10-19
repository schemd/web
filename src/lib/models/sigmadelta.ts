/* ======================================================================
 * Sigma-delta modulation
 * ====================================================================== */

export interface SigmaDeltaTrace {
	readonly bits: (1 | -1)[];
	/** First integrator output after each sample. */
	readonly first: number[];
	/** Second integrator output (zeros for a first-order loop). */
	readonly second: number[];
}

/**
 * A first- or second-order sigma-delta modulator with a ±1 one-bit DAC, with
 * its integrator states. `leak` (0…1) models a lossy integrator: 0 is ideal.
 */
export function sigmaDeltaTrace(
	input: readonly number[],
	order: 1 | 2 = 1,
	leak = 0
): SigmaDeltaTrace {
	const bits: (1 | -1)[] = [];
	const firsts: number[] = [];
	const seconds: number[] = [];
	let first = 0;
	let second = 0;
	let feedback: 1 | -1 = 1;
	const keep = 1 - leak;
	/* Second order uses the standard half-gain integrators, which keep it out of
	   overload for inputs up to about ±0.7. */
	const gain = order === 2 ? 0.5 : 1;
	for (const x of input) {
		first = keep * first + gain * (x - feedback);
		if (order === 2) second = keep * second + gain * (first - feedback);
		const decide = order === 2 ? second : first;
		feedback = decide >= 0 ? 1 : -1;
		bits.push(feedback);
		firsts.push(first);
		seconds.push(second);
	}
	return { bits, first: firsts, second: seconds };
}

/** The modulator's bitstream alone. */
export function sigmaDelta(input: readonly number[], order: 1 | 2 = 1, leak = 0): (1 | -1)[] {
	return sigmaDeltaTrace(input, order, leak).bits;
}

/** Decimate by averaging: each output is the mean of `ratio` bits ending there. */
export function decimate(bits: readonly number[], ratio: number): number[] {
	const out: number[] = [];
	let sum = 0;
	for (let index = 0; index < bits.length; index += 1) {
		sum += bits[index]!;
		if (index >= ratio) sum -= bits[index - ratio]!;
		out.push(sum / Math.min(index + 1, ratio));
	}
	return out;
}

/**
 * Hann-windowed magnitude spectrum in dB, bins 0…N/2, normalised so a full-
 * scale sine reads about 0 dB. Power-of-two lengths use an in-place radix-2
 * FFT, so a 4096-sample record costs milliseconds; other lengths fall back to
 * the direct transform.
 */
export function magnitudeSpectrum(signal: readonly number[]): number[] {
	const n = signal.length;
	const half = Math.floor(n / 2);
	const re = new Float64Array(n);
	const im = new Float64Array(n);
	for (let t = 0; t < n; t += 1)
		re[t] = signal[t]! * (0.5 - 0.5 * Math.cos((2 * Math.PI * t) / (n - 1)));
	if (n > 1 && (n & (n - 1)) === 0) {
		for (let i = 1, j = 0; i < n; i += 1) {
			let bit = n >> 1;
			for (; j & bit; bit >>= 1) j ^= bit;
			j ^= bit;
			if (i < j) {
				[re[i], re[j]] = [re[j]!, re[i]!];
			}
		}
		for (let size = 2; size <= n; size <<= 1) {
			const step = (-2 * Math.PI) / size;
			for (let start = 0; start < n; start += size) {
				for (let k = 0; k < size / 2; k += 1) {
					const wr = Math.cos(step * k);
					const wi = Math.sin(step * k);
					const a = start + k;
					const b = a + size / 2;
					const tr = re[b]! * wr - im[b]! * wi;
					const ti = re[b]! * wi + im[b]! * wr;
					re[b] = re[a]! - tr;
					im[b] = im[a]! - ti;
					re[a] = re[a]! + tr;
					im[a] = im[a]! + ti;
				}
			}
		}
	} else {
		const sourceRe = Float64Array.from(re);
		for (let k = 0; k <= half; k += 1) {
			let sr = 0;
			let si = 0;
			for (let t = 0; t < n; t += 1) {
				const angle = (2 * Math.PI * k * t) / n;
				sr += sourceRe[t]! * Math.cos(angle);
				si -= sourceRe[t]! * Math.sin(angle);
			}
			re[k] = sr;
			im[k] = si;
		}
	}
	const out: number[] = [];
	for (let k = 0; k <= half; k += 1)
		out.push(20 * Math.log10(Math.max(1e-9, Math.hypot(re[k]!, im[k]!) / (n / 4))));
	return out;
}

/**
 * Signal-to-noise ratio inside the signal band, from a Hann spectrum in dB.
 * The signal is the tone's bin and its two Hann neighbours; noise is every
 * other bin from 1 up to `bandEdge`. Returns dB.
 */
export function inBandSnr(
	spectrumDb: readonly number[],
	signalBin: number,
	bandEdge: number
): number {
	let signal = 0;
	let noise = 0;
	const edge = Math.min(bandEdge, spectrumDb.length - 1);
	for (let k = 1; k <= edge; k += 1) {
		const power = 10 ** (spectrumDb[k]! / 10);
		if (Math.abs(k - signalBin) <= 1) signal += power;
		else noise += power;
	}
	return 10 * Math.log10(Math.max(signal, 1e-30) / Math.max(noise, 1e-30));
}
