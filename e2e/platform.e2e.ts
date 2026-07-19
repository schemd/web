import { expect, test } from '@playwright/test';

const currentVersion = 'v0.2.1';
const selectAll = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

test('critical SSR routes expose stable semantic shells', async ({ page }) => {
	for (const path of [
		'/',
		`/docs/${currentVersion}/overview`,
		`/playground/${currentVersion}`,
		`/simulations/${currentVersion}/digital-adder`,
		'/changelog'
	]) {
		const response = await page.goto(path);
		expect(response?.ok(), `${path} should return a successful response`).toBe(true);
		await expect(page.locator('main')).toHaveCount(1);
		await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, `${path} should not overflow horizontally`).toBeLessThanOrEqual(1);
	}
});

test('mobile documentation keeps navigation and synchronized output explicit', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`/docs/${currentVersion}/overview`);

	await expect(page.getByText('pronounced like', { exact: false }).first()).toBeVisible();
	await expect(page.locator('.docs-navigation')).toBeHidden();

	await page.getByRole('button', { name: 'Open index' }).click();
	await expect(page.locator('.docs-navigation')).toBeVisible();
	await page.getByRole('button', { name: 'Collapse index' }).click();

	await page.getByRole('button', { name: /Inspect synchronized output/i }).click();
	const output = page.getByRole('dialog', { name: 'Synchronized output' });
	await expect(output).toBeVisible();
	await expect(output.locator('svg')).toBeVisible();
	await output.getByRole('button', { name: 'Close' }).click();
	await expect(output).toBeHidden();
});

test('playground preserves multiline source, highlighting, URI state, and raw output', async ({
	page
}) => {
	await page.goto(`/playground/${currentVersion}`);
	const editor = page.getByRole('textbox', { name: 'Schemd source editor' });
	const source = [
		'port:A "Input" at (60, 100) #blue',
		'resistor:R1 "1 k\\\\Omega" at (220, 100) #amber',
		'port:B "Output" at (380, 100) #emerald',
		'',
		'A.out -> R1.in #blue [line]',
		'R1.out -> B.in #emerald [line marker-end=arrow]'
	].join('\n');

	await editor.click();
	await editor.press(selectAll);
	await editor.type(source, { delay: 1 });
	await expect(editor).toHaveText(source);
	await expect(page.locator('.syntax-editor .token-keyword')).toHaveCount(3);
	await expect(page.locator('.preview-surface svg')).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => new URL(window.location.href).searchParams.has('code')))
		.toBe(true);

	await editor.press('End');
	await editor.press('Enter');
	await editor.type('// caret probe');
	await expect(editor).toHaveText(`${source}\n// caret probe`);

	await page.getByRole('tab', { name: 'Raw SVG' }).click();
	await expect(page.locator('.raw-svg')).toContainText('<figure');
	await expect(page.getByRole('tab', { name: 'Raw SVG' })).toHaveAttribute('aria-selected', 'true');
});

test('command palette searches the server index and restores focus', async ({ page }) => {
	await page.goto(`/playground/${currentVersion}`);
	const editor = page.getByRole('textbox', { name: 'Schemd source editor' });
	await editor.focus();
	await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');

	const dialog = page.getByRole('dialog', { name: 'Universal command index' });
	await expect(dialog).toBeVisible();
	const search = dialog.getByRole('combobox', { name: /Search documentation/i });
	await search.fill('math labels');
	await expect(dialog.getByRole('option')).toHaveCount(2);
	await expect(dialog).toContainText('Use built-in commands or raw Unicode');

	await search.press('Escape');
	await expect(dialog).toBeHidden();
	await expect(editor).toBeFocused();
});

test('simulation controls update isolated state and diagnostics', async ({ page }) => {
	await page.goto(`/simulations/${currentVersion}/digital-adder`);
	const result = page.locator('.binary-readout strong');
	const initialResult = await result.textContent();

	await page.getByRole('button', { name: 'Overflow' }).click();
	await expect(result).not.toHaveText(initialResult ?? '');
	await page.getByRole('combobox', { name: 'Simulation color theme' }).selectOption('light');
	await expect(page.locator('.simulation-lab')).toHaveAttribute('data-theme', 'light');

	await page.getByRole('button', { name: 'Short to ground' }).click();
	await expect(page.locator('.simulation-lab')).toHaveAttribute('data-fault', 'short-ground');
	await expect(
		page.getByText('Current fault state: Short to ground.', { exact: false })
	).toBeAttached();

	const trace = page.locator('.scope-trace');
	const firstPath = await trace.getAttribute('d');
	await expect.poll(() => trace.getAttribute('d')).not.toBe(firstPath);
});
