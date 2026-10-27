import { expect, test } from '@playwright/test';
import { failOnClientErrors } from './support';

for (const locale of ['en', 'es']) {
	test(`1.3.1 ${locale} docs explain polarity fixes on the canonical minor line`, async ({
		page,
		request
	}) => {
		failOnClientErrors(page);
		const prefix = locale === 'es' ? '/es' : '';
		const alias = await request.get(`${prefix}/docs/1.3.1/overview`, { maxRedirects: 0 });
		expect(alias.status()).toBe(308);
		expect(alias.headers()['location']).toBe(`${prefix}/docs/1.3/overview`);
		await page.goto(`${prefix}/docs/1.3.1/overview#patch-1-3-1`);
		await expect(page).toHaveURL(new RegExp(`${prefix}/docs/1\\.3/overview#patch-1-3-1$`));
		await expect(page.locator('h1')).toContainText('1.3.1');
		await expect(page.locator('#patch-1-3-1')).toContainText('1.3.1');
		await expect(
			page.locator('select[aria-label]').filter({ has: page.locator('option[value="1.3"]') })
		).toHaveValue('1.3');
		const article = page.locator('.doc-article');
		await expect(article).toContainText('in = negative');
		await expect(article).toContainText('out = positive');
		await page.goto(`${prefix}/docs/1.3.1/component-reference`);
		await expect(page.locator('#electrical')).toBeVisible();
		await expect(page.locator('.doc-article')).toContainText('SPICE');
	});
}

test('the source sheet leaves the complete hero drawing visible at desktop widths', async ({
	page
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const width of [1440, 1024]) {
		await page.setViewportSize({ width, height: 1000 });
		await page.goto('/');
		const source = await page.locator('ol.source').boundingBox();
		const drawing = await page.locator('[data-hero-drawing] svg').boundingBox();
		expect(source).not.toBeNull();
		expect(drawing).not.toBeNull();
		expect(drawing!.x, `drawing is clear of source at ${width}px`).toBeGreaterThanOrEqual(
			source!.x + source!.width
		);
	}
});

test('choosing a historical release on the homepage opens that release’s docs', async ({
	page
}) => {
	await page.goto('/');
	const version = page.getByRole('combobox', { name: 'Documentation version' });
	await version.selectOption('0.8.0');
	await expect(page).toHaveURL(/\/docs\/0\.8\/overview$/);
	await expect(version).toHaveValue('0.8');
	await expect(page.locator('h1')).toContainText('0.8');
});
