import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Entrance reveals animate opacity from 0 to 1. Scanning mid-transition
 * measured contrast against a half-faded colour and failed intermittently on
 * text that is compliant once settled. Reduced motion collapses those
 * animations to nothing, which is both deterministic and the configuration an
 * accessibility audit should be run in.
 */
test.use({ reducedMotion: 'reduce' });

/**
 * Wait until nothing is animating.
 *
 * Contrast is a property of the settled page. Scanning while an entrance
 * reveal is still interpolating opacity measures a colour that exists for one
 * frame and belongs to no design token, which failed intermittently on text
 * that passes at rest.
 */
async function settled(page: import('@playwright/test').Page): Promise<void> {
	await page.waitForLoadState('networkidle');
	await page
		.waitForFunction(
			() =>
				document.getAnimations().every((animation) => {
					const timing = animation.effect?.getTiming();
					/* Only the short one-shot reveals change the colour being measured.
				   Looping indicators never finish, and a simulation timeline runs
				   for as long as the laboratory needs — neither should hold up an
				   audit of settled text. */
					const duration = typeof timing?.duration === 'number' ? timing.duration : 0;
					if (timing?.iterations === Infinity || duration > 1_500) return true;
					return animation.playState === 'finished' || animation.playState === 'idle';
				}),
			undefined,
			{ timeout: 1_500 }
			/* Best effort: a laboratory that animates continuously never reaches a
		   quiet frame, and reduced motion has already collapsed the reveals by
		   the time this resolves either way. */
		)
		.catch(() => undefined);
}

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
		await settled(page);
		const results = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});
}

test('command palette modal has no detectable WCAG A/AA violations', async ({ page }) => {
	await page.goto('/');
	await settled(page);
	await expect(page.getByRole('button', { name: 'Open command palette' })).toBeEnabled();
	await page.keyboard.press('Control+K');
	await expect(page.getByRole('dialog')).toBeVisible();
	const results = await new AxeBuilder({ page })
		.include('.palette')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(results.violations).toEqual([]);
});
