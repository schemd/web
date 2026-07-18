export type BinarySignal = 0 | 1;
export interface RealQubit {
	readonly alpha: number;
	readonly beta: number;
}
export interface TeleportationResult {
	readonly input: RealQubit;
	readonly beforeRecovery: RealQubit;
	readonly afterRecovery: RealQubit;
	readonly fidelity: number;
	readonly outcomeProbability: 0.25;
}
function normalize(qubit: RealQubit): RealQubit {
	if (!Number.isFinite(qubit.alpha) || !Number.isFinite(qubit.beta))
		throw new RangeError('amplitudes must be finite.');
	const norm = Math.hypot(qubit.alpha, qubit.beta);
	if (norm === 0) throw new RangeError('at least one amplitude must be non-zero.');
	return { alpha: qubit.alpha / norm, beta: qubit.beta / norm };
}
function x(qubit: RealQubit): RealQubit {
	return { alpha: qubit.beta, beta: qubit.alpha };
}
function z(qubit: RealQubit): RealQubit {
	return { alpha: qubit.alpha, beta: -qubit.beta };
}
export function qubitFromDegrees(degrees: number): RealQubit {
	if (!Number.isFinite(degrees) || degrees < 0 || degrees > 180)
		throw new RangeError('degrees must be from 0 through 180.');
	const radians = (degrees * Math.PI) / 360;
	return { alpha: Math.cos(radians), beta: Math.sin(radians) };
}
export function teleport(inputValue: RealQubit, zBit: number, xBit: number): TeleportationResult {
	const input = normalize(inputValue);
	if ((zBit !== 0 && zBit !== 1) || (xBit !== 0 && xBit !== 1))
		throw new RangeError('measurement bits must be 0 or 1.');
	const safeZ: BinarySignal = zBit;
	const safeX: BinarySignal = xBit;
	let beforeRecovery = input;
	if (safeZ === 1) beforeRecovery = z(beforeRecovery);
	if (safeX === 1) beforeRecovery = x(beforeRecovery);
	let afterRecovery = beforeRecovery;
	if (safeX === 1) afterRecovery = x(afterRecovery);
	if (safeZ === 1) afterRecovery = z(afterRecovery);
	const overlap = input.alpha * afterRecovery.alpha + input.beta * afterRecovery.beta;
	return {
		input,
		beforeRecovery,
		afterRecovery,
		fidelity: Math.min(1, overlap * overlap),
		outcomeProbability: 0.25
	};
}
