import { render } from 'svelte/server';
import { describe, expect, test } from 'vitest';
import FaultSwitch from './FaultSwitch.svelte';

describe('hidden fault control', () => {
	test('does not disclose the diagnosis in rendered markup', () => {
		const diagnosis = 'syndrome decoder miswired';
		const { body } = render(FaultSwitch, {
			props: { label: diagnosis, active: false }
		});
		expect(body).toContain('inject hidden fault');
		expect(body).not.toContain(diagnosis);
	});

	test('reports an active fault without naming it', () => {
		const diagnosis = 'high-side gate drive lost';
		const { body } = render(FaultSwitch, {
			props: { label: diagnosis, active: true }
		});
		expect(body).toContain('hidden fault active');
		expect(body).not.toContain(diagnosis);
	});
});
