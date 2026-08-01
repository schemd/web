import { describe, expect, test } from 'vitest';
import { listSimulationEnvironments } from './simulations';

describe('simulation learning design', () => {
	test('defines a complete, acyclic prerequisite sequence for all thirteen labs', () => {
		const environments = listSimulationEnvironments();
		const byId = new Map(environments.map((environment) => [environment.id, environment]));
		const orders = environments.map((environment) => environment.curriculum.order);

		expect(environments).toHaveLength(11);
		expect([...orders].sort((a, b) => a - b)).toEqual(
			Array.from({ length: 11 }, (_, index) => index + 1)
		);

		for (const environment of environments) {
			expect(environment.curriculum.objective.length, environment.id).toBeGreaterThan(20);
			for (const prerequisiteId of environment.curriculum.prerequisites) {
				const prerequisite = byId.get(prerequisiteId);
				expect(
					prerequisite,
					`${environment.id}: missing prerequisite ${prerequisiteId}`
				).toBeDefined();
				expect(
					prerequisite?.curriculum.order,
					`${environment.id}: prerequisite must appear earlier`
				).toBeLessThan(environment.curriculum.order);
			}
		}
	});

	test('requires one meaningful, server-rendered prediction before every explanation', () => {
		for (const environment of listSimulationEnvironments()) {
			const prediction = environment.pedagogy.prediction;
			expect(prediction.prompt.length, environment.id).toBeGreaterThan(20);
			expect(prediction.promptHtml, environment.id).not.toContain('katex-error');
			expect(prediction.choices.length, environment.id).toBeGreaterThanOrEqual(2);
			expect(
				prediction.choices.filter((choice) => choice.correct),
				`${environment.id}: exactly one supported prediction`
			).toHaveLength(1);
			expect(
				new Set(prediction.choices.map((choice) => choice.id)).size,
				`${environment.id}: stable choice ids`
			).toBe(prediction.choices.length);
			for (const choice of prediction.choices) {
				expect(choice.label.length, environment.id).toBeGreaterThan(8);
				expect(choice.labelHtml, environment.id).not.toContain('katex-error');
				expect(choice.feedbackHtml.length, environment.id).toBeGreaterThan(40);
				expect(choice.feedbackHtml, environment.id).not.toContain('katex-error');
			}
		}
	});

	test('frames fault work as diagnosis from evidence instead of announcing the answer', () => {
		const answerFirst =
			/stuck-at|branch open|offline|cut the|kill the|disconnect the|invert a guard|miswire|open the gain|move a feedback tap|oracle at the wrong/i;
		for (const environment of listSimulationEnvironments()) {
			expect(environment.pedagogy.diagnosisPrompt.length, environment.id).toBeGreaterThan(40);
			expect(environment.pedagogy.diagnosisPromptHtml, environment.id).not.toContain('katex-error');
			expect(environment.pedagogy.diagnosisPrompt, environment.id).not.toBe(environment.fault);
			for (const step of environment.pedagogy.steps) {
				expect(step.label, `${environment.id}: ${step.label}`).not.toMatch(answerFirst);
			}
		}
	});

	test('binds every guided step to a narrow, serializable interaction contract', () => {
		for (const environment of listSimulationEnvironments()) {
			expect(environment.pedagogy.steps, environment.id).toHaveLength(3);
			for (const step of environment.pedagogy.steps) {
				expect(step.action.selector.length, `${environment.id}: ${step.label}`).toBeGreaterThan(5);
				expect(step.action.selector, `${environment.id}: wildcard selector`).not.toBe('*');
				expect(['click', 'input', 'change']).toContain(step.action.event);
				expect(
					step.action.occurrences,
					`${environment.id}: bounded interaction count`
				).toBeGreaterThan(0);
				expect(
					step.action.occurrences,
					`${environment.id}: bounded interaction count`
				).toBeLessThanOrEqual(16);
				if (step.action.sequence) {
					expect(step.action.sequence, `${environment.id}: compound contract`).toHaveLength(
						step.action.occurrences
					);
					expect(new Set(step.action.sequence).size, `${environment.id}: distinct controls`).toBe(
						step.action.sequence.length
					);
				}
				if (
					step.action.selector.includes('input') &&
					!step.action.selector.includes('type="number"')
				) {
					expect(step.action.event, `${environment.id}: range commits once per gesture`).toBe(
						'change'
					);
				}
				expect(step.action.instruction.length, environment.id).toBeGreaterThan(15);
			}
		}
	});

	test('requires semantic model evidence for instructions that claim an outcome', () => {
		const outcomes = Object.fromEntries(
			listSimulationEnvironments().flatMap((environment) =>
				environment.pedagogy.steps
					.filter((step) => step.action.outcome)
					.map((step) => [`${environment.id}:${step.action.outcome}`, step.action.instruction])
			)
		);
		expect(outcomes).toEqual({
			'rc:frequency-above-cutoff': 'sweep the stimulus-frequency control across the cutoff',
			'buck:conduction-left-ccm': 'change load resistance until the conduction classifier changes'
		});
	});
});
