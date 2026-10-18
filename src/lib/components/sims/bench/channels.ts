import type { ProbeNet } from './types';

/** Channel colours match the probe clips: A copper, B cyan. */
const CHANNELS = [
	['A', 'var(--accent)'],
	['B', 'var(--schematic-color-cyan)']
] as const;

/** The scope channels for whatever probes A and B are clipped to. */
export function probeChannels(nets: readonly ProbeNet[], a: string | null, b: string | null) {
	return [a, b].flatMap((id, index) => {
		const net = id ? nets.find((candidate) => candidate.id === id) : undefined;
		if (!net) return [];
		const [letter, color] = CHANNELS[index]!;
		return [
			{
				id: net.id,
				letter,
				color,
				label: net.label,
				unit: net.unit,
				ac: net.ac,
				sample: net.sample,
				summary: net.summary()
			}
		];
	});
}
