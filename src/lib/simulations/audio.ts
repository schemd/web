export interface SimulationAudioCue {
	readonly frequency: number;
	readonly duration?: number;
	readonly gain?: number;
	readonly wave?: OscillatorType;
	readonly source?: string;
}

export const SIMULATION_AUDIO_EVENT = 'schemd:audio' as const;

export function dispatchSimulationAudio(
	target: EventTarget | null,
	cue: SimulationAudioCue
): boolean {
	if (!target || !Number.isFinite(cue.frequency) || cue.frequency <= 0) return false;
	return target.dispatchEvent(
		new CustomEvent<SimulationAudioCue>(SIMULATION_AUDIO_EVENT, {
			detail: cue,
			bubbles: true,
			composed: true,
			cancelable: true
		})
	);
}

export class NativeAudioBridge {
	#context: AudioContext | undefined;

	async play(cue: SimulationAudioCue): Promise<void> {
		if (typeof AudioContext === 'undefined') return;
		const context = (this.#context ??= new AudioContext());
		if (context.state === 'suspended') await context.resume();

		const now = context.currentTime;
		const duration = Math.min(0.5, Math.max(0.025, cue.duration ?? 0.075));
		const gainValue = Math.min(0.12, Math.max(0.002, cue.gain ?? 0.025));
		const oscillator = context.createOscillator();
		const gain = context.createGain();

		oscillator.type = cue.wave ?? 'sine';
		oscillator.frequency.setValueAtTime(Math.min(12_000, Math.max(30, cue.frequency)), now);
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.008);
		gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
		oscillator.connect(gain);
		gain.connect(context.destination);
		oscillator.start(now);
		oscillator.stop(now + duration + 0.012);
		oscillator.addEventListener(
			'ended',
			() => {
				oscillator.disconnect();
				gain.disconnect();
			},
			{ once: true }
		);
	}

	close(): void {
		const context = this.#context;
		this.#context = undefined;
		if (context && context.state !== 'closed') void context.close();
	}
}
