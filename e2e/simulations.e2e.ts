import { expect, test, type Page } from '@playwright/test';

function failOnClientErrors(page: Page): void {
	page.on('pageerror', (failure) => {
		throw failure;
	});
	page.on('console', (message) => {
		if (message.type() === 'error') throw new Error(`Browser console: ${message.text()}`);
	});
}

test.beforeEach(async ({ page }) => {
	failOnClientErrors(page);
});

test('catalogue and cyclic environment links navigate without JavaScript timers', async ({
	page
}) => {
	await page.goto('/simulations/0.3.2');
	const adderLink = page.getByRole('link', { name: 'Initialize module →' }).first();
	await expect(adderLink).toHaveAttribute('href', '/simulations/0.3.2/adder');
	await adderLink.click();
	await expect(page).toHaveURL(/\/simulations\/0\.3\.2\/adder$/);
	await expect(page.getByRole('heading', { name: '8-Bit Digital Adder' })).toBeVisible();

	await page.getByRole('link', { name: /Dynamic RC Low-Pass Filter/ }).click();
	await expect(page).toHaveURL(/\/simulations\/0\.3\.2\/rc$/);
	await page.getByRole('link', { name: /8-Bit Digital Adder/ }).click();
	await expect(page).toHaveURL(/\/simulations\/0\.3\.2\/adder$/);
});

test('adder preserves the old output and commits one ripple stage per configured delay', async ({
	page
}) => {
	await page.goto('/simulations/0.3.2/adder');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	const delay = timeline.getByRole('slider', { name: 'Propagation stage delay' });
	await delay.fill('250');

	const result = page.locator('[data-math-id="adder.value.total"]');
	await expect(result).toHaveAttribute('aria-label', 'nine-bit result equals 129');
	await page.locator('.sim-stage [data-node-id="A0"] [role="button"]').first().click();
	await expect(page.locator('[data-math-id="adder.value.a"]')).toHaveAttribute(
		'aria-label',
		'A equals 42'
	);
	await expect(result).toHaveAttribute('aria-label', 'nine-bit result equals 129');
	await expect(timeline.getByText('propagating')).toBeVisible();

	await expect(page.locator('.sim-stage [data-node-id="X1_0"]')).toHaveClass(/is-propagating/, {
		timeout: 1_500
	});
	await expect(result).toHaveAttribute('aria-label', 'nine-bit result equals 128', {
		timeout: 4_000
	});
	await expect(timeline.getByText('settled')).toBeVisible();
	/* Settled paths latch until the next input change; logic-0 inputs do not. */
	await expect(page.locator('.sim-stage [data-node-id="X1_0"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="A1"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="A0"]')).not.toHaveClass(/is-propagating/);
});

test('manual previous and next controls replay Grover amplitude transformations', async ({
	page
}) => {
	await page.goto('/simulations/0.3.2/grover');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	const next = timeline.getByRole('button', { name: 'Next step' });
	const previous = timeline.getByRole('button', { name: 'Previous step' });

	await expect(timeline).toContainText('Uniform superposition');
	await next.click();
	await expect(timeline).toContainText('Round 1 · oracle');
	await expect(page.locator('.bars .bar.target')).toHaveClass(/negative/);
	await previous.click();
	await expect(timeline).toContainText('Uniform superposition');
	await expect(page.locator('.bars .bar.target')).not.toHaveClass(/negative/);

	for (let index = 0; index < 7; index += 1) await next.click();
	await expect(timeline).toContainText('Measurement');
	await expect(page.locator('.sim-stage [data-node-id="M0"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="H0"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="ORACLE"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="DIFF"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('[data-math-id="grover.readout.peak"]')).toHaveAttribute(
		'aria-label',
		'probability 94.5 percent'
	);
});

test('RC controls restart the shared causal trace and expose every physical stage', async ({
	page
}) => {
	await page.goto('/simulations/0.3.2/rc');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	await timeline.getByRole('slider', { name: 'Propagation stage delay' }).fill('250');
	const response = page.locator('[data-math-id="rc.readout.h"]');
	await expect(response).toHaveAttribute('aria-label', /magnitude 0\.847/);
	const magnitudeSlot = response.locator('[data-math-slot="magnitude"] .mathtt');
	await expect(magnitudeSlot).toHaveText('0.847');
	await page.getByRole('slider', { name: 'Resistance' }).fill('5');
	await page.getByRole('slider', { name: 'Resistance' }).dispatchEvent('change');

	await expect(timeline.getByText('propagating')).toBeVisible();
	await expect(response).toHaveAttribute('aria-label', /magnitude 0\.847/);
	await expect(page.locator('.sim-stage [data-node-id="R1"]')).toHaveClass(/is-propagating/, {
		timeout: 1_500
	});
	await expect(page.locator('.sim-stage [data-node-id="C1"]')).toHaveClass(/is-propagating/, {
		timeout: 1_500
	});
	await expect(page.locator('.sim-stage [data-node-id="VOUT"]')).toHaveClass(/is-propagating/, {
		timeout: 1_500
	});
	await expect(response).not.toHaveAttribute('aria-label', /magnitude 0\.847/);
	await expect(magnitudeSlot).toHaveCount(1);
	await expect(page.locator('.sim-stage [data-node-id="VIN"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="R1"]')).toHaveClass(/is-propagating/);
});

test('every laboratory resolves server-rendered KaTeX with no client-side parser gaps', async ({
	page
}) => {
	const environments = [
		'adder',
		'rc',
		'bell',
		'timer',
		'teleport',
		'buck',
		'chua',
		'pll',
		'statechart',
		'qec',
		'wien',
		'lfsr',
		'grover'
	];
	for (const environment of environments) {
		await page.goto(`/simulations/0.3.2/${environment}`);
		await expect(page.locator('[data-math-id]').first(), `${environment}: live math`).toBeVisible();
		await expect(
			page.locator('[data-math-missing]'),
			`${environment}: missing template`
		).toHaveCount(0);
		await expect(
			page.locator('[data-math-id] .katex').first(),
			`${environment}: KaTeX output`
		).toBeVisible();
	}
});

test('the diagnostic probe renders its live reading through server-authored KaTeX', async ({
	page
}) => {
	await page.goto('/simulations/0.3.2/rc');
	await page.getByRole('switch', { name: /arm probe/i }).click();
	await page.locator('.sim-stage [data-wire-source="VIN.positive"]').first().click();
	const reading = page.locator('.probe-tip [data-math-id="rc.probe.input"]');
	await expect(reading).toBeVisible();
	await expect(reading.locator('.katex')).toBeVisible();
	await expect(reading).toHaveAttribute('aria-label', /input is 1 volt peak-to-peak/);
});
