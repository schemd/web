import { expect, test } from '@playwright/test';
import { failOnClientErrors } from './support';

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

test('version selector preserves the slug and snaps future releases to the documented line', async ({
	page,
	request
}) => {
	await page.goto('/docs/0.4.0/component-reference');
	await expect(page).toHaveURL(/\/docs\/0\.4\/component-reference$/);
	await expect(page.locator('main h1')).toHaveText('Use every 0.4 primitive deliberately');

	/* Docs are versioned by documented line, so the switcher offers lines — the
	 * only values a docs URL can hold — and keeps showing the one in the URL. */
	const switcher = page.getByRole('combobox', { name: 'Documentation version' });
	await expect(switcher).toHaveValue('0.4');
	await switcher.selectOption('0.2');
	await expect(page).toHaveURL(/\/docs\/0\.2\/component-reference$/);
	await expect(page.locator('main h1')).toHaveText('Find a component and its ports');
	await expect(switcher).toHaveValue('0.2');

	/* A page the older line never published falls back to its overview rather
	 * than navigating the reader into a 404. */
	await page.goto('/docs/0.4/netlist');
	await page.getByRole('combobox', { name: 'Documentation version' }).selectOption('0.2');
	await expect(page).toHaveURL(/\/docs\/0\.2\/overview$/);

	const futureVersion = await request.get('/docs/9.9.9/overview');
	expect(futureVersion.status()).toBe(200);
	expect(futureVersion.url()).toMatch(/\/docs\/0\.4\/overview$/);
	const missingSlug = await request.get('/docs/0.4.0/not-a-document');
	expect(missingSlug.status()).toBe(404);
});

test('command palette traps focus and keyboard-navigates the versioned search index', async ({
	page
}) => {
	await page.goto('/docs/0.4.0/overview');
	await expect(page.getByRole('button', { name: 'Open command palette' })).toBeEnabled();
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
	await expect(page).toHaveURL(/\/docs\/0\.4\/component-reference$/);
});

test('playground opens valid, maps source to vector, preserves URI state, and exposes raw parity', async ({
	page
}) => {
	await page.goto('/playground/0.4.0');
	const preview = page.getByRole('region', { name: 'Compiled schematic preview' });
	await expect(preview.locator('[data-schematic] svg')).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
	const capacitor = preview.locator('[data-node-id="C1"]');
	await expect(capacitor).toHaveAttribute('data-orientation', 'down');

	await capacitor.locator('[data-port-id="in"]').hover();
	await expect(page.locator('.gutter-line').nth(4)).toHaveClass(/mapped/);
	await page.getByRole('radio', { name: 'raw svg' }).click();
	await expect(page.locator('.raw-view')).toContainText('<svg');
	await expect(page.locator('.raw-view')).toContainText('data-orientation="down"');
	await page.getByRole('radio', { name: 'render' }).click();
	await expect.poll(() => new URL(page.url()).searchParams.get('m')).toBe('full');
	const workspaceUrl = new URL(page.url());
	const sharedCode = workspaceUrl.searchParams.get('code');
	expect(sharedCode).toBeTruthy();

	await page.getByRole('spinbutton', { name: 'width' }).fill('820');
	await page.getByRole('spinbutton', { name: 'height' }).fill('500');
	await page.getByRole('textbox', { name: 'title' }).fill('Shared laboratory');
	await page.getByRole('radio', { name: 'embedded-css' }).click();
	await expect.poll(() => new URL(page.url()).searchParams.get('m')).toBe('embedded-css');
	await page.reload();
	await expect(page.getByRole('spinbutton', { name: 'width' })).toHaveValue('820');
	await expect(page.getByRole('spinbutton', { name: 'height' })).toHaveValue('500');
	await expect(page.getByRole('textbox', { name: 'title' })).toHaveValue('Shared laboratory');
	await expect(page.getByRole('radio', { name: 'embedded-css' })).toHaveAttribute(
		'aria-checked',
		'true'
	);
	await expect(preview.locator('svg')).toBeVisible();

	await page.getByRole('combobox', { name: 'Documentation version' }).selectOption('0.2.1');
	await expect(page).toHaveURL(/\/playground\/0\.2\.1\?/);
	const versionedUrl = new URL(page.url());
	expect(versionedUrl.searchParams.get('code')).toBe(sharedCode);
	expect(versionedUrl.searchParams.get('w')).toBe('820');
	expect(versionedUrl.searchParams.get('h')).toBe('500');
	expect(versionedUrl.searchParams.get('t')).toBe('Shared laboratory');
	expect(versionedUrl.searchParams.get('m')).toBe('embedded-css');
});

