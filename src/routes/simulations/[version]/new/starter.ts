import type { LabManifest } from '$lib/lab-manifest';

/**
 * The manifest the builder opens with.
 *
 * Deliberately a complete, working laboratory rather than an empty skeleton:
 * an author learns this schema far faster by changing something that already
 * runs than by filling in blank fields, and every field they will need is
 * already in front of them with a real value in it.
 *
 * It reuses the `lfsr` model because that model is already whitelisted — which
 * is itself the lesson. An author composes a drawing, controls, and bindings;
 * they cannot introduce new mathematics from the browser, and the starter says
 * so by example.
 */
export const STARTER_LAB: LabManifest = {
	id: 'my-lab',
	title: 'My laboratory',
	domain: 'digital',
	model: 'lfsr',
	formula: 'b_{next} = Q_3 \\oplus Q_4',
	source: `clock:CLK "clk" at (90, 200) #amber
flipflop:Q1 "D1" at (300, 200) #blue [type=d]
flipflop:Q2 "D2" at (480, 200) #cyan [type=d]
flipflop:Q3 "D3" at (660, 200) #emerald [type=d]
flipflop:Q4 "D4" at (840, 200) #amber [type=d]

CLK.out -> Q1.clock #amber [ortho]
CLK.out -> Q2.clock #amber [ortho]
CLK.out -> Q3.clock #amber [ortho]
CLK.out -> Q4.clock #amber [ortho]
Q1.q -> Q2.d #blue [line]
Q2.q -> Q3.d #cyan [line]
Q3.q -> Q4.d #emerald [line]`,
	inputs: [{ kind: 'number', key: 'seed', label: 'seed (1–15)', min: 1, max: 15, initial: 9 }],
	bindings: [{ signal: 'Q{i}', node: 'Q{i}', wire: 'Q{i}.q', repeat: { from: 1, to: 4 } }],
	faults: [
		{
			key: 'movedTap',
			label: 'relocate one feedback tap',
			reveal: 'The taps are no longer primitive, so the sequence closes early.'
		}
	],
	instruments: [
		{ kind: 'bits', label: 'register', signal: 'Q{i}', count: 4, from: 1 },
		{ kind: 'readout', label: 'period', signal: 'period', format: 'integer' }
	]
};
