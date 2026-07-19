export type ClassicalBit = 0 | 1;

export interface RealQubit {
	readonly alpha: number;
	readonly beta: number;
}

export interface TeleportationResult {
	readonly message: RealQubit;
	readonly rawReceiver: RealQubit;
	readonly recovered: RealQubit;
	readonly measurementZ: ClassicalBit;
	readonly measurementX: ClassicalBit;
	readonly fidelity: number;
}

export function normalizeQubit(qubit: RealQubit): RealQubit {
	if (!Number.isFinite(qubit.alpha) || !Number.isFinite(qubit.beta)) {
		throw new RangeError('Qubit amplitudes must be finite.');
	}
	const norm = Math.hypot(qubit.alpha, qubit.beta);
	if (norm === 0) throw new RangeError('A zero vector is not a quantum state.');
	return { alpha: qubit.alpha / norm, beta: qubit.beta / norm };
}

export function qubitFromDegrees(angleDegrees: number): RealQubit {
	if (!Number.isFinite(angleDegrees) || angleDegrees < 0 || angleDegrees > 360) {
		throw new RangeError('Qubit angle must be within [0°, 360°].');
	}
	const halfAngle = (angleDegrees * Math.PI) / 360;
	return { alpha: Math.cos(halfAngle), beta: Math.sin(halfAngle) };
}

function pauliX(qubit: RealQubit): RealQubit {
	return { alpha: qubit.beta, beta: qubit.alpha };
}

function pauliZ(qubit: RealQubit): RealQubit {
	return { alpha: qubit.alpha, beta: -qubit.beta };
}

export function teleport(
	input: RealQubit,
	measurementZ: ClassicalBit,
	measurementX: ClassicalBit
): TeleportationResult {
	if ((measurementZ !== 0 && measurementZ !== 1) || (measurementX !== 0 && measurementX !== 1)) {
		throw new RangeError('Teleportation measurement values must be classical bits.');
	}
	const message = normalizeQubit(input);
	let rawReceiver = message;

	if (measurementZ === 1) rawReceiver = pauliZ(rawReceiver);
	if (measurementX === 1) rawReceiver = pauliX(rawReceiver);

	let recovered = rawReceiver;
	if (measurementX === 1) recovered = pauliX(recovered);
	if (measurementZ === 1) recovered = pauliZ(recovered);
	recovered = normalizeQubit(recovered);

	const overlap = message.alpha * recovered.alpha + message.beta * recovered.beta;

	return {
		message,
		rawReceiver,
		recovered,
		measurementZ,
		measurementX,
		fidelity: Math.min(1, Math.max(0, overlap * overlap))
	};
}
