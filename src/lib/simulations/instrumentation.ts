export type FaultMode = 'none' | 'short-ground' | 'open-circuit' | 'degraded-resistor';
export type WaveformKind = 'sine' | 'square' | 'logic' | 'quantum';

export interface ProbeMetric {
	readonly label: string;
	readonly value: string;
}

function waveformSample(kind: WaveformKind, position: number): number {
	switch (kind) {
		case 'sine':
			return Math.sin(position * Math.PI * 2);
		case 'square':
			return position % 1 < 0.58 ? 1 : -1;
		case 'logic':
			return position % 1 < 0.5 ? 1 : -1;
		case 'quantum':
			return Math.sin(position * Math.PI * 2) * 0.7 + Math.sin(position * Math.PI * 4) * 0.2;
	}
}

export function oscilloscopePath(
	kind: WaveformKind,
	phase: number,
	width = 240,
	height = 140,
	points = 96
): string {
	if (!Number.isFinite(phase)) throw new RangeError('phase must be finite.');
	if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0)
		throw new RangeError('scope dimensions must be positive.');
	if (!Number.isInteger(points) || points < 8 || points > 512)
		throw new RangeError('scope points must be an integer from 8 through 512.');
	const normalizedPhase = ((phase % 1) + 1) % 1;
	const values: string[] = [];
	for (let index = 0; index < points; index += 1) {
		const progress = index / (points - 1);
		const sample = waveformSample(kind, progress * 2 + normalizedPhase);
		const x = progress * width;
		const y = height / 2 - sample * height * 0.34;
		values.push(`${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
	}
	return values.join(' ');
}

export function faultLabel(fault: FaultMode): string {
	switch (fault) {
		case 'none':
			return 'Nominal circuit';
		case 'short-ground':
			return 'Short to ground';
		case 'open-circuit':
			return 'Open circuit';
		case 'degraded-resistor':
			return 'Degraded resistor';
	}
}