test('RC laboratory uses native primitives and updates derived physics without regenerating SVG', async ({
	page
}) => {
	await page.goto('/simulations/0.4.0/rc');
	const schematic = page.locator('.sim-stage [data-schematic] svg');
	await expect(schematic).toBeVisible();
	await expect(schematic.locator('[data-node-id="VIN"]')).toBeVisible();
	await expect(schematic.locator('[data-node-id="VOUT"]')).toBeVisible();
	await expect(schematic.locator('[data-node-id="OUT"]')).toBeVisible();
	await expect(schematic.locator('[data-node-id="C1"]')).toHaveAttribute(
		'data-orientation',
		'down'
	);
	const svgHandle = await schematic.elementHandle();
	expect(svgHandle).not.toBeNull();

	await page.getByRole('slider', { name: /Stimulus frequency/ }).fill('5');
	await expect(page.locator('[data-math-id="rc.readout.h"]')).not.toHaveAttribute(
		'aria-label',
		/magnitude 0\.847/
	);
	await expect(page.locator('.cutoff-overlay .bode-curve')).toHaveAttribute(
		'style',
		/stroke-width:/
	);
	expect(await svgHandle?.evaluate((element) => element.isConnected)).toBe(true);
});

test('release timeline and sitemap expose current and historical platform contexts', async ({
	page,
	request
}) => {
	await page.goto('/changelog');
	await expect(page.getByRole('heading', { name: /v0\.4\.0/ })).toBeVisible();
	await expect(page.locator('.stat').filter({ hasText: 'installed engine' })).toContainText(
		'v0.4.0'
	);
	/*
	 * The offline seed is generated from npm's own packument now, so it carries
	 * the tarball size npm reported rather than a hand-typed one. `pending` is
	 * still the honest answer for a release the snapshot has never seen — that
	 * rule is pinned as a unit test on `_seedReleases`.
	 */
	await expect(page.locator('.stat').filter({ hasText: 'latest install' })).toContainText(
		/\d[\d.,]* (?:KiB|MiB)|pending/
	);
	/* Seeded releases carry the compiler's own changelog prose, so the offline
	 * timeline is a readable history rather than a list of version numbers. */
	const noted = await page
		.locator('.milestone')
		.evaluateAll((rows) => rows.filter((row) => (row.textContent ?? '').length > 400).length);
	expect(noted).toBeGreaterThanOrEqual(10);

	const sitemap = await request.get('/sitemap.xml');
	expect(sitemap.status()).toBe(200);
	const xml = await sitemap.text();
	expect(xml).toContain('/docs/0.4/component-reference');
	expect(xml).toContain('/docs/0.2/component-reference');
	expect(xml).toContain('/simulations/0.4.0/rc');
});

