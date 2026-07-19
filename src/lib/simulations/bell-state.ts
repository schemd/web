export type BellStep = 0 | 1 | 2;
export type ComputationalBasis = '00' | '01' | '10' | '11';

export interface BellState {
	readonly step: BellStep;
	readonly label: string;
	readonly amplitudes: readonly [number, number, number, number];
	readonly probabilities: readonly [number, number, number, number];
}

const INVERSE_SQRT_TWO = 1 / Math.sqrt(2);

export function bellState(step: BellStep): BellState {
	switch (step) {
		case 0:
			return {
				step,
				label: '|00⟩',
				amplitudes: [1, 0, 0, 0],
				probabilities: [1, 0, 0, 0]
			};
		case 1:
			return {
				step,
				label: '(|00⟩ + |10⟩) / √2',
				amplitudes: [INVERSE_SQRT_TWO, 0, INVERSE_SQRT_TWO, 0],
				probabilities: [0.5, 0, 0.5, 0]
			};
		case 2:
			return {
				step,
				label: '(|00⟩ + |11⟩) / √2',
				amplitudes: [INVERSE_SQRT_TWO, 0, 0, INVERSE_SQRT_TWO],
				probabilities: [0.5, 0, 0, 0.5]
			};
	}
}

export function nextBellStep(step: BellStep): BellStep {
	switch (step) {
		case 0:
			return 1;
		case 1:
			return 2;
		case 2:
			return 0;
	}
}

export function measureBell(randomValue: number): ComputationalBasis {
	if (!Number.isFinite(randomValue) || randomValue < 0 || randomValue >= 1) {
		throw new RangeError('Measurement entropy must be within [0, 1).');
	}
	return randomValue < 0.5 ? '00' : '11';
}
