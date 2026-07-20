import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const ROUTES = [
	'/',
	'/docs/0.3.0/overview',
	'/docs/0.2.1/component-reference',
	'/playground/0.3.0',
	'/simulations/0.3.0/adder',
	'/simulations/0.3.0/rc',
	'/simulations/0.3.0/bell',
	'/simulations/0.3.0/timer',
	'/simulations/0.3.0/teleport',
	'/changelog'
] as const;

for (const route of ROUTES) {
	test(`${route} has no detectable WCAG A/AA violations`, async ({ page }) => {
		await page.goto(route);
		if (route.startsWith('/playground/')) {
			await expect(page.locator('[data-schematic] svg')).toBeVisible();
		}
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});
}

test('command palette modal has no detectable WCAG A/AA violations', async ({ page }) => {
	await page.goto('/');
	await page.keyboard.press('Control+K');
	await expect(page.getByRole('dialog')).toBeVisible();
	const results = await new AxeBuilder({ page })
		.include('.palette')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(results.violations).toEqual([]);
});
