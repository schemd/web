import { describe, expect, test } from 'vitest';
import { listSimulationEnvironments } from './simulations';
import {
	renderSimulationMath,
	renderSimulationTimeline,
	simulationMathTemplateIds
} from './simulation-math';
import { timelineFor } from '$lib/simulation-timelines';

describe('server-rendered live simulation math', () => {
	test('renders a complete, error-free, simulation-scoped KaTeX registry', () => {
		for (const { id } of listSimulationEnvironments()) {
			const expected = simulationMathTemplateIds(id);
			const rendered = renderSimulationMath(id);
			expect(Object.keys(rendered), `${id}: registry keys`).toEqual(expected);
			expect(expected.length, `${id}: template coverage`).toBeGreaterThan(1);
			for (const [templateId, html] of Object.entries(rendered)) {
				expect(html, `${templateId}: KaTeX output`).toContain('class="katex"');
				expect(html, `${templateId}: no render errors`).not.toContain('katex-error');
				expect(html, `${templateId}: HTML-only output`).not.toContain('<math');
				expect(html, `${templateId}: no executable markup`).not.toMatch(/<script|onerror=/i);
			}
			/* A lab receives only its own templates, not the entire 13-lab catalogue. */
			expect(JSON.stringify(rendered).length, `${id}: serialized registry budget`).toBeLessThan(
				90_000
			);
		}
	});

	test('emits inert named slots for client-side numeric updates', () => {
		const html = renderSimulationMath('rc')['rc.readout.h'];
		expect(html).toContain('data-math-slot="magnitude"');
		expect(html).toContain('data-math-slot="db"');
	});

	test('typesets notation embedded in timeline prose on the server', () => {
		const adder = renderSimulationTimeline(timelineFor('adder'));
		expect(adder[0]?.labelHtml).toContain('class="katex"');
		expect(adder.at(-1)?.labelHtml).toContain('class="katex"');
		expect(
			adder.flatMap((stage) => [stage.labelHtml, stage.explanationHtml]).join('')
		).not.toContain('katex-error');
	});
});
