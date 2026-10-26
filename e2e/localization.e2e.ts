import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { failOnClientErrors } from './support';

test.beforeEach(async ({ page }) => {
	failOnClientErrors(page);
});

test('language changes preserve a template workspace and remember the preference', async ({
	page,
	context
}) => {
	await page.goto('/templates');
	await page.getByRole('link', { name: 'Open template', exact: true }).first().click();
	await expect(page).toHaveURL(/\/playground\/[^?]+\?code=/);
	const before = new URL(page.url());
	await expect(
		page
			.getByRole('region', {
				name: /Compiled schematic preview|Vista previa del esquema compilado/
			})
			.locator('svg')
	).toBeVisible();
	await page.getByRole('button', { name: 'Español: read in Spanish', exact: true }).click();
	await expect(page).toHaveURL(/\/es\/playground\//);
	expect(new URL(page.url()).searchParams.get('code')).toBe(before.searchParams.get('code'));
	await expect(page.locator('html')).toHaveAttribute('lang', 'es');
	await expect(
		page
			.getByRole('region', {
				name: /Compiled schematic preview|Vista previa del esquema compilado/
			})
			.locator('svg')
	).toBeVisible();
	expect((await context.cookies()).find((cookie) => cookie.name === 'schemd-language')?.value).toBe(
		'es'
	);
	await page.goto('/');
	await expect(page).toHaveURL(/\/es$/);
	await page.getByRole('button', { name: 'English: leer en inglés', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('lang', 'en');
	await expect(page).toHaveURL('http://127.0.0.1:4173/');
});

test('translated docs have their own metadata, historical notice and language-aware aliases', async ({
	page,
	request
}) => {
	await page.goto('/es/docs/1.3/overview');
	await expect(page.locator('html')).toHaveAttribute('lang', 'es');
	await expect(page.locator('article[lang="es"]')).toBeVisible();
	await expect(page.locator('head link[hreflang="en"]')).toHaveAttribute(
		'href',
		/\/docs\/1\.3\/overview$/
	);
	await expect(page.locator('head link[hreflang="es"]')).toHaveAttribute(
		'href',
		/\/es\/docs\/1\.3\/overview$/
	);
	await page.goto('/es/docs/0.4/overview');
	await expect(page.locator('article[lang="en"]')).toBeVisible();
	await expect(page.locator('link[rel=canonical]')).toHaveAttribute(
		'href',
		/\/docs\/0\.4\/overview$/
	);
	await expect(
		page.getByText(
			'Esta documentación está disponible en inglés. La documentación en español comienza en la versión 1.2.',
			{ exact: true }
		)
	).toBeVisible();
	for (const path of [
		'/es/docs/1.3',
		'/es/playground/latest?code=YWJj',
		'/es/inspector/latest',
		'/es/diff/latest',
		'/es/simulations/latest',
		'/es/simulations/latest/rc',
		'/es/simulations/latest/new'
	]) {
		const response = await request.get(path, { maxRedirects: 0 });
		expect([307, 308]).toContain(response.status());
		expect(response.headers().location, path).toMatch(/^\/es\//);
	}
});

test('sitemap includes datasheets, templates and bilingual alternates', async ({ request }) => {
	const response = await request.get('/sitemap.xml');
	const xml = await response.text();
	for (const path of [
		'/components',
		'/components/lifeline',
		'/templates',
		'/es/templates',
		'/es/docs/1.2/fit',
		'/es/docs/1.3/overview'
	])
		expect(xml).toContain(path + '</loc>');
	expect(xml).toContain('hreflang="es"');
	expect(xml).not.toContain('/es/docs/0.4/');
});

test('English and Spanish SSR catalogs stay isolated', async ({ request }) => {
	const responses = await Promise.all(
		['/templates', '/es/templates', '/templates', '/es/templates'].map((path) => request.get(path))
	);
	for (let index = 0; index < responses.length; index += 1) {
		const html = await responses[index]!.text();
		expect(html).toContain(`<html lang="${index % 2 ? 'es' : 'en'}"`);
		expect(html).toContain(index % 2 ? 'Plantillas iniciales' : 'Starter templates');
	}
});

test('mobile Negative mode keeps language and sound controls visible and accessible', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => localStorage.setItem('schemd:blueprint', 'negative'));
	await page.goto('/es/templates');
	await expect(page.locator('html')).toHaveAttribute('data-blueprint', 'negative');
	await expect(page.getByRole('button', { name: 'English: leer en inglés' })).toBeInViewport();
	const sound = page.getByRole('switch', { name: 'Sonido', exact: true });
	await expect(sound).toBeInViewport();
	await expect(sound).toHaveText('Sonido desactivado');
	const audit = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
		.analyze();
	expect(audit.violations).toEqual([]);
});

test('language changes reject external return targets', async ({ request }) => {
	for (const target of [
		'https://example.com',
		'//example.com',
		'/es//example.com',
		'/\\example.com'
	]) {
		const response = await request.post('/locale', {
			headers: { origin: 'http://127.0.0.1:4173' },
			form: { language: 'en', return: target },
			maxRedirects: 0
		});
		expect(response.status(), target).toBe(400);
	}
	for (const path of ['/components/constructor', '/es/components/toString']) {
		expect((await request.get(path)).status()).toBe(404);
	}
});
