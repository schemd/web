import { describe, expect, it } from 'vitest';
import { compileSchematic } from '@schemd/core';
import { decodeWorkspaceState } from '#lib/state-uri.ts';
import { STARTER_TEMPLATES, templateHref } from './templates';

describe('starter templates', () => {
	it('covers each supported family with distinct IDs', () => {
		expect(new Set(STARTER_TEMPLATES.map((item) => item.family))).toEqual(
			new Set(['electrical', 'digital', 'quantum', 'uml'])
		);
		expect(new Set(STARTER_TEMPLATES.map((item) => item.id)).size).toBe(STARTER_TEMPLATES.length);
	});
	for (const template of STARTER_TEMPLATES)
		it(`${template.id} compiles and opens with its complete workspace state`, () => {
			expect(
				compileSchematic(template.source, {
					bounds: { width: template.width, height: template.height },
					title: template.title
				}).metrics.components
			).toBeGreaterThan(0);
			const url = new URL(templateHref(template, '1.3.0'), 'https://schemd.invalid');
			expect(url.pathname).toBe('/playground/1.3.0');
			expect(decodeWorkspaceState(url.searchParams.get('code')!)).toBe(template.source);
			expect(url.searchParams.get('w')).toBe(String(template.width));
			expect(url.searchParams.get('h')).toBe(String(template.height));
			expect(url.searchParams.get('t')).toBe(template.title);
			expect(url.searchParams.get('m')).toBe('default');
		});
});
