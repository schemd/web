import { readFileSync } from 'node:fs';
import { messageKey } from '../src/lib/i18n/message-key.ts';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { failOnClientErrors } from './support';

const messageKeys = new Set(
	Object.keys(JSON.parse(readFileSync('src/lib/server/messages.en.json', 'utf8'))).map(messageKey)
);
const pages = [
	'/',
	'/templates',
	'/components',
	'/components/transistor',
	'/docs/1.3/overview',
	'/playground/1.3.0',
	'/inspector/1.3.0',
	'/simulations/1.3.0',
	'/simulations/1.3.0/rc',
	'/simulations/1.3.0/new',
	'/changelog',
	'/examples',
	'/coverage',
	'/conformance',
	'/diff/1.3.0',
	'/downloads'
];

test('converted pages remain readable and accessible in Negative mode', async ({ page }, info) => {
	test.setTimeout(120_000);
	failOnClientErrors(page);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.addInitScript(() => localStorage.setItem('schemd:blueprint', 'negative'));
	for (const path of pages) {
		await page.goto(path);
		await expect(page.locator('html')).toHaveAttribute('data-blueprint', 'negative');
		const visible = await page.locator('#main').innerText();
		expect(
			(visible.match(/@[a-z0-9]+/g) ?? []).filter((value) => messageKeys.has(value)),
			path
		).toEqual([]);
		const audit = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
			.analyze();
		expect(audit.violations, path).toEqual([]);
		if (
			[
				'/templates',
				'/components/transistor',
				'/docs/1.3/overview',
				'/simulations/1.3.0/rc'
			].includes(path)
		)
			await info.attach(`negative-${path.replaceAll('/', '-')}.png`, {
				body: await page.screenshot(),
				contentType: 'image/png'
			});
	}
	await page.goto('/es/templates');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Plantillas iniciales');
	await info.attach('negative-spanish-templates.png', {
		body: await page.screenshot(),
		contentType: 'image/png'
	});
});
