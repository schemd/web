import { describe, expect, it } from 'vitest';
import { completionAt, completionInsertion, type CompletionVocabulary } from './completion';

const vocabulary: CompletionVocabulary = {
	kinds: ['resistor', 'capacitor', 'source', 'switch', 'junction', 'ground'],
	colors: ['amber', 'blue', 'cyan', 'emerald', 'purple', 'slate'],
	orientations: ['right', 'down', 'left', 'up']
};

const at = (source: string) => completionAt(source, source.length, vocabulary);

/* The shape the playground builds from `@schemd/core/schema` and the last compile. */
const schema: CompletionVocabulary = {
	...vocabulary,
	options: {
		resistor: [
			{ name: 'type', values: ['fixed', 'variable', 'thermistor'] },
			{ name: 'orientation', values: ['right', 'down', 'left', 'up'] }
		],
		mux: [
			{ name: 'type', values: ['mux', 'demux'] },
			{ name: 'inputs', values: [] }
		]
	},
	ports: { R1: ['in', 'out'], U1: ['in1', 'in2', 'out1', 'select', 'enable'] }
};
const atSchema = (source: string) => completionAt(source, source.length, schema);

describe('completionAt', () => {
	it('completes a component kind at the head of a line', () => {
		expect(at('res')?.items).toEqual(['resistor']);
		expect(at('s')?.items).toEqual(['source', 'switch']);
		expect(at('resistor:R1 "R" at (10,10)\nca')?.items).toEqual(['capacitor']);
	});

	it('replaces only the typed prefix', () => {
		const context = at('resistor:R1 "R" at (10,10)\nca');
		expect(context?.from).toBe('resistor:R1 "R" at (10,10)\n'.length);
		expect(context?.to).toBe('resistor:R1 "R" at (10,10)\nca'.length);
	});

	it('completes semantic colours after #', () => {
		expect(at('resistor:R1 "R" at (10,10) #')?.items).toEqual(vocabulary.colors.slice(0, 6));
		expect(at('resistor:R1 "R" at (10,10) #a')?.items).toEqual(['amber']);
		expect(at('VIN.out -> R1.in #c')?.kind).toBe('color');
	});

	it('completes orientations inside an option block', () => {
		expect(at('capacitor:C1 "C" at (10,10) [orientation=')?.items).toEqual(vocabulary.orientations);
		expect(at('capacitor:C1 "C" at (10,10) [orientation=d')?.items).toEqual(['down']);
	});

	it('stays quiet where nothing can be completed', () => {
		expect(at('resistor:R1 "R" at (10,')).toBeUndefined(); // coordinates
		expect(at('// a comment about res')).toBeUndefined(); // comments
		expect(at('resistor:R1 "a res')).toBeUndefined(); // inside a label
		expect(at('resistor:R1 "R" at (10,10) #zzz')).toBeUndefined(); // no match
		expect(at('')).toBeUndefined(); // empty line offers the whole vocabulary — too noisy
	});

	it('suppresses a list whose only entry is already typed', () => {
		expect(at('resistor')).toBeUndefined();
		expect(at('resistor:R1 "R" at (10,10) #amber')).toBeUndefined();
	});

	it('is case-insensitive but preserves canonical spelling', () => {
		expect(at('RES')?.items).toEqual(['resistor']);
	});

	it('resolves against the caret, not the end of the document', () => {
		const source = 'res\nresistor:R2 "R" at (10,10) #amber';
		expect(completionAt(source, 3, vocabulary)?.items).toEqual(['resistor']);
	});

	it('rejects an out-of-range caret', () => {
		expect(completionAt('res', 99, vocabulary)).toBeUndefined();
		expect(completionAt('res', -1, vocabulary)).toBeUndefined();
	});
});

describe('completionInsertion', () => {
	it('carries the separator a declaration needs', () => {
		expect(completionInsertion('resistor', 'kind')).toBe('resistor:');
		expect(completionInsertion('amber', 'color')).toBe('amber');
		expect(completionInsertion('down', 'orientation')).toBe('down');
	});
});

describe('completion from the component schema', () => {
	it('offers only the options the declared kind accepts', () => {
		expect(atSchema('resistor:R1 "R" at (10,10) [')?.items).toEqual(['type', 'orientation']);
		expect(atSchema('mux:U1 at (10,10) [i')?.items).toEqual(['inputs']);
		expect(atSchema('mux:U1 at (10,10) [i')?.kind).toBe('option');
	});

	it('leaves out an option already written', () => {
		expect(atSchema('resistor:R1 "R" at (10,10) [type=fixed ')?.items).toEqual(['orientation']);
	});

	it('offers an enum option its values', () => {
		expect(atSchema('resistor:R1 "R" at (10,10) [type=')?.items).toEqual([
			'fixed',
			'variable',
			'thermistor'
		]);
		expect(atSchema('resistor:R1 "R" at (10,10) [type=th')?.items).toEqual(['thermistor']);
		expect(atSchema('mux:U1 at (10,10) [type=de')?.kind).toBe('value');
	});

	it('offers the real ports of a declared part', () => {
		expect(atSchema('R1.')?.items).toEqual(['in', 'out']);
		expect(atSchema('R1.out -> U1.s')?.items).toEqual(['select']);
		expect(atSchema('R1.out -> U1.s')?.kind).toBe('port');
		expect(atSchema('ZZ.')).toBeUndefined();
	});

	it('inserts an option with its equals sign', () => {
		expect(completionInsertion('type', 'option')).toBe('type=');
		expect(completionInsertion('select', 'port')).toBe('select');
	});
});
