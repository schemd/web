export interface Astable555Result {
	readonly highSeconds: number;
	readonly lowSeconds: number;
	readonly periodSeconds: number;
	readonly frequencyHz: number;
	readonly dutyCycle: number;
}

const LOG_TWO = Math.log(2);

export function astable555(
	r1Ohms: number,
	r2Ohms: number,
	capacitanceFarads: number
): Astable555Result {
	if (
		!Number.isFinite(r1Ohms) ||
		!Number.isFinite(r2Ohms) ||
		!Number.isFinite(capacitanceFarads) ||
		r1Ohms <= 0 ||
		r2Ohms <= 0 ||
		capacitanceFarads <= 0
	) {
		throw new RangeError('Astable timing values must be finite and positive.');
	}

	const highSeconds = LOG_TWO * (r1Ohms + r2Ohms) * capacitanceFarads;
	const lowSeconds = LOG_TWO * r2Ohms * capacitanceFarads;
	const periodSeconds = highSeconds + lowSeconds;

	return {
		highSeconds,
		lowSeconds,
		periodSeconds,
		frequencyHz: 1 / periodSeconds,
		dutyCycle: highSeconds / periodSeconds
	};
}
