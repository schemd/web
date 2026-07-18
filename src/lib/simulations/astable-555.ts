export interface AstableTiming { readonly highSeconds: number; readonly lowSeconds: number; readonly periodSeconds: number; readonly frequencyHz: number; readonly dutyCycle: number }
export function astableTiming(resistorOneOhms: number, resistorTwoOhms: number, capacitanceFarads: number): AstableTiming {
	for (const [value, label] of [[resistorOneOhms, 'resistorOneOhms'], [resistorTwoOhms, 'resistorTwoOhms'], [capacitanceFarads, 'capacitanceFarads']] as const) {
		if (!Number.isFinite(value) || value <= 0) throw new RangeError(`${label} must be greater than zero.`);
	}
	const highSeconds = Math.LN2 * (resistorOneOhms + resistorTwoOhms) * capacitanceFarads;
	const lowSeconds = Math.LN2 * resistorTwoOhms * capacitanceFarads;
	const periodSeconds = highSeconds + lowSeconds;
	return { highSeconds, lowSeconds, periodSeconds, frequencyHz: 1 / periodSeconds, dutyCycle: highSeconds / periodSeconds };
}
