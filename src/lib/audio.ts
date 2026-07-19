let context: AudioContext | undefined;

export type ToneKind = 'success' | 'lock' | 'error';

export function emitTone(kind: ToneKind): void {
	if (typeof window === 'undefined') return;
	context ??= new AudioContext();
	const oscillator = context.createOscillator();
	const gain = context.createGain();
	const now = context.currentTime;
	const frequency = kind === 'success' ? 164.81 : kind === 'lock' ? 196 : 138.59;

	oscillator.type = 'sine';
	oscillator.frequency.setValueAtTime(frequency, now);
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.035, now + 0.012);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === 'error' ? 0.16 : 0.1));
	oscillator.connect(gain).connect(context.destination);
	oscillator.start(now);
	oscillator.stop(now + 0.18);
}
