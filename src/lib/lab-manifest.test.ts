import { describe, expect, it } from 'vitest';

import { expandBindings, fillIndex, validateLabManifest, type LabManifest } from './lab-manifest';
import { LAB_MODEL_NAMES, resolveLabModel } from './lab-models';
import { allLabManifests, DECLARATIVE_LAB_IDS, loadLabManifest } from './labs';

/** A minimal valid manifest; each test below spreads one problem onto it. */
const base: LabManifest = {
	id: 'probe',
	title: 'Probe',
	domain: 'digital',
	model: 'lfsr',
	source: 'port:A "A" at (10, 10) #blue',
	inputs: [],
	bindings: [],
	faults: [],
	instruments: []
};

describe('binding expansion', () => {
	it('substitutes the index into every template it is given', () => {
		expect(fillIndex('O1_{i}.out', 3)).toBe('O1_3.out');
		expect(fillIndex('no-template', 3)).toBe('no-template');
	});

	it('expands one row per index, inclusive of both ends', () => {
		const rows = expandBindings([{ signal: 'S{i}', node: 'S{i}', repeat: { from: 0, to: 7 } }]);
		expect(rows).toHaveLength(8);
		expect(rows[0]?.signal).toBe('S0');
		expect(rows[7]?.node).toBe('S7');
	});

	it('leaves an un-repeated binding alone', () => {
		const rows = expandBindings([{ signal: 'carryOut', node: 'COUT' }]);
		expect(rows).toEqual([{ signal: 'carryOut', node: 'COUT', as: 'active', threshold: 1 }]);
	});

	/*
	 * A backwards range paints nothing rather than throwing. The paint runs
	 * inside an effect, and an exception there takes the whole laboratory down
	 * over what is really an authoring typo.
	 */
	it('yields nothing for a backwards range instead of throwing', () => {
		expect(expandBindings([{ signal: 'S{i}', node: 'S{i}', repeat: { from: 4, to: 0 } }])).toEqual(
			[]
		);
	});
});

describe('manifest validation', () => {
	it('rejects a model the registry does not hold', () => {
		const problems = validateLabManifest({ ...base, model: 'rm -rf' }, LAB_MODEL_NAMES);
		expect(problems.join(' ')).toContain('is not registered');
	});

	it('rejects a binding that paints neither a node nor a wire', () => {
		const problems = validateLabManifest(
			{ ...base, bindings: [{ signal: 'orphan' }] },
			LAB_MODEL_NAMES
		);
		expect(problems.join(' ')).toContain('names neither a node nor a wire');
	});

	it('rejects a key that is both an input and a fault', () => {
		const problems = validateLabManifest(
			{
				...base,
				inputs: [{ kind: 'toggle', key: 'clash', label: 'x' }],
				faults: [{ key: 'clash', label: 'y', reveal: 'z' }]
			},
			LAB_MODEL_NAMES
		);
		expect(problems.join(' ')).toContain('both an input and a fault');
	});

	/* Validation runs here rather than at module load: a manifest is lazily
	   imported by the route, so eagerly validating them all would defeat the
	   very lazy-loading this migration had to preserve. */
	it('accepts every manifest that ships', async () => {
		for (const manifest of await allLabManifests()) {
			expect(validateLabManifest(manifest, LAB_MODEL_NAMES)).toEqual([]);
		}
	});
});

describe('the model registry is a whitelist', () => {
	/*
	 * The security property the whole schema rests on: a manifest selects a
	 * *name*, never code. These are the shapes a hostile or careless manifest
	 * would actually contain.
	 */
	it.each([
		'./simulation-models',
		'../lab-models',
		'/etc/passwd',
		'constructor',
		'__proto__',
		'toString'
	])('refuses to resolve %s', (name) => {
		expect(resolveLabModel(name)).toBeUndefined();
	});

	it('resolves exactly the names it advertises', () => {
		for (const name of LAB_MODEL_NAMES) expect(resolveLabModel(name)).toBeTypeOf('function');
	});
});

/*
 * The route still compiles the drawing from the server's own source table, so a
 * migrated lab now has its schemd text written down twice. Until the manifest
 * becomes the single source, this is the seam where they can silently disagree
 * — and a manifest binding `S7` against a drawing that no longer draws `S7`
 * paints nothing, with no error anywhere.
 */
describe('manifest and server sources agree', () => {
	it.each([...DECLARATIVE_LAB_IDS])('%s', async (id) => {
		const { getSimulationSource } = await import('./server/simulations');
		expect(getSimulationSource(id)).toBe((await loadLabManifest(id)).source);
	});
});

describe('migrated models', () => {
	it('ripples the adder carry one cell per stage', () => {
		const adder = resolveLabModel('adder')!;
		const early = adder({ inputs: { a: 255, b: 1 }, faults: {}, step: 1 });
		const settled = adder({ inputs: { a: 255, b: 1 }, faults: {}, step: 9 });
		/* Only the first cell has decided at stage 1, so the top bits are dark. */
		expect(early.signals['S7']).toBe(0);
		expect(settled.signals['sum']).toBe(0);
		expect(settled.signals['carryOut']).toBe(1);
	});

	it('reports a shorter period once a tap is moved', () => {
		const lfsr = resolveLabModel('lfsr')!;
		const healthy = lfsr({ inputs: { seed: 8 }, faults: {}, step: 0 });
		const broken = lfsr({ inputs: { seed: 8 }, faults: { movedTap: true }, step: 0 });
		expect(healthy.signals['period']).toBe(15);
		expect(broken.signals['period']!).toBeLessThan(15);
	});

	it('names its stages for the drawing, one-based', () => {
		const frame = resolveLabModel('lfsr')!({ inputs: { seed: 8 }, faults: {}, step: 0 });
		expect(frame.signals).toHaveProperty('Q1');
		expect(frame.signals).toHaveProperty('Q4');
		expect(frame.signals).not.toHaveProperty('Q0');
	});

	/*
	 * Caught in a browser, not here: a bits panel reads `count` signals from a
	 * start index, and defaulting that to 0 made the LFSR's `Q1`…`Q4` render as
	 * four zeroes beside a register value of 8. Every bits instrument must read
	 * signals its own model actually emits, which is a property the manifests
	 * can be checked for directly.
	 */
	it('reads bits panels from indices its model emits', async () => {
		for (const manifest of await allLabManifests()) {
			const model = resolveLabModel(manifest.model)!;
			const emitted = model({ inputs: {}, faults: {}, step: 99 }).signals;
			for (const instrument of manifest.instruments) {
				if (instrument.kind !== 'bits') continue;
				const from = instrument.from ?? 0;
				for (let offset = 0; offset < instrument.count; offset += 1) {
					const key = fillIndex(instrument.signal, from + offset);
					expect(emitted, `${manifest.id} bits panel reads ${key}`).toHaveProperty(key);
				}
			}
		}
	});
});
