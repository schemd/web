import { describe, expect, it } from 'vitest';
import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { describedDiagram } from './schemd-figure';

const fence = parseSchematicFence('schemd bounds="760x440" title="RC filter"')!;
const compile = (source: string) =>
	compileSchematic(source, { ...fence, mode: 'default', idPrefix: 'test' });

const RC = `source:VIN "V_{in}" at (80, 120) #blue [type=voltage-ac]
resistor:R1 "10 k\\Omega" at (260, 120) #amber
capacitor:C1 "100 nF" at (440, 242) #cyan [orientation=down]
ground:GND "0 V" at (220, 350) #slate

VIN.positive -> R1.in #blue [line]
R1.out -> C1.in #amber [ortho]
C1.out -> GND.in #cyan [ortho]`;

describe('describedDiagram', () => {
	it('labels the figure with a sentence derived from the topology', () => {
		const html = describedDiagram(compile(RC));
		expect(html).toContain(
			'aria-label="Four components joined by three nets, carrying electrical signals."'
		);
	});

	it('keeps one figure and one caption', () => {
		const html = describedDiagram(compile(RC));
		expect((html.match(/<figure/g) ?? []).length).toBe(1);
		expect((html.match(/<figcaption/g) ?? []).length).toBe(1);
	});

	it('keeps the authored title and adds the summary beside it', () => {
		const html = describedDiagram(compile(RC));
		expect(html).toContain('<figcaption>RC filter <span class="schematic-summary">');
	});

	it('carries the full account for anything that wants it', () => {
		const html = describedDiagram(compile(RC));
		expect(html).toContain('An unnamed net ties VIN.positive and R1.in.');
		expect(html).toContain('R1 (10 kΩ)');
	});

	it('escapes label characters that would otherwise break the attribute', () => {
		/* The grammar has no delimiter escapes yet, so a quote cannot reach a
		   label — but `&` and `<` can, and both must not leak into markup. */
		const html = describedDiagram(compile('port:A "a & b < c" at (200, 150) #blue'));
		expect(html).toContain('a &amp; b &lt; c');
		expect(html).not.toContain('a & b < c');
	});

	it('returns the diagram untouched if the compiler changes its frame markup', () => {
		const compiled = compile(RC);
		const reshaped = { ...compiled, svg: '<svg><g/></svg>' };
		expect(describedDiagram(reshaped)).toBe('<svg><g/></svg>');
	});
});
