/** A value with an SI prefix, as a bench instrument prints it: `10.0 kΩ`, `4.70 µF`. */
export function formatSi(value: number, unit: string, digits = 2): string {
	if (!Number.isFinite(value)) return `∞ ${unit}`;
	if (value === 0) return `0 ${unit}`;
	const prefixes: ReadonlyArray<readonly [number, string]> = [
		[1e9, 'G'],
		[1e6, 'M'],
		[1e3, 'k'],
		[1, ''],
		[1e-3, 'm'],
		[1e-6, 'µ'],
		[1e-9, 'n']
	];
	for (const [scale, prefix] of prefixes) {
		if (Math.abs(value) >= scale * 0.9995)
			return `${(value / scale).toFixed(digits)} ${prefix}${unit}`;
	}
	return `${value.toExponential(digits)} ${unit}`;
}

/** A signed number with an explicit sign, so a reader sees direction: `+0.50`, `−0.33`. */
export function signed(value: number, digits = 2): string {
	const text = Math.abs(value).toFixed(digits);
	return Number(text) === 0 ? text : `${value < 0 ? '−' : '+'}${text}`;
}
