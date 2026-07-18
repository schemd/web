export type BellStep = 0 | 1 | 2;
export interface BellState {
	readonly step: BellStep;
	readonly label: string;
	readonly ket: string;
	readonly probability00: number;
	readonly probability11: number;
	readonly otherProbability: number;
}
const STATES: readonly BellState[] = [
	{
		step: 0,
		label: 'Initialize',
		ket: '|00⟩',
		probability00: 1,
		probability11: 0,
		otherProbability: 0
	},
	{
		step: 1,
		label: 'Hadamard',
		ket: '(|00⟩ + |10⟩) / √2',
		probability00: 0.5,
		probability11: 0,
		otherProbability: 0.5
	},
	{
		step: 2,
		label: 'Entangle',
		ket: '(|00⟩ + |11⟩) / √2',
		probability00: 0.5,
		probability11: 0.5,
		otherProbability: 0
	}
];
export function bellState(step: BellStep): BellState {
	return STATES[step];
}
export function nextBellStep(step: BellStep): BellStep {
	return step === 2 ? 0 : step === 1 ? 2 : 1;
}
export function measureBell(sample: number): '00' | '11' {
	if (!Number.isFinite(sample) || sample < 0 || sample >= 1)
		throw new RangeError('sample must be in [0, 1).');
	return sample < 0.5 ? '00' : '11';
}
