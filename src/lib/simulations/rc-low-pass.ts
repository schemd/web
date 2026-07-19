export interface RcLowPassResult {
	readonly cutoffHz: number;
	readonly angularRatio: number;
	readonly gain: number;
	readonly gainDb: number;
	readonly outputVolts: number;
	readonly phaseDegrees: number;
}

export function rcLowPass(
	frequencyHz: number,
	resistanceOhms: number,
	capacitanceFarads: number,
	inputVolts: number
): RcLowPassResult {
	if (
		!Number.isFinite(frequencyHz) ||
		!Number.isFinite(resistanceOhms) ||
		!Number.isFinite(capacitanceFarads) ||
		!Number.isFinite(inputVolts) ||
		frequencyHz <= 0 ||
		resistanceOhms <= 0 ||
		capacitanceFarads <= 0 ||
		inputVolts < 0
	) {
		throw new RangeError('RC parameters must be finite and positive (input voltage may be zero).');
	}

	const cutoffHz = 1 / (2 * Math.PI * resistanceOhms * capacitanceFarads);
	const angularRatio = frequencyHz / cutoffHz;
	const gain = 1 / Math.sqrt(1 + angularRatio * angularRatio);

	return {
		cutoffHz,
		angularRatio,
		gain,
		gainDb: 20 * Math.log10(gain),
		outputVolts: inputVolts * gain,
		phaseDegrees: (-Math.atan(angularRatio) * 180) / Math.PI
	};
}

export function logarithmicFrequency(
	position: number,
	minimumHz = 10,
	maximumHz = 100_000
): number {
	if (
		!Number.isFinite(position) ||
		position < 0 ||
		position > 1 ||
		minimumHz <= 0 ||
		maximumHz <= minimumHz
	) {
		throw new RangeError('Frequency slider position must be within [0, 1].');
	}

	return minimumHz * Math.pow(maximumHz / minimumHz, position);
}
