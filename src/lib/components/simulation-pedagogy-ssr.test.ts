import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import { listSimulationEnvironments } from '$lib/server/simulations';
import SimulationPedagogy from './SimulationPedagogy.svelte';

describe('SimulationPedagogy SSR', () => {
	test('ships the prediction but withholds the explanation and fault answer', () => {
		const simulation = listSimulationEnvironments().find((environment) => environment.id === 'rc');
		expect(simulation).toBeDefined();

		const { body } = render(SimulationPedagogy, {
			props: {
				id: simulation!.id,
				title: simulation!.title,
				version: '0.4.0',
				fault: simulation!.fault,
				pedagogy: simulation!.pedagogy,
				curriculum: simulation!.curriculum,
				prerequisites: [],
				total: listSimulationEnvironments().length
			}
		});

		expect(body).toContain('predict · then test');
		expect(body).toContain('Prediction choices');
		expect(body).toContain('Keep');
		expect(body).not.toContain('A capacitor is a bucket');
		expect(body).not.toContain('capacitor branch open');
		expect(body).not.toContain('Make the model answer you');
		expect(body).not.toContain('Commit hypothesis and reveal answer');
	});
});
