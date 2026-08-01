import type { LabManifest } from '../lab-manifest';

/**
 * 4-bit Fibonacci LFSR, as a manifest.
 *
 * The retired `LfsrSim.svelte` was 354 lines. Everything that made it that long
 * — the timeline plumbing, the paint effects, the probe wiring, the rack markup
 * — is now the interpreter's job and shared with every other lab. What was
 * genuinely specific to this laboratory is the sixty lines below.
 */
export const lfsrLab: LabManifest = {
	id: 'lfsr',
	title: '4-Bit Fibonacci LFSR',
	domain: 'digital',
	model: 'lfsr',
	formula: 'b_{next} = Q_3 \\oplus Q_4',
	source: `// 4-bit Fibonacci LFSR — maximal-length m-sequence, taps at stages 3 and 4
clock:CLK "clk" at (110, 300) #amber
xor:FB "XOR" at (1090, 80) #purple [inputs=2]
flipflop:Q1 "D1" at (360, 300) #blue [type=d]
flipflop:Q2 "D2" at (560, 300) #cyan [type=d]
flipflop:Q3 "D3" at (760, 300) #emerald [type=d]
flipflop:Q4 "D4" at (960, 300) #amber [type=d]
port:OUT "seq" at (1120, 300) #emerald

Q3.q -> FB.in1 #purple [ortho]
Q4.q -> FB.in2 #purple [ortho]
FB.out -> Q1.d #purple [ortho]
CLK.out -> Q1.clock #amber [ortho]
CLK.out -> Q2.clock #amber [ortho]
CLK.out -> Q3.clock #amber [ortho]
CLK.out -> Q4.clock #amber [ortho]
Q1.q -> Q2.d #blue [line]
Q2.q -> Q3.d #cyan [line]
Q3.q -> Q4.d #emerald [line]
Q4.q -> OUT.in #emerald [line]`,
	inputs: [
		{
			kind: 'number',
			key: 'seed',
			label: 'seed (1–15)',
			min: 1,
			max: 15,
			initial: 8
		}
	],
	bindings: [
		/* One row covers all four stages and both the node and the wire it
		   drives, because the drawing names them consistently. */
		{ signal: 'Q{i}', node: 'Q{i}', wire: 'Q{i}.q', repeat: { from: 1, to: 4 } },
		{ signal: 'feedback', node: 'FB', wire: 'FB.out1' },
		{ signal: 'Q4', node: 'OUT' }
	],
	faults: [
		{
			key: 'movedTap',
			label: 'relocate one feedback tap',
			reveal:
				'The taps are no longer a primitive polynomial. The register still shifts, but it closes into a short cycle instead of visiting all fifteen non-zero states.'
		}
	],
	instruments: [
		{ kind: 'bits', label: 'register', signal: 'Q{i}', count: 4, from: 1 },
		{ kind: 'readout', label: 'register value', signal: 'register', format: 'integer' },
		{ kind: 'readout', label: 'sequence period', signal: 'period', format: 'integer' },
		{ kind: 'scope', label: 'output bit', signal: 'output' }
	]
};
