import { expect, test } from '@playwright/test';
import { failOnClientErrors } from './support';

const ENVIRONMENTS = [
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
] as const;

test.beforeEach(async ({ page }) => {
	failOnClientErrors(page);
});

test('server HTML contains the selected instrument and accessible KaTeX before hydration', async ({
	request
}) => {
	const response = await request.get('/simulations/0.4.0/rc');
	expect(response.ok()).toBe(true);
	const html = await response.text();
	expect(html).toContain('aria-label="Resistance"');
	expect(html).toContain('data-math-id="rc.readout.fc"');
	expect(html).toContain('class="katex-mathml"');
	expect(html).not.toContain('Loading Dynamic RC Low-Pass Filter model');
});

test('catalogue and cyclic environment links navigate without JavaScript timers', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0');
	const adderLink = page.getByRole('link', { name: 'Initialize module →' }).first();
	await expect(adderLink).toHaveAttribute('href', '/simulations/0.4.0/adder');
	await adderLink.click();
	await expect(page).toHaveURL(/\/simulations\/0\.4\.0\/adder$/);
	await expect(page.getByRole('heading', { name: '8-Bit Digital Adder' })).toBeVisible();

	await page.getByRole('link', { name: /Dynamic RC Low-Pass Filter/ }).click();
	await expect(page).toHaveURL(/\/simulations\/0\.4\.0\/rc$/);
	await page.getByRole('link', { name: /8-Bit Digital Adder/ }).click();
	await expect(page).toHaveURL(/\/simulations\/0\.4\.0\/adder$/);
});

test('adder preserves the old output and commits one ripple stage per configured delay', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/adder');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	const delay = timeline.getByRole('slider', { name: 'Propagation stage delay' });
	await delay.fill('250');

	const result = page.locator('[data-math-id="adder.value.total"]');
	await expect(result).toHaveAttribute('aria-label', 'nine-bit result equals 129');
	/* Core 0.4 emits a classical gate's canonical `out1` terminal even when
	 * source used the compatibility alias `out`; the live electrical model
	 * must drive that same identity. Initial A0 xor B0 is high. */
	await expect(page.locator('[data-wire-source="X1_0.out1"]').first()).toHaveClass(
		/net-high-signal/
	);
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
	await page.goto('/simulations/0.4.0/grover');
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

	for (let index = 0; index < 6; index += 1) await next.click();
	await expect(timeline).toContainText('Round 2 · inversion');
	await expect(page.locator('[data-math-id="grover.readout.peak"]')).toHaveAttribute(
		'aria-label',
		'probability 94.5 percent'
	);
	for (let index = 0; index < 3; index += 1) await next.click();
	await expect(timeline).toContainText('Round 3 · over-rotation');
	await expect(page.locator('[data-math-id="grover.readout.peak"]')).toHaveAttribute(
		'aria-label',
		'probability 33.0 percent'
	);
	await next.click();
	await expect(timeline).toContainText('Measurement');
	await expect(page.locator('.sim-stage [data-node-id="M0"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="H0"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="ORACLE"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('.sim-stage [data-node-id="DIFF"]')).toHaveClass(/is-propagating/);
	await expect(page.locator('[data-math-id="grover.readout.peak"]')).toHaveAttribute(
		'aria-label',
		'probability 33.0 percent'
	);
});

test('teleportation protocol state follows the universal Previous and Next controls', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/teleport');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	const next = timeline.getByRole('button', { name: 'Next step' });
	const previous = timeline.getByRole('button', { name: 'Previous step' });

	for (let index = 0; index < 3; index += 1) await next.click();
	await expect(timeline).toContainText('Send two classical bits');
	await expect(page.locator('[data-math-id="teleport.step.bits"]')).toBeVisible();
	const sampledBits = await page
		.locator('[data-math-id="teleport.step.bits"]')
		.getAttribute('aria-label');
	expect(sampledBits).toBeTruthy();

	await previous.click();
	await expect(timeline).toContainText('Bell-basis transform');
	await expect(page.locator('[data-math-id="teleport.step.bits"]')).toHaveCount(0);
	await next.click();
	await expect(page.locator('[data-math-id="teleport.step.bits"]')).toHaveAttribute(
		'aria-label',
		sampledBits!
	);
});

