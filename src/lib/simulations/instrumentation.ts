export const FAULT_MODES = ['none', 'short-ground', 'open-circuit', 'degraded-resistor'] as const;

export type FaultMode = (typeof FAULT_MODES)[number];
export type WaveformKind = 'sine' | 'square' | 'logic' | 'quantum';

export interface ProbeMetric {
	readonly label: string;
	readonly value: string;
	readonly tone?: 'neutral' | 'good' | 'warning' | 'danger';
}

export interface ProbeTarget {
	readonly kind: 'node' | 'port' | 'wire';
	readonly id: string;
	readonly label: string;
}

export function faultLabel(fault: FaultMode): string {
	switch (fault) {
		case 'none':
			return 'Nominal';
		case 'short-ground':
			return 'Short to ground';
		case 'open-circuit':
			return 'Open circuit';
		case 'degraded-resistor':
			return 'Drifted resistance';
	}
}

export function oscilloscopePath(
	kind: WaveformKind,
	phase: number,
	width = 300,
	height = 132,
	points = 72
): string {
	if (
		!Number.isFinite(phase) ||
		!Number.isFinite(width) ||
		!Number.isFinite(height) ||
		width <= 0 ||
		height <= 0 ||
		!Number.isInteger(points) ||
		points < 8 ||
		points > 512
	) {
		throw new RangeError('Oscilloscope geometry is outside its safe rendering bounds.');
	}

	const center = height / 2;
	const amplitude = height * 0.32;
	const commands: string[] = [];
	let previousY = Number.NaN;

	for (let index = 0; index < points; index += 1) {
		const progress = index / (points - 1);
		const theta = progress * Math.PI * 4 + phase;
		let normalized: number;
		switch (kind) {
			case 'square':
				normalized = Math.sin(theta) >= 0 ? -0.86 : 0.86;
				break;
			case 'logic':
				normalized = Math.sin(theta) >= 0 ? -0.72 : 0.72;
				break;
			case 'quantum':
				normalized = -(
					Math.sin(theta) * 0.62 +
					Math.sin(theta * 2.03 + 0.7) * 0.22 +
					Math.sin(theta * 0.5) * 0.1
				);
				break;
			case 'sine':
				normalized = -Math.sin(theta);
				break;
		}

		const x = progress * width;
		const y = center + normalized * amplitude;
		const xValue = x.toFixed(2);
		const yValue = y.toFixed(2);
		if (index === 0) {
			commands.push(`M${xValue} ${yValue}`);
		} else if ((kind === 'square' || kind === 'logic') && y !== previousY) {
			commands.push(`H${xValue}`, `V${yValue}`);
		} else if (kind === 'square' || kind === 'logic') {
			commands.push(`H${xValue}`);
		} else {
			commands.push(`L${xValue} ${yValue}`);
		}
		previousY = y;
	}

	return commands.join(' ');
}

export function formatEngineering(value: number, unit: string, digits = 2): string {
	if (!Number.isFinite(value)) return `— ${unit}`.trim();
	const absolute = Math.abs(value);
	if (absolute === 0) return `${value.toFixed(digits)} ${unit}`.trim();
	const scales = [
		{ threshold: 1e9, divisor: 1e9, prefix: 'G' },
		{ threshold: 1e6, divisor: 1e6, prefix: 'M' },
		{ threshold: 1e3, divisor: 1e3, prefix: 'k' },
		{ threshold: 1, divisor: 1, prefix: '' },
		{ threshold: 1e-3, divisor: 1e-3, prefix: 'm' },
		{ threshold: 1e-6, divisor: 1e-6, prefix: 'µ' },
		{ threshold: 1e-9, divisor: 1e-9, prefix: 'n' }
	] as const;
	const scale =
		scales.find((candidate) => absolute >= candidate.threshold) ?? scales[scales.length - 1];
	return `${(value / scale.divisor).toFixed(digits)} ${scale.prefix}${unit}`.trim();
}
