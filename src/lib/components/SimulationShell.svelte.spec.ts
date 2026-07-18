import { createRawSnippet } from 'svelte';
import { page } from 'vitest/browser';
import { describe, expect, it } from 'vitest';
import { render } from 'vitest-browser-svelte';
import SimulationShell from './SimulationShell.svelte';

describe('SimulationShell', () => {
	it('renders the teaching boundary, controls, diagram, and related links', async () => {
		const children = createRawSnippet(() => ({ render: () => '<button type="button">Run model</button>' }));
		render(SimulationShell, {
			version: 'v0.2.1',
			slug: 'fixture',
			domain: 'Test domain',
			title: 'Test instrument',
			summary: 'A focused simulation.',
			idea: 'One exact idea.',
			docsPath: '/docs/v0.2.1/overview',
			svg: '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Fixture"></svg>',
			children
		});

		await expect.element(page.getByRole('heading', { level: 1, name: 'Test instrument' })).toBeInTheDocument();
		await expect.element(page.getByRole('button', { name: 'Run model' })).toBeInTheDocument();
		await expect.element(page.getByRole('img', { name: 'Fixture' })).toBeInTheDocument();
		await expect.element(page.getByRole('link', { name: 'Relevant documentation →' })).toHaveAttribute('href', '/docs/v0.2.1/overview');
	});
});
