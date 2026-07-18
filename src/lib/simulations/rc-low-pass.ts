export interface RcResponse { readonly cutoffHz: number; readonly gain: number; readonly outputVolts: number; readonly phaseDegrees: number }
export function rcLowPass(frequencyHz: number, resistanceOhms: number, capacitanceFarads: number, inputVolts: number): RcResponse {
	for (const [value, label] of [[frequencyHz, 'frequencyHz'], [resistanceOhms, 'resistanceOhms'], [capacitanceFarads, 'capacitanceFarads'], [inputVolts, 'inputVolts']] as const) {
		if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be greater than zero.`);
	}
	const cutoffHz = 1 / (2 * Math.PI * resistanceOhms * capacitanceFarads);
	const ratio = frequencyHz / cutoffHz;
	const gain = 1 / Math.sqrt(1 + ratio * ratio);
	return { cutoffHz, gain, outputVolts: inputVolts * gain, phaseDegrees: -Math.atan(ratio) * 180 / Math.PI };
}
export function logarithmicFrequency(position: number, minimum = 10, maximum = 100_000): number {
	if (!Number.isFinite(position) || position < 0 || position > 1) throw new RangeError('position must be in [0, 1].');
	if (minimum <= 0 || maximum <= minimum) throw new RangeError('frequency bounds are invalid.');
	return 10 ** (Math.log10(minimum) + position * (Math.log10(maximum) - Math.log10(minimum)));
}
