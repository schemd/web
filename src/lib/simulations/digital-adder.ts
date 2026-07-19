export type BinarySignal = 0 | 1;

export interface AdderStage {
	readonly bit: number;
	readonly a: BinarySignal;
	readonly b: BinarySignal;
	readonly carryIn: BinarySignal;
	readonly sum: BinarySignal;
	readonly carryOut: BinarySignal;
}

export interface RippleCarryResult {
	readonly stages: readonly AdderStage[];
	readonly sum: number;
	readonly carryOut: BinarySignal;
	readonly nineBitResult: number;
}

function assertByte(value: number, label: string): void {
	if (!Number.isInteger(value) || value < 0 || value > 0xff) {
		throw new RangeError(`${label} must be an unsigned 8-bit integer.`);
	}
}

function binarySignal(value: number): BinarySignal {
	if (value === 0 || value === 1) return value;
	throw new RangeError('Internal adder state escaped the binary domain.');
}

export function rippleCarry8(
	aValue: number,
	bValue: number,
	carryIn: BinarySignal
): RippleCarryResult {
	assertByte(aValue, 'A');
	assertByte(bValue, 'B');
	if (carryIn !== 0 && carryIn !== 1) {
		throw new RangeError('Carry-in must be 0 or 1.');
	}

	const stages: AdderStage[] = [];
	let carry = carryIn;
	let sum = 0;

	for (let bit = 0; bit < 8; bit += 1) {
		const a = binarySignal((aValue >>> bit) & 1);
		const b = binarySignal((bValue >>> bit) & 1);
		const stageCarryIn = carry;
		const stageSum = binarySignal(a ^ b ^ stageCarryIn);
		carry = binarySignal((a & b) | (a & stageCarryIn) | (b & stageCarryIn));
		sum |= stageSum << bit;
		stages.push({
			bit,
			a,
			b,
			carryIn: stageCarryIn,
			sum: stageSum,
			carryOut: carry
		});
	}

	return {
		stages,
		sum,
		carryOut: carry,
		nineBitResult: sum | (carry << 8)
	};
}

export function byteBinary(value: number): string {
	assertByte(value, 'Value');
	return value.toString(2).padStart(8, '0');
}
