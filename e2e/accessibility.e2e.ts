import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const routes = [
	'/',
	'/docs/v0.2.1/overview',
	'/playground/v0.2.1',
	'/simulations/v0.2.1/rc-low-pass'
] as const;

for (const route of routes) {
	test(`${route} has no WCAG A or AA violations`, async ({ page }) => {
		await page.goto(route);
		if (route.startsWith('/playground/')) {
			await expect(page.getByTitle('SVG preview: Sensor input')).toBeVisible();
		}
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});
}
