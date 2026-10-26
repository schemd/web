import { describe, expect, it } from 'vitest';
import { COMPONENT_KINDS, compileSchematic } from '@schemd/core';
import { describeComponentPorts } from '@schemd/core/schema';
import { componentReference, componentSheet } from './components';

describe('generated component references', () => {
	it('rejects unknown and inherited object keys', () => {
		for (const kind of ['constructor', 'toString', '__proto__', 'unknown'])
			expect(componentSheet(kind)).toBeUndefined();
	});
	it('opens every default and variant source inside the default playground canvas', () => {
		for (const kind of COMPONENT_KINDS) {
			const sheet = componentSheet(kind)!;
			for (const specimen of [sheet.specimen, ...(sheet.variants?.specimens ?? [])]) {
				expect(() =>
					compileSchematic(specimen.source, { bounds: { width: 960, height: 640 }, title: kind })
				).not.toThrow();
			}
		}
	});
	it('places every inserted default within the default canvas', () => {
		for (const entry of componentReference()) {
			const source = entry.template.replace(
				'at (X, Y)',
				`at (${Math.max(90, entry.inset.x)}, ${Math.max(90, entry.inset.y)})`
			);
			expect(() =>
				compileSchematic(source, { bounds: { width: 960, height: 640 }, title: entry.kind })
			).not.toThrow();
		}
	});
	it('reports each variant terminal set from its actual options', () => {
		const sheet = componentSheet('transistor')!;
		for (const variant of sheet.variants!.specimens)
			expect(variant.pins.map((pin) => pin.name)).toEqual(
				describeComponentPorts('transistor', { type: variant.value })
			);
		expect(
			sheet.variants!.specimens.find((item) => item.value === 'nmos')!.pins.map((pin) => pin.name)
		).toContain('gate');
	});
});
