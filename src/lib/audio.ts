/**
 * Auditory feedback soundscape — native Web Audio API, zero dependencies.
 *
 * Micro-tones are short (≤ 180 ms), low-frequency, and gain-enveloped so they
 * confirm rather than interrupt. Nothing is constructed until the person
 * explicitly enables audio, and every voice routes through one master gain.
 */

let context: AudioContext | undefined;
let master: GainNode | undefined;

/** Lazily create the audio graph after a user gesture. */
function graph(): { context: AudioContext; master: GainNode } | undefined {
	if (typeof AudioContext === 'undefined') return undefined;
	if (!context || !master) {
		context = new AudioContext();
		master = context.createGain();
		master.gain.value = 0.14;
		master.connect(context.destination);
	}
	if (context.state === 'suspended') void context.resume();
	return { context, master };
}

/** Play one enveloped sine partial. */
function tone(frequency: number, start: number, duration: number, peak = 1): void {
	const nodes = graph();
	if (!nodes) return;
	const { context: ctx, master: out } = nodes;
	const oscillator = ctx.createOscillator();
	const gain = ctx.createGain();
	const at = ctx.currentTime + start;
	oscillator.type = 'sine';
	oscillator.frequency.value = frequency;
	gain.gain.setValueAtTime(0, at);
	gain.gain.linearRampToValueAtTime(peak, at + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
	oscillator.connect(gain).connect(out);
	oscillator.start(at);
	oscillator.stop(at + duration + 0.02);
}

/** Elegant low ascending third: error-free compilation / structural lock. */
export function playSuccess(): void {
	tone(196, 0, 0.14, 0.9); /* G3 */
	tone(247, 0.07, 0.16, 0.7); /* B3 */
}

/** Distinct descending minor second: tokenization or geometry error. */
export function playError(): void {
	tone(174.6, 0, 0.16, 0.9); /* F3 */
	tone(164.8, 0.09, 0.2, 0.8); /* E3 */
}

/** Single click-tick: wire lock, probe contact, switch flip. */
export function playTick(frequency = 660): void {
	tone(frequency, 0, 0.05, 0.5);
}

/** Short pulse used by simulations (frequency in Hz, clamped audible). */
export function playPulse(frequency: number): void {
	tone(Math.min(880, Math.max(80, frequency)), 0, 0.09, 0.6);
}

/** The rate a lab should render a buffer at, so it plays without resampling. */
export function audioSampleRate(): number {
	return graph()?.context.sampleRate ?? 48_000;
}

/**
 * Play a rendered signal once, optionally through a second-order low-pass
 * (the same response as an LC filter). Returns a function that stops it.
 * Called only from an explicit Listen gesture, which is the reader's consent.
 */
export function playSignal(
	samples: Float32Array,
	sampleRate: number,
	lowPass?: { readonly cutoff: number; readonly q: number },
	onEnded?: () => void
): () => void {
	const nodes = graph();
	if (!nodes) return () => undefined;
	const { context: ctx, master: out } = nodes;
	const buffer = ctx.createBuffer(1, samples.length, sampleRate);
	buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
	const source = ctx.createBufferSource();
	source.buffer = buffer;
	const level = ctx.createGain();
	level.gain.value = 0.6;
	let chain: AudioNode = source;
	if (lowPass) {
		const filter = ctx.createBiquadFilter();
		filter.type = 'lowpass';
		filter.frequency.value = Math.min(lowPass.cutoff, sampleRate * 0.45);
		/* A lowpass BiquadFilterNode reads Q in decibels: Butterworth (Q = 1/√2) is −3.01 dB. */
		filter.Q.value = 20 * Math.log10(lowPass.q);
		chain.connect(filter);
		chain = filter;
	}
	chain.connect(level).connect(out);
	source.onended = () => onEnded?.();
	source.start();
	return () => {
		try {
			source.stop();
		} catch {
			/* already stopped */
		}
	};
}