test('mobile docs expose an accessible index and compiled-example bottom sheet', async ({
	page
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/docs/0.4.0/overview');
	const indexToggle = page.getByRole('button', { name: /index · Quickstart/i });
	await expect(indexToggle).toBeVisible();
	await indexToggle.click();
	await expect(indexToggle).toHaveAttribute('aria-expanded', 'true');

	const exampleToggle = page.getByRole('button', { name: 'Show compiled example' });
	await expect(exampleToggle).toBeVisible();
	await exampleToggle.click();
	await expect(page.getByRole('complementary', { name: /Compiled example/ })).toHaveClass(/open/);
});

test('every public page shell fits the mobile viewport without horizontal scroll', async ({
	page
}) => {
	test.setTimeout(120_000);
	await page.setViewportSize({ width: 390, height: 844 });
	const currentDocs = [
		'overview',
		'grammar',
		'framework-adapters',
		'component-reference',
		'markdown-adapters',
		'math-labels',
		'responsive-svg',
		'integrations',
		'netlist',
		'output-modes',
		'limits',
		'performance',
		'roadmap'
	] as const;
	const laboratories = [
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
	const routes = [
		'/',
		...currentDocs.map((slug) => `/docs/0.4.0/${slug}`),
		'/playground/0.4.0',
		'/diff/0.4.0',
		'/conformance',
		'/simulations/0.4.0',
		...laboratories.map((id) => `/simulations/0.4.0/${id}`),
		'/examples',
		'/coverage',
		'/changelog'
	];

	for (const route of routes) {
		await page.goto(route);
		await expect(page.locator('#main')).toBeVisible();
		/*
		 * Measured element by element, not from documentElement.scrollWidth.
		 *
		 * The shell sets `overflow-x: clip` on html and body, so the document
		 * can never report a scrolling area wider than the viewport — a
		 * scrollWidth assertion passes even with a 600px element on the page,
		 * which is how this guard silently stopped guarding. Clipping also made
		 * the old equality fail from the other side: headless Linux reported a
		 * 380px area inside a 390px viewport, and a shell that leaves ten pixels
		 * unused is not a layout bug.
		 *
		 * What matters on a phone is that nothing is cut off, so ask each
		 * element whether it stayed inside the viewport.
		 */
		const escapes = await page.evaluate(() => {
			const viewport = document.documentElement.clientWidth;
			const scrollsSideways = (element: Element) => {
				const overflowX = getComputedStyle(element).overflowX;
				return overflowX === 'auto' || overflowX === 'scroll';
			};
			const escaped: string[] = [];
			for (const element of document.querySelectorAll('body *')) {
				const box = element.getBoundingClientRect();
				if (box.width === 0 || box.height === 0) continue;
				if (box.left >= -1 && box.right <= viewport + 1) continue;
				/*
				 * KaTeX ships a screen-reader-only MathML twin of every formula
				 * that lays out at its unwrapped width, and an SVG clips to its
				 * own viewBox. Neither is visible overflow.
				 */
				if (element.closest('.katex-mathml') || element.parentElement?.closest('svg')) continue;
				/*
				 * Decorative paint whose scrolling belongs to a sibling. The
				 * editor's syntax layer mirrors a `<textarea>` that is itself the
				 * scroll container, translating in lock-step with it, so the walk
				 * below cannot find the scroller from here. Anything both hidden
				 * from assistive technology and untouchable is not content a
				 * phone reader can lose.
				 */
				const decorative = element.closest('[aria-hidden="true"]');
				if (decorative && getComputedStyle(decorative).pointerEvents === 'none') continue;
				/* Wide content is fine once something above it can scroll. */
				let ancestor = element.parentElement;
				let scrollable = false;
				while (ancestor && ancestor !== document.body) {
					if (scrollsSideways(ancestor)) {
						scrollable = true;
						break;
					}
					ancestor = ancestor.parentElement;
				}
				if (scrollable) continue;
				const classes = element.getAttribute('class')?.trim().split(/\s+/)[0];
				escaped.push(
					`${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''} spans ${Math.round(box.left)}–${Math.round(box.right)}px`
				);
			}
			return { viewport, escaped };
		});
		expect(
			escapes.escaped,
			`${route} must keep every element within the ${escapes.viewport}px viewport or inside a horizontal scroll container`
		).toEqual([]);
	}
});
