import { describe, expect, it } from 'vitest';
import { interactiveSchematicSvg } from './interactive-svg';

describe('interactiveSchematicSvg', () => {
	it('promotes only the root SVG image role', () => {
		const svg =
			'<figure><svg class="schematic-svg" role="img" aria-labelledby="title"><title id="title">Lab</title><g role="button"></g></svg></figure>';

		expect(interactiveSchematicSvg(svg)).toBe(
			'<figure><svg class="schematic-svg" role="group" aria-labelledby="title"><title id="title">Lab</title><g role="button"></g></svg></figure>'
		);
	});

	it('leaves markup without a root image role unchanged', () => {
		const svg = '<svg role="group"><g role="button"></g></svg>';
		expect(interactiveSchematicSvg(svg)).toBe(svg);
	});
});
