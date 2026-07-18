import { expect, test, type Page } from '@playwright/test';

const contentRoutes = ['/', '/docs/v0.2.1/overview', '/timeline', '/changelog'] as const;

async function expectNoPageOverflow(page: Page): Promise<void> {
	const sizes = await page.evaluate(() => ({
		document: document.documentElement.scrollWidth,
		viewport: document.documentElement.clientWidth
	}));
	expect(sizes.document).toBeLessThanOrEqual(sizes.viewport);
}

async function observeLongInteractions(page: Page): Promise<void> {
	await page.evaluate(() => {
		document.documentElement.dataset.slowestInteraction = '0';
		const observer = new PerformanceObserver((list) => {
			let maximum = Number(document.documentElement.dataset.slowestInteraction ?? '0');
			for (const entry of list.getEntries()) maximum = Math.max(maximum, entry.duration);
			document.documentElement.dataset.slowestInteraction = String(maximum);
		});
		observer.observe({ type: 'event', buffered: true, durationThreshold: 16 });
		document.addEventListener('schemd:stop-interaction-observer', () => observer.disconnect(), {
			once: true
		});
	});
}

async function slowestInteraction(page: Page): Promise<number> {
	await page.waitForTimeout(250);
	return page.evaluate(() => Number(document.documentElement.dataset.slowestInteraction ?? '0'));
}

test('content routes return complete SSR HTML without compiler or worker payloads', async ({
	request
}) => {
	for (const route of contentRoutes) {
		const response = await request.get(route);
		expect(response.status(), route).toBe(200);
		const html = await response.text();
		expect(html, route).toContain('<main id="main-content"');
		expect(html, route).toMatch(/<h1(?:\s|>)/);
		expect(html, route).not.toContain('v0.2.1.worker');
		expect(html, route).not.toContain('compileSchemd');
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
	await expect(page.getByTitle('SVG preview: Sensor input filter')).toBeVisible();

	await editor.fill('not valid schemd source');
	await expect(page.locator('#editor-diagnostic')).toContainText('Line 1');
	await expect(editor).toHaveAttribute('aria-invalid', 'true');

	await page.getByRole('button', { name: 'Reset' }).click();
	await expect(page.locator('#editor-diagnostic')).toContainText('No compiler diagnostics.');
	await expect(page.getByTitle('SVG preview: Sensor input filter')).toBeVisible();
});

test('playground downloads a deterministic SVG', async ({ page }) => {
	await page.goto('/playground/v0.2.1');
	await expect(page.getByTitle('SVG preview: Sensor input filter')).toBeVisible();
	const download = await Promise.all([
		page.waitForEvent('download'),
		page.getByRole('button', { name: 'Download', exact: true }).click()
	]);
	expect(download[0].suggestedFilename()).toBe('sensor-input-filter.svg');
});

test('playground supports native editor shortcuts and query-string sharing', async ({ page }) => {
	await page.goto('/playground/v0.2.1');
	const editor = page.getByLabel('Schemd source');
	await expect(page.getByTitle('SVG preview: Sensor input filter')).toBeVisible();
	await editor.focus();
	await editor.press('ControlOrMeta+A');
	await editor.press('Tab');
	await expect(editor).toHaveValue('  ');

	await page.getByRole('button', { name: 'Reset' }).click();
	await editor.press('ControlOrMeta+Enter');
	await expect(page.locator('#editor-diagnostic')).toContainText('No compiler diagnostics.');
	await page.getByRole('button', { name: 'Share workspace' }).click();
	await expect.poll(() => new URL(page.url()).searchParams.get('code')).toContain('port:SENSOR');
});

test('simulation controls expose the exact current model values', async ({ page }) => {
	await page.goto('/simulations/v0.2.1/rc-low-pass');
	const frequency = page.getByLabel('Frequency');
	await frequency.fill('0');
	const controls = page.getByLabel('RC low-pass response controls');
	await expect(controls.getByText('10.0 Hz', { exact: true })).toBeVisible();
	await frequency.fill('1000');
	await expect(controls.getByText('100.00 kHz', { exact: true })).toBeVisible();
	await expect(page.getByText('Ideal transfer:', { exact: false })).toBeVisible();
});

test('fault injection and the virtual probe can diagnose and repair a schematic', async ({
	page
}) => {
	await page.goto('/simulations/v0.2.1/digital-adder');
	await page.getByLabel('Fault injection').selectOption('open-circuit');
	await expect(
		page.locator('.instrument-bar').getByText('Open circuit', { exact: true })
	).toBeVisible();
	await page.getByRole('button', { name: 'Logic probe off' }).click();
	await expect(page.getByRole('button', { name: 'Logic probe armed' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'Repair' }).click();
	await expect(
		page.locator('.instrument-bar').getByText('Nominal circuit', { exact: true })
	).toBeVisible();
	await expect(page.getByText('Circuit restored to nominal state')).toBeVisible();
});

test('the global command palette is fully keyboard operable', async ({ page }) => {
	await page.goto('/');
	await page.keyboard.press('ControlOrMeta+K');
	const dialog = page.getByRole('dialog', { name: 'Go to a Schemd surface' });
	await expect(dialog).toBeVisible();
	const query = page.getByLabel('Search documentation and routes');
	await expect(query).toBeFocused();
	await query.fill('grammar');
	await expect(
		page
			.getByRole('listbox', { name: 'Command results' })
			.getByRole('option', { name: /Learn the Schemd language/i })
	).toBeVisible();
	await query.press('Escape');
	await expect(dialog).toBeHidden();
});

test('mobile documentation exposes the synchronized schematic in a bottom sheet', async ({
	page
}) => {
	await page.setViewportSize({ width: 320, height: 760 });
	await page.goto('/docs/v0.2.1/overview');
	await page.getByRole('button', { name: 'Inspect active schematic' }).click();
	const preview = page.getByRole('dialog', { name: 'Sensor input' });
	await expect(preview).toBeVisible();
	await expect(preview.getByLabel('Sensor input source')).toBeVisible();
	await preview.getByRole('button', { name: 'Close schematic preview' }).click();
	await expect(preview).toBeHidden();
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

test('primary pages remain within the viewport at every target width and 200% zoom', async ({
	page
}) => {
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

test('interactive routes remain under the 150 ms event-timing budget', async ({ page }) => {
	await page.goto('/playground/v0.2.1');
	await observeLongInteractions(page);
	const editor = page.getByLabel('Schemd source');
	await editor.press('End');
	await editor.type(' ');
	const playgroundDuration = await slowestInteraction(page);
	expect(playgroundDuration).toBeLessThan(150);

	await page.goto('/simulations/v0.2.1/rc-low-pass');
	await observeLongInteractions(page);
	await page.getByLabel('Frequency').press('ArrowRight');
	const simulationDuration = await slowestInteraction(page);
	expect(simulationDuration).toBeLessThan(150);
	console.log(JSON.stringify({ playgroundDuration, simulationDuration }));
});
