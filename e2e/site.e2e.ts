import { expect, test, type Page } from '@playwright/test';

const contentRoutes = ['/', '/docs/v0.2.1/overview', '/timeline', '/changelog'] as const;

async function expectNoPageOverflow(page: Page): Promise<void> {
	const sizes = await page.evaluate(() => ({
		document: document.documentElement.scrollWidth,
		viewport: document.documentElement.clientWidth
	}));
	expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
}

test('content routes render complete HTML without Svelte hydration', async ({ request }) => {
	for (const route of contentRoutes) {
		const response = await request.get(route);
		expect(response.status(), route).toBe(200);
		const html = await response.text();
		expect(html, route).toContain('<main id="main-content"');
		expect(html, route).toMatch(/<h1(?:\s|>)/);
		expect(html, route).not.toContain('/_app/immutable/entry/start.');
	}
});

test('latest docs resolve permanently to the stable canonical version', async ({ request }) => {
	const latest = await request.get('/docs/latest', { maxRedirects: 0 });
	expect(latest.status()).toBe(308);
	expect(latest.headers().location).toBe('/docs/v0.2.1/overview');

	const canonical = await request.get('/docs/v0.2.1/overview');
	expect(await canonical.text()).toContain(
		'<link rel="canonical" href="https://schemd.johnowolabiidogun.dev/docs/v0.2.1/overview"'
	);
});

test('unknown routes return a useful, non-indexable 404', async ({ request }) => {
	const response = await request.get('/not-a-real-trace');
	expect(response.status()).toBe(404);
	const html = await response.text();
	expect(html).toContain('That trace ends here.');
	expect(html).toContain('name="robots" content="noindex,follow"');
});

test('playground compiles in its version worker and exposes diagnostics', async ({ page }) => {
	await page.goto('/playground/v0.2.1');
	const editor = page.getByLabel('Schemd source');
	await expect(editor).toBeVisible();
	await expect(page.getByTitle('SVG preview: Sensor input')).toBeVisible();

	await editor.fill('not valid schemd source');
	await expect(page.locator('#editor-diagnostic')).toContainText('Line 1');
	await expect(editor).toHaveAttribute('aria-invalid', 'true');

	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(page.locator('#editor-diagnostic')).toContainText('No compiler diagnostics.');
	await expect(page.getByTitle('SVG preview: Sensor input')).toBeVisible();
});

test('playground downloads a deterministic SVG', async ({ page }) => {
	await page.goto('/playground/v0.2.1');
	await expect(page.getByTitle('SVG preview: Sensor input')).toBeVisible();
	const download = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download', exact: true }).click()
	]);
	expect(download[0].suggestedFilename()).toBe('sensor-input-filter.svg');
});

test('simulation controls expose the exact current model values', async ({ page }) => {
	await page.goto('/simulations/v0.2.1/rc-low-pass');
	const frequency = page.getByLabel('Frequency');
	await frequency.fill('0');
	await expect(page.getByText('10.0 Hz', { exact: true })).toBeVisible();
	await frequency.fill('1000');
	await expect(page.getByText('100.00 kHz', { exact: true })).toBeVisible();
	await expect(page.getByText('Ideal transfer:', { exact: false })).toBeVisible();
});

test('keyboard users can skip navigation and operate the mobile menu', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 760 });
	await page.goto('/');
	await page.keyboard.press('Tab');
	await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
	await page.keyboard.press('Enter');
	await expect(page.locator('#main-content')).toBeFocused();

	const menu = page.locator('.mobile-nav > summary');
	await menu.focus();
	await page.keyboard.press('Enter');
	await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Docs' }).last()).toBeVisible();
});

test('primary pages remain within the viewport at every target width and 200% zoom', async ({ page }) => {
	for (const width of [320, 768, 1024, 1440, 1920]) {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		await expectNoPageOverflow(page);
	}

	await page.setViewportSize({ width: 640, height: 760 });
	await page.goto('/docs/v0.2.1/overview');
	await expectNoPageOverflow(page);
	await page.goto('/playground/v0.2.1');
	await expectNoPageOverflow(page);
	await page.goto('/simulations/v0.2.1/rc-low-pass');
	await expectNoPageOverflow(page);
});

test('reduced motion and forced colours preserve content and controls', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce', forcedColors: 'active' });
	await page.goto('/simulations/v0.2.1/digital-adder');
	await expect(page.getByRole('heading', { level: 1, name: 'Ripple-carry adder' })).toBeVisible();
	await expect(page.getByLabel('Operand A')).toBeVisible();
	await expectNoPageOverflow(page);
});
