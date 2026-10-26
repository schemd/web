import { expect, test } from '@playwright/test';
import { failOnClientErrors } from './support';

test.beforeEach(async ({ page }) => {
	failOnClientErrors(page);
});

test('Spanish RC controls advance guided work after their accessible names are translated', async ({
	page
}) => {
	await page.goto('/es/simulations/0.4.0/rc');
	await expect(page.locator('html')).toHaveAttribute('lang', 'es');
	await page.locator('.prediction').getByRole('button').first().click();

	const completed = page.locator('.walkthrough .guided-step.is-complete');
	await page.locator('[data-lab-control="rc-frequency"]').fill('3');
	await expect(completed).toHaveCount(1);

	const capacitance = page.locator('[data-lab-control="rc-capacitance"]');
	await expect(capacitance).toHaveAttribute('aria-label', 'Capacitancia');
	await page.waitForTimeout(350);
	await capacitance.fill('-8');
	await expect(completed).toHaveCount(2);
});

test('Spanish teleportation preserves its ordered inputs and translated step action', async ({
	page
}) => {
	await page.goto('/es/simulations/0.4.0/teleport');
	await page.locator('.prediction').getByRole('button').first().click();
	const completed = page.locator('.walkthrough .guided-step.is-complete');
	await page.locator('[data-lab-control="teleport-theta"]').fill('1.2');
	await expect(completed).toHaveCount(0);
	await page.locator('[data-lab-control="teleport-phi"]').fill('1.1');
	await expect(completed).toHaveCount(1);

	const step = page.locator('[data-action="teleport-step"]');
	await expect(step).toHaveAttribute('title', 'Avanzar un paso');
	for (let index = 0; index < 5; index += 1) {
		await page.waitForTimeout(350);
		await step.click();
	}
	await expect(completed).toHaveCount(2);
});

test('Spanish Grover timeline advances the same guided round contract', async ({ page }) => {
	await page.goto('/es/simulations/0.4.0/grover');
	await page.locator('.prediction').getByRole('button').first().click();
	await page.locator('.qubits button').first().click();
	const completed = page.locator('.walkthrough .guided-step.is-complete');
	await expect(completed).toHaveCount(1);

	const next = page.locator('.timeline [data-action="next-step"]');
	await expect(next).toHaveAttribute('aria-label', 'Paso siguiente');
	for (let index = 0; index < 6; index += 1) {
		await page.waitForTimeout(350);
		await next.click();
	}
	await expect(completed).toHaveCount(2);
});
