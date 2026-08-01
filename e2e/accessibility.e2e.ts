import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/*
 * Entrance reveals animate opacity from 0 to 1. Scanning mid-transition
 * measured contrast against a half-faded colour and failed intermittently on
 * text that is compliant once settled. Reduced motion collapses those
 * animations to nothing, which is both deterministic and the configuration an
 * accessibility audit should be run in.
 */
/*
 * Applied per page rather than through `test.use({ reducedMotion })`: that
 * fixture option silently did not reach the browser under Playwright 1.62, so
 * every audit here ran with motion enabled and the reduced-motion contract
 * below was asserting against a page that had never been told to reduce.
 */
test.beforeEach(async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
});

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

const CURRENT_DOCS = [
	'overview',
	'grammar',
	'framework-adapters',
	'component-reference',
	'markdown-adapters',
	'math-labels',
	'responsive-svg',
	'integrations',
	'netlist',
	'output-modes',
	'limits',
	'performance',
	'roadmap'
] as const;

const ROUTES = [
	'/',
	...CURRENT_DOCS.map((slug) => `/docs/0.4.0/${slug}`),
	'/docs/0.2.1/component-reference',
	'/playground/0.4.0',
	'/diff/0.4.0',
	'/conformance',
	'/simulations/0.4.0',
	'/simulations/0.4.0/adder',
	'/simulations/0.4.0/rc',
	'/simulations/0.4.0/bell',
	'/simulations/0.4.0/timer',
	'/simulations/0.4.0/teleport',
	'/simulations/0.4.0/buck',
	'/simulations/0.4.0/statechart',
	'/simulations/0.4.0/qec',
	'/simulations/0.4.0/wien',
	'/simulations/0.4.0/lfsr',
	'/simulations/0.4.0/grover',
	'/examples',
	'/coverage',
	'/changelog'
];

const LABS = [
	'adder',
	'rc',
	'bell',
	'timer',
	'teleport',
	'buck',
	'statechart',
	'qec',
	'wien',
	'lfsr',
	'grover'
] as const;

const CONTINUOUS_MOTION_LABS = ['rc', 'timer', 'teleport', 'buck', 'statechart', 'wien'] as const;

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

test('every live laboratory readout has an accessible MathML copy', async ({ page }) => {
	for (const lab of LABS) {
		await page.goto(`/simulations/0.4.0/${lab}`);
		const expressions = page.locator('[data-math-id]');
		const count = await expressions.count();
		expect(count, `${lab}: live expressions`).toBeGreaterThan(0);
		for (let index = 0; index < count; index += 1) {
			const expression = expressions.nth(index);
			await expect(
				expression,
				`${lab}: expression ${index} has an accessible name`
			).toHaveAttribute('aria-label', /\S/);
			await expect(
				expression.locator('.katex-mathml math').first(),
				`${lab}: expression ${index} retains KaTeX MathML`
			).toHaveCount(1);
			await expect(
				expression.locator('.katex-html[aria-hidden="true"]').first(),
				`${lab}: visual copy remains hidden to avoid duplicate speech`
			).toHaveCount(1);
		}
	}
});

test('timeline prose keeps accessible math tokens inside complete sentences', async ({ page }) => {
	await page.goto('/simulations/0.4.0/adder');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	const mathTokens = timeline.locator('.katex');
	expect(await mathTokens.count()).toBeGreaterThan(0);
	await expect(mathTokens.first().locator('.katex-mathml math')).toHaveCount(1);
	await expect(timeline).toContainText(/carry/i);
});

test('live KaTeX patches visual and MathML slot values together', async ({ page }) => {
	await page.goto('/simulations/0.4.0/rc');
	const response = page.locator('[data-math-id="rc.readout.h"]');
	await expect(response.locator('.katex-html [data-math-slot="magnitude"]')).toHaveText('0.847');
	await expect(response.locator('.katex-mathml [data-math-slot="magnitude"]')).toHaveText('0.847');

	await page.getByRole('slider', { name: 'Resistance' }).fill('5');
	await page.getByRole('slider', { name: 'Resistance' }).dispatchEvent('change');
	await expect(response.locator('.katex-html [data-math-slot="magnitude"]')).not.toHaveText(
		'0.847'
	);
	await expect(response.locator('.katex-mathml [data-math-slot="magnitude"]')).not.toHaveText(
		'0.847'
	);
});

test('reduced-motion users receive a stopped simulation with an explicit opt-in', async ({
	page
}) => {
	for (const lab of CONTINUOUS_MOTION_LABS) {
		await page.goto(`/simulations/0.4.0/${lab}`);
		const resume = page.getByRole('button', { name: /resume .*animation/i });
		await expect(resume, `${lab}: reduced-motion pause control`).toBeVisible();
		await expect(resume).toHaveAttribute('aria-pressed', 'true');
		await expect(page.getByText(/paused for your reduced-motion preference/i)).toBeVisible();
	}
});

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
