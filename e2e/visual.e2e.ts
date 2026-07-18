import { expect, test } from '@playwright/test';

const pages = [
	{ name: 'landing', path: '/' },
	{ name: 'documentation', path: '/docs/v0.2.1/overview' },
	{ name: 'playground', path: '/playground/v0.2.1' },
	{ name: 'simulation', path: '/simulations/v0.2.1/rc-low-pass' }
] as const;

for (const target of pages) {
	test(`${target.name} visual at desktop and mobile`, async ({ page }) => {
		await page.setViewportSize({ width: 1440, height: 1000 });
		await page.goto(target.path);
		await expect(page).toHaveScreenshot(`${target.name}-desktop.png`, {
			animations: 'disabled',
			fullPage: true
		});

		await page.setViewportSize({ width: 320, height: 760 });
		await page.goto(target.path);
		await expect(page).toHaveScreenshot(`${target.name}-mobile.png`, {
			animations: 'disabled',
			fullPage: true
		});
	});
}
