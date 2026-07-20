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

test('landing page is SSR-valid, stable, and proves rotated native geometry', async ({ page }) => {
	await page.addInitScript(() => {
		const shifts: number[] = [];
		Object.defineProperty(window, '__schemdLayoutShifts', { value: shifts });
		new PerformanceObserver((entries) => {
			for (const entry of entries.getEntries()) {
				const shift = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
				if (!shift.hadRecentInput) shifts.push(shift.value);
			}
		}).observe({ type: 'layout-shift', buffered: true });
	});

	const response = await page.goto('/');
	expect(response?.status()).toBe(200);
	await expect(page.getByRole('heading', { name: 'Schematics are source code.' })).toBeVisible();
	await expect(page.getByLabel('schemd is pronounced skemd').first()).toContainText('skemd');
	await expect(page.locator('[data-node-id="C1"]')).toHaveAttribute('data-orientation', 'down');

	const jsonLd = await page.locator('script[type="application/ld+json"]').textContent();
	expect(() => JSON.parse(jsonLd ?? '')).not.toThrow();
	await page.waitForTimeout(700);
	const cumulativeShift = await page.evaluate(() =>
		((window as Window & { __schemdLayoutShifts?: number[] }).__schemdLayoutShifts ?? []).reduce(
			(sum, value) => sum + value,
			0
		)
	);
	expect(cumulativeShift).toBeLessThanOrEqual(0.1);
});

test('version selector preserves the documentation slug and rejects invalid releases', async ({
	page,
	request
}) => {
	await page.goto('/docs/0.3.0/component-reference');
	await expect(page.locator('main h1')).toHaveText('Use every 0.3 primitive deliberately');
	await page.getByRole('combobox', { name: 'Documentation version' }).selectOption('0.2.1');
	await expect(page).toHaveURL(/\/docs\/0\.2\.1\/component-reference$/);
	await expect(page.locator('main h1')).toHaveText('Find a component and its ports');

	const missingVersion = await request.get('/docs/9.9.9/overview');
	expect(missingVersion.status()).toBe(404);
	const missingSlug = await request.get('/docs/0.3.0/not-a-document');
	expect(missingSlug.status()).toBe(404);
});

test('command palette traps focus and keyboard-navigates the versioned search index', async ({
	page
}) => {
	await page.goto('/docs/0.3.0/overview');
	await page.keyboard.press('Control+K');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	const search = dialog.getByRole('combobox');
	const close = dialog.getByRole('button', { name: 'Close command palette' });
	await expect(search).toBeFocused();

	await close.focus();
	await page.keyboard.press('Tab');
	await expect(search).toBeFocused();
	await page.keyboard.press('Shift+Tab');
	await expect(close).toBeFocused();
	await search.fill('Component API');
	await search.press('Enter');
	await expect(page).toHaveURL(/\/docs\/0\.3\.0\/component-reference$/);
});

test('playground opens valid, maps source to vector, preserves URI state, and exposes raw parity', async ({
	page
}) => {
	await page.goto('/playground/0.3.0');
	const preview = page.getByRole('region', { name: 'Compiled schematic preview' });
	await expect(preview.locator('[data-schematic] svg')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
	const capacitor = preview.locator('[data-node-id="C1"]');
	await expect(capacitor).toHaveAttribute('data-orientation', 'down');

	await capacitor.locator('[data-port-id="in"]').hover();
	await expect(page.locator('.gutter-line').nth(4)).toHaveClass(/mapped/);
	await expect(page).toHaveURL(/\?code=[A-Za-z0-9_-]+$/);
	const sharedCode = new URL(page.url()).searchParams.get('code');
	expect(sharedCode).toBeTruthy();

	await page.getByRole('radio', { name: 'raw svg' }).click();
	await expect(page.locator('.raw-view')).toContainText('<svg');
	await expect(page.locator('.raw-view')).toContainText('data-orientation="down"');

	await page.getByRole('combobox', { name: 'Documentation version' }).selectOption('0.2.1');
	await expect(page).toHaveURL(new RegExp(`/playground/0\\.2\\.1\\?code=${sharedCode}$`));
});

test('RC laboratory uses native primitives and updates derived physics without regenerating SVG', async ({
	page
}) => {
	await page.goto('/simulations/0.3.0/rc');
	const schematic = page.locator('.sim-stage [data-schematic] svg');
	await expect(schematic).toBeVisible();
	await expect(schematic.locator('[data-node-id="VIN"]')).toBeVisible();
	await expect(schematic.locator('[data-node-id="VOUT_NODE"]')).toBeVisible();
	await expect(schematic.locator('[data-node-id="C1"]')).toHaveAttribute(
		'data-orientation',
		'down'
	);
	const svgHandle = await schematic.elementHandle();
	expect(svgHandle).not.toBeNull();

	await page.getByRole('slider', { name: /Stimulus frequency/ }).fill('5');
	await expect(page.getByText(/\|H\| =/).first()).not.toContainText('|H| = 0.847');
	expect(await svgHandle?.evaluate((element) => element.isConnected)).toBe(true);
});

test('release timeline and sitemap expose current and historical platform contexts', async ({
	page,
	request
}) => {
	await page.goto('/changelog');
	await expect(page.getByRole('heading', { name: /v0\.3\.0/ })).toBeVisible();
	await expect(page.getByText(/release candidate/i)).toBeVisible();
	await expect(page.getByText('26,398 B')).toBeVisible();
	await expect(page.getByText('59,188 B')).toBeVisible();

	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.status()).toBe(200);
	const xml = await sitemap.text();
	expect(xml).toContain('/docs/0.3.0/component-reference');
	expect(xml).toContain('/docs/0.2.1/component-reference');
	expect(xml).toContain('/simulations/0.3.0/rc');
});

test('mobile docs expose an accessible index and compiled-example bottom sheet', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/docs/0.3.0/overview');
	const indexToggle = page.getByRole('button', { name: /index · Quickstart/i });
	await expect(indexToggle).toBeVisible();
	await indexToggle.click();
	await expect(indexToggle).toHaveAttribute('aria-expanded', 'true');

	const exampleToggle = page.getByRole('button', { name: 'Show compiled example' });
	await expect(exampleToggle).toBeVisible();
	await exampleToggle.click();
	await expect(page.getByRole('complementary', { name: /Compiled example/ })).toHaveClass(/open/);
});