test('motion tooling does not restart a paused causal stage', async ({ page }) => {
	await page.goto('/simulations/0.4.0/rc');
	const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });
	await timeline.getByRole('button', { name: 'Next step' }).click();
	await expect(timeline).toContainText('Drive current through R');

	await page
		.getByRole('button', { name: 'Pause RC waveform and frequency-response animation' })
		.click();
	await expect(timeline).toContainText('Drive current through R');
	await expect(timeline.getByText('propagating')).toHaveCount(0);
});

test('RC controls restart the shared causal trace and expose every physical stage', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/rc');
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
	for (const environment of ENVIRONMENTS) {
		await page.goto(`/simulations/0.4.0/${environment}`);
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

test('all thirteen numerical models follow the universal Previous and Next transport', async ({
	page
}) => {
	for (const environment of ENVIRONMENTS) {
		await page.goto(`/simulations/0.4.0/${environment}`);
		const model = page.locator('[data-model-stage]');
		const timeline = page.getByRole('region', { name: 'Signal propagation timeline' });

		await expect(model, `${environment}: exactly one model clock`).toHaveCount(1);
		await expect(model, `${environment}: initial model stage`).toHaveAttribute(
			'data-model-stage',
			'0'
		);
		await timeline.getByRole('button', { name: 'Next step' }).click();
		await expect(model, `${environment}: model advances with Next`).toHaveAttribute(
			'data-model-stage',
			'1'
		);
		await timeline.getByRole('button', { name: 'Previous step' }).click();
		await expect(model, `${environment}: model rewinds with Previous`).toHaveAttribute(
			'data-model-stage',
			'0'
		);
	}
});

test('the diagnostic probe renders its live reading through server-authored KaTeX', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/rc');
	await page.getByRole('switch', { name: /arm probe/i }).click();
	await page.locator('.sim-stage [data-wire-source="VIN.positive"]').first().click();
	const reading = page.locator('.probe-tip [data-math-id="rc.probe.input"]');
	await expect(reading).toBeVisible();
	await expect(reading.locator('.katex')).toBeVisible();
	await expect(reading).toHaveAttribute('aria-label', /input is 1 volt peak-to-peak/);
});

test('LFSR feedback drives the canonical v0.4 gate output terminal', async ({ page }) => {
	await page.goto('/simulations/0.4.0/lfsr');
	const step = page.getByRole('button', { name: 'step', exact: true });
	await step.click();
	await step.click();
	await expect(page.locator('[data-wire-source="FB.out1"]').first()).toHaveClass(/is-active/);
	await expect(page.locator('[data-wire-source="FB.out"]')).toHaveCount(0);
});

test('a learner commits a prediction before the explanation is revealed', async ({ page }) => {
	await page.goto('/simulations/0.4.0/rc');

	const prediction = page.locator('.prediction');
	await expect(prediction.getByRole('heading')).toContainText('Keep');
	await expect(page.locator('.aha')).toHaveCount(0);
	await expect(page.getByText(/A capacitor is a bucket/)).toHaveCount(0);

	const choices = prediction.getByRole('button');
	await expect(choices).toHaveCount(2);
	await choices.nth(1).click();

	await expect(page.locator('.aha')).toBeVisible();
	await expect(page.getByText(/A useful miss/)).toBeVisible();
	await expect(page.getByText(/A capacitor is a bucket/)).toBeVisible();

	await page.reload();
	await expect(prediction.getByText(/Prediction committed/)).toBeVisible();
	await expect(page.locator('.aha')).toBeVisible();
});

test('guided evidence, diagnosis, completion, and catalogue progress persist locally', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/adder');
	await page.locator('.prediction').getByRole('button').first().click();

	const walkthrough = page.locator('.walkthrough');
	await expect(walkthrough.locator('.guided-step').first()).toHaveAttribute('aria-current', 'step');

	/* An unrelated convenience button must not game the declared operand-entry step. */
	await page.getByRole('button', { name: 'randomize A,B' }).click();
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(0);
	await expect(walkthrough.locator('.action-feedback')).toContainText(
		'This step asks you to enter both operand values'
	);

	const operands = page.locator('.operands input[type="number"]');
	await operands.nth(0).fill('255');
	await page.waitForTimeout(350);
	await operands.nth(1).fill('1');
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(1);

	await page.waitForTimeout(350);
	await page.locator('.sim-stage [data-node-id="A0"] [role="button"]').first().click();
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(2);

	await page.waitForTimeout(350);
	await page.getByRole('switch', { name: 'inject hidden fault' }).click();
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(3);
	const diagnosis = walkthrough.locator('.diagnosis');
	await expect(diagnosis).not.toHaveClass(/is-complete/);
	await expect(diagnosis.getByText('carry chain stuck-at-0', { exact: true })).toHaveCount(0);
	await expect(walkthrough.getByText(/Lab complete/)).toHaveCount(0);

	const hypothesis = diagnosis.getByRole('textbox', { name: 'Your fault hypothesis' });
	await hypothesis.fill('guess');
	await diagnosis.getByRole('button', { name: 'Commit hypothesis and reveal answer' }).click();
	await expect(diagnosis.getByRole('alert')).toContainText('at least two words and 12 characters');
	await expect(diagnosis).not.toHaveClass(/is-complete/);

	await hypothesis.fill('The carry chain appears stuck at zero after the least-significant stage.');
	await diagnosis.getByRole('button', { name: 'Commit hypothesis and reveal answer' }).click();
	await expect(diagnosis).toHaveClass(/is-complete/);
	await expect(diagnosis.getByText('carry chain stuck-at-0', { exact: true })).toBeVisible();
	await expect(walkthrough.getByText(/Lab complete/)).toBeVisible();
	await expect(walkthrough.getByRole('link', { name: /Continue to Dynamic RC/ })).toBeVisible();

	await page.reload();
	await expect(walkthrough.getByText(/Lab complete/)).toBeVisible();

	await page.getByRole('link', { name: '← all environments' }).click();
	await expect(page.getByText('1 of 13 experiments completed on this device')).toBeVisible();
	await expect(page.locator('.lab-row').first().getByText('✓ completed locally')).toBeVisible();
});

