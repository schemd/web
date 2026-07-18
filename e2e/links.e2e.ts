import { expect, test } from '@playwright/test';

const seeds = [
	'/',
	'/docs/v0.2.1/overview',
	'/docs/v0.2.1/grammar',
	'/docs/v0.2.1/components',
	'/docs/v0.2.1/output',
	'/docs/v0.2.1/integrations',
	'/docs/v0.2.1/performance',
	'/playground/v0.2.1',
	'/simulations/v0.2.1',
	'/timeline',
	'/changelog',
	'/search?q=compile'
] as const;

test('published internal links resolve without errors', async ({ page, request, baseURL }) => {
	test.setTimeout(90_000);
	const origin = new URL(baseURL ?? 'http://127.0.0.1:4173').origin;
	const paths = new Set<string>(seeds);

	for (const seed of seeds) {
		await page.goto(seed);
		for (const href of await page.locator('a[href]').evaluateAll((anchors) =>
			anchors.map((anchor) => anchor.getAttribute('href')).filter((href): href is string => href !== null)
		)) {
			const url = new URL(href, origin);
			if (url.origin === origin) paths.add(`${url.pathname}${url.search}`);
		}
	}

	for (const path of paths) {
		const response = await request.get(path);
		expect(response.status(), path).toBeLessThan(400);
	}
});
