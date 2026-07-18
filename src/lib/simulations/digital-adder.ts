export type BinarySignal = 0 | 1;
export interface AdderStage { readonly bit: number; readonly a: BinarySignal; readonly b: BinarySignal; readonly carryIn: BinarySignal; readonly sum: BinarySignal; readonly carryOut: BinarySignal }
export interface AdderResult { readonly stages: readonly AdderStage[]; readonly sum: number; readonly carryOut: BinarySignal }

function byte(value: number, label: string): number {
	if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError(`${label} must be an integer from 0 through 255.`);
	return value;
}

function binary(value: number): BinarySignal { return value === 0 ? 0 : 1; }

export function rippleCarry8(aValue: number, bValue: number, carryInput: number): AdderResult {
	const a = byte(aValue, 'aValue');
	const b = byte(bValue, 'bValue');
	if (carryInput !== 0 && carryInput !== 1) throw new RangeError('carryInput must be 0 or 1.');
	let carry: BinarySignal = carryInput;
	let sum = 0;
	const stages: AdderStage[] = [];
	for (let bit = 0; bit < 8; bit += 1) {
		const left = binary((a >> bit) & 1);
		const right = binary((b >> bit) & 1);
		const stageSum = binary(left ^ right ^ carry);
		const carryOut = binary((left & right) | (left & carry) | (right & carry));
		stages.push({ bit, a: left, b: right, carryIn: carry, sum: stageSum, carryOut });
		sum |= stageSum << bit;
		carry = carryOut;
	}
	return { stages, sum, carryOut: carry };
}

export function byteBinary(value: number): string { return byte(value, 'value').toString(2).padStart(8, '0'); }