test('Grover guided contracts observe timeline controls outside the SVG host', async ({ page }) => {
	await page.goto('/simulations/0.4.0/grover');
	await page.locator('.prediction').getByRole('button').first().click();

	const walkthrough = page.locator('.walkthrough');
	await page.locator('.qubits button').first().click();
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(1);

	const next = page
		.getByRole('region', { name: 'Signal propagation timeline' })
		.getByRole('button', { name: 'Next step' });
	for (let index = 0; index < 6; index += 1) {
		await page.waitForTimeout(350);
		await next.click();
	}
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(2);

	for (let index = 0; index < 3; index += 1) {
		await page.waitForTimeout(350);
		await next.click();
	}
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(3);
	await expect(walkthrough.locator('.action-feedback')).toContainText(
		'Inject the hidden fault and inspect what changes'
	);
	await expect(walkthrough.getByRole('textbox', { name: 'Your fault hypothesis' })).toHaveCount(0);

	/* Grover's authored third step is over-rotation, not fault injection. The
	 * diagnosis must remain sealed until the learner has also observed the
	 * deliberately unnamed fault. */
	await page.getByRole('switch', { name: 'inject hidden fault' }).click();
	await expect(walkthrough.getByRole('textbox', { name: 'Your fault hypothesis' })).toBeVisible();
});

test('RC evidence completes only after the frequency actually crosses the cutoff', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/rc');
	await page.locator('.prediction').getByRole('button').first().click();

	const walkthrough = page.locator('.walkthrough');
	const frequency = page.getByRole('slider', {
		name: 'Stimulus frequency, 10 hertz to 100 kilohertz'
	});
	await frequency.evaluate((element) => {
		for (let index = 0; index < 12; index += 1) {
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(0);
	await expect(walkthrough.locator('.action-feedback')).not.toHaveClass(/is-mismatch/);

	/* 10^2.05 Hz is still below the initial 159 Hz pole. A change event is not
	 * evidence that the requested physical boundary was crossed. */
	await frequency.fill('2.05');
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(0);
	await expect(walkthrough.locator('.action-feedback')).toContainText('Keep experimenting');

	await frequency.fill('3');
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(1);
	await frequency.evaluate((element) => {
		for (let index = 0; index < 12; index += 1) {
			element.dispatchEvent(new Event('input', { bubbles: true }));
		}
	});
	await expect(walkthrough.locator('.guided-step.is-complete')).toHaveCount(1);
	await expect(walkthrough.locator('.action-feedback')).not.toHaveClass(/is-mismatch/);
});
