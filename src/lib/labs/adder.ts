import type { LabManifest } from '../lab-manifest';

const BITS = 8;

/**
 * Build the ripple-carry drawing.
 *
 * A generator rather than a pasted literal, for the same reason the retired
 * server-side copy was one: eight cells of eleven connections each is 152 lines
 * in which a single transposed index would be invisible. Kept here so the
 * manifest is self-contained and carries no server import — a manifest has to
 * be readable by the client that renders it.
 */
function adderSource(): string {
	const lines: string[] = ['// 8-bit ripple-carry adder — vertical stack, carry ripples downward'];
	const rowHeight = 250;
	const top = 130;
	const xInput = 80;
	const xFirst = 320;
	const xSecond = 560;
	const xCarry = 790;
	const xSum = 980;

	lines.push(`port:CIN "C_{in}" at (${xSecond}, 55) #slate`);
	for (let bit = 0; bit < BITS; bit += 1) {
		const y = top + bit * rowHeight;
		lines.push(
			`port:A${bit} "A_${bit}" at (${xInput}, ${y}) #blue`,
			`port:B${bit} "B_${bit}" at (${xInput}, ${y + 85}) #blue`,
			`xor:X1_${bit} "X" at (${xFirst}, ${y + 5}) #cyan`,
			`and:N1_${bit} "A" at (${xFirst}, ${y + 115}) #amber`,
			`xor:X2_${bit} "X" at (${xSecond}, ${y + 40}) #cyan`,
			`and:N2_${bit} "A" at (${xSecond}, ${y + 145}) #amber`,
			`or:O1_${bit} "O" at (${xCarry}, ${y + 120}) #purple`,
			`port:S${bit} "S_${bit}" at (${xSum}, ${y + 20}) #emerald`
		);
	}
	lines.push(`port:COUT "C_{out}" at (${xCarry}, ${top + BITS * rowHeight - 10}) #emerald`);
	for (let bit = 0; bit < BITS; bit += 1) {
		const carry = bit === 0 ? 'CIN.out' : `O1_${bit - 1}.out`;
		lines.push(
			`A${bit}.out -> X1_${bit}.in1 #blue [ortho]`,
			`B${bit}.out -> X1_${bit}.in2 #blue [ortho]`,
			`A${bit}.out -> N1_${bit}.in1 #blue [ortho]`,
			`B${bit}.out -> N1_${bit}.in2 #blue [ortho]`,
			`X1_${bit}.out -> X2_${bit}.in1 #cyan [ortho]`,
			`${carry} -> X2_${bit}.in2 #slate [ortho]`,
			`X1_${bit}.out -> N2_${bit}.in1 #cyan [ortho]`,
			`${carry} -> N2_${bit}.in2 #slate [ortho]`,
			`N1_${bit}.out -> O1_${bit}.in1 #amber [ortho]`,
			`N2_${bit}.out -> O1_${bit}.in2 #amber [ortho]`,
			`X2_${bit}.out -> S${bit}.in #emerald [ortho]`
		);
	}
	lines.push(`O1_${BITS - 1}.out -> COUT.in #purple [ortho]`);
	return lines.join('\n');
}

/** 8-bit ripple-carry adder, as a manifest. */
export const adderLab: LabManifest = {
	id: 'adder',
	title: '8-Bit Digital Adder',
	domain: 'digital',
	model: 'adder',
	formula: 'S_i = A_i \\oplus B_i \\oplus C_i \\;\\cdot\\; C_{i+1} = A_iB_i + C_i(A_i \\oplus B_i)',
	source: adderSource(),
	inputs: [
		{ kind: 'number', key: 'a', label: 'operand A', min: 0, max: 255, initial: 203 },
		{ kind: 'number', key: 'b', label: 'operand B', min: 0, max: 255, initial: 91 },
		{ kind: 'toggle', key: 'carryIn', label: 'carry in', initial: false }
	],
	bindings: [
		{ signal: 'A{i}', node: 'A{i}', wire: 'A{i}.out', repeat: { from: 0, to: 7 } },
		{ signal: 'B{i}', node: 'B{i}', wire: 'B{i}.out', repeat: { from: 0, to: 7 } },
		{ signal: 'CIN', node: 'CIN', wire: 'CIN.out' },
		/* The sum bits and the carry a cell hands upward are gated by the model's
		   ripple frontier, which is what makes the front visible as it travels. */
		{ signal: 'S{i}', node: 'S{i}', repeat: { from: 0, to: 7 } },
		{ signal: 'C{i}', wire: 'O1_{i}.out', repeat: { from: 0, to: 7 } },
		{ signal: 'carryOut', node: 'COUT' }
	],
	faults: [
		{
			key: 'stuckCarry',
			label: 'interrupt the carry chain',
			reveal:
				'Every carry is forced low. The low bits stay correct, which is what makes it hard to spot — only sums that should have carried are wrong.'
		}
	],
	instruments: [
		{ kind: 'readout', label: 'sum', signal: 'sum', format: 'integer' },
		{ kind: 'readout', label: 'carry out', signal: 'carryOut', format: 'integer' },
		{ kind: 'bits', label: 'sum bits', signal: 'S{i}', count: 8 },
		{ kind: 'scope', label: 'carry front', signal: 'frontier' }
	]
};
