import { describe, expect, it } from 'vitest';
import { messagesFor } from './message-catalog';
import { translator } from '#lib/i18n/index.ts';
import { getSimulation, listSimulationEnvironments } from './simulations';
import { renderSimulationTimeline } from './simulation-math';
import { timelineFor } from '#lib/simulation-timelines.ts';

describe('localized server content', () => {
	it('keeps dictionaries isolated by language and section', () => {
		const english = translator(messagesFor('/templates', 'en'));
		const spanish = translator(messagesFor('/es/templates', 'es'));
		expect(messagesFor('/unknown-one', 'en')).toBe(messagesFor('/unknown-two', 'en'));
		expect(english('Starter templates')).toBe('Starter templates');
		expect(spanish('Starter templates')).toBe('Plantillas iniciales');
		expect(translator(messagesFor('/templates', 'en'))('Starter templates')).toBe(
			'Starter templates'
		);
		expect(JSON.stringify(messagesFor('/docs/1.3/overview', 'es')).length).toBeLessThan(35_000);
		expect(translator(messagesFor('/playground/1.3.0', 'es'))('Whole number from 1 to 16')).toBe(
			'Número entero de 1 a 16'
		);
	});
	it('renders every Spanish laboratory without corrupting mathematical notation', () => {
		for (const environment of listSimulationEnvironments('es')) {
			const simulation = getSimulation(environment.id, 'es')!;
			const html = JSON.stringify([
				environment.pedagogy,
				simulation.modelHtml,
				simulation.summaryHtml,
				simulation.inventoryHtml,
				simulation.boundariesHtml,
				renderSimulationTimeline(timelineFor(environment.id), 'es')
			]);
			expect(html, environment.id).not.toContain('katex-error');
			expect(html, environment.id).not.toContain('undefined');
		}
	});
	it('translates teaching prose before rendering its markup', () => {
		const english = getSimulation('rc')!;
		const spanish = getSimulation('rc', 'es')!;
		expect(spanish.pedagogy.prediction.promptHtml).not.toBe(english.pedagogy.prediction.promptHtml);
		expect(spanish.svg).toBe(english.svg);
	});
});
