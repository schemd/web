import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

for (const [name, path, readySelector] of [
	['landing', '/', undefined],
	['documentation', '/docs/v0.2.1/overview', undefined],
	['playground', '/playground/v0.2.1', '.preview-surface svg'],
	['simulation', '/simulations/v0.2.1/digital-adder', '.schematic-host svg'],
	['changelog', '/changelog', undefined]
] as const) {
	test(`${name} has no automatically detectable accessibility violations`, async ({ page }) => {
		await page.goto(path);
		if (readySelector) await expect(page.locator(readySelector)).toBeVisible();
		const result = await new AxeBuilder({ page }).analyze();
		const violations = result.violations.map((violation) => ({
			id: violation.id,
			targets: violation.nodes.map((node) => node.target.join(' '))
		}));
		expect(violations).toEqual([]);
	});
}
