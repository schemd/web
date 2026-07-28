import { expect, test } from '@playwright/test';
import { failOnClientErrors } from './support';

test.beforeEach(async ({ page }) => {
	failOnClientErrors(page);
	await page.goto('/playground/0.4.0');
});

test('native editor provides indentation, comments, pairing, find/replace, and undo', async ({
	page
}) => {
	const editor = page.getByRole('textbox', { name: 'schemd source editor' });
	await expect(editor).toBeVisible();

	await editor.fill('port:A "A" at (80, 80) #blue');
	await editor.evaluate((field: HTMLTextAreaElement) =>
		field.setSelectionRange(0, field.value.length)
	);
	await editor.press('Tab');
	await expect(editor).toHaveValue('  port:A "A" at (80, 80) #blue');
	await editor.press('Shift+Tab');
	await expect(editor).toHaveValue('port:A "A" at (80, 80) #blue');
	await editor.press('Control+/');
	await expect(editor).toHaveValue('// port:A "A" at (80, 80) #blue');
	await editor.press('Control+/');
	await expect(editor).toHaveValue('port:A "A" at (80, 80) #blue');

	await editor.fill('');
	await editor.press('[');
	await expect(editor).toHaveValue('[]');
	expect(await editor.evaluate((field: HTMLTextAreaElement) => field.selectionStart)).toBe(1);
	await editor.press('Backspace');
	await expect(editor).toHaveValue('');

	await editor.fill('port:A "A"\nport:A "A"');
	await editor.press('Control+f');
	const find = page.getByPlaceholder('Find');
	await expect(find).toBeFocused();
	await find.fill('port');
	await page.getByRole('button', { name: 'Toggle replace' }).click();
	await page.getByPlaceholder('Replace').fill('junction');
	await page.getByRole('button', { name: 'All', exact: true }).click();
	await expect(editor).toHaveValue('junction:A "A"\njunction:A "A"');

	await page.getByRole('button', { name: 'Close find' }).click();
	await editor.pressSequentially('x');
	await expect(editor).toHaveValue('junction:A "A"\njunction:A "A"x');

	/*
	 * Undo belongs to the platform — the editor's own edits go through
	 * `setRangeText` precisely so they join the native transaction stream.
	 * Headless Chromium does not route a synthesized Control+Z to that stack
	 * (a bare `<textarea>` ignores it too), so the contract is exercised
	 * through the editing command itself: the editor must not swallow undo,
	 * and the typing it recorded must come back out.
	 */
	const undone = await editor.evaluate((field: HTMLTextAreaElement) => {
		field.focus();
		document.execCommand('undo');
		return field.value;
	});
	expect(undone).not.toContain('x');
	await expect(editor).toHaveValue(undone);

	await editor.press('Escape');
	await editor.press('Tab');
	await expect(editor).not.toBeFocused();
});

test('diagnostics navigate to source and the local command palette executes IDE commands', async ({
	page
}) => {
	const editor = page.getByRole('textbox', { name: 'schemd source editor' });
	/* The valid line must really be valid: 0.4 requires a colour on a port, so
	 * the previous fixture reported line 1 and never exercised the jump. */
	const valid = 'port:A "A" at (80, 80) #blue';
	await editor.fill(`${valid}\nnot valid`);
	const diagnostics = page.getByRole('region', { name: 'Compiler diagnostics' });
	await expect(diagnostics).toContainText('Line 2');
	await diagnostics.getByRole('button', { name: /Go to line 2/ }).click();
	expect(
		await editor.evaluate((field: HTMLTextAreaElement) => ({
			start: field.selectionStart,
			selected: field.value.slice(field.selectionStart, field.selectionEnd)
		}))
	).toEqual({ start: valid.length + 1, selected: 'not valid' });

	await page.keyboard.press('F1');
	const palette = page.getByRole('dialog', { name: 'playground commands' });
	await expect(palette).toBeVisible();
	await palette.getByRole('combobox').fill('rendered preview');
	await palette.getByRole('option', { name: /Show rendered preview/ }).click();
	await expect(page.getByRole('radio', { name: 'render' })).toHaveAttribute('aria-checked', 'true');
});

test('draft recovery survives a clean URL and the workspace remains usable on mobile', async ({
	page
}) => {
	const editor = page.getByRole('textbox', { name: 'schemd source editor' });
	const recovered = 'port:RECOVERED "local draft" at (120, 100) #cyan';
	await editor.fill(recovered);
	await page.keyboard.press('Control+s');
	await expect(page.getByText('Recovery draft saved.')).toBeVisible();

	await page.goto('/playground/0.4.0');
	await expect(editor).toHaveValue(recovered);
	await expect(page.getByText('Recovered the last local draft.')).toBeVisible();

	await page.setViewportSize({ width: 390, height: 844 });
	await page.keyboard.press('F1');
	const dialog = page.getByRole('dialog', { name: 'playground commands' });
	await expect(dialog).toBeVisible();
	const box = await dialog.boundingBox();
	expect(box).not.toBeNull();
	expect(box!.x).toBeGreaterThanOrEqual(0);
	expect(box!.x + box!.width).toBeLessThanOrEqual(390);
});

test('large-file mode bounds highlighting and gutter DOM without disabling editing', async ({
	page
}) => {
	const editor = page.getByRole('textbox', { name: 'schemd source editor' });
	const source = Array.from({ length: 5_001 }, (_, index) =>
		index === 5_000 ? '// final line' : ''
	).join('\n');
	await editor.fill(source);

	await expect(page.getByText(/plain large-file mode/)).toBeVisible();
	expect(await page.locator('.gutter-line').count()).toBeLessThan(100);
	await editor.evaluate((field: HTMLTextAreaElement) => {
		field.scrollTop = field.scrollHeight;
		field.dispatchEvent(new Event('scroll', { bubbles: true }));
	});
	await expect(page.locator('.gutter-line').last()).toHaveText('5001');

	await editor.press('End');
	await editor.pressSequentially(' edited');
	await expect(editor).toHaveValue(/final line edited$/);
});

test('oversized local documents never become brittle mega share or embed URLs', async ({
	page
}) => {
	const editor = page.getByRole('textbox', { name: 'schemd source editor' });
	const source = Array.from({ length: 2_500 }, () => '// local payload').join('\n');
	await editor.fill(source);

	await expect(page).not.toHaveURL(/[?&]code=/);
	expect(page.url().length).toBeLessThan(16_000);
	await expect(page.getByRole('button', { name: '⧉ share' })).toBeDisabled();
	await expect(page.getByRole('button', { name: '⧉ embed' })).toBeDisabled();

	await editor.fill('port:A "A" at (80, 80) #blue');
	await expect(page).toHaveURL(/[?&]code=/);
	await expect(page.getByRole('button', { name: '⧉ share' })).toBeEnabled();
	await expect(page.getByRole('button', { name: '⧉ embed' })).toBeEnabled();
});

test('opening a shared workspace does not overwrite an unrelated recovery draft', async ({
	page
}) => {
	const editor = page.getByRole('textbox', { name: 'schemd source editor' });
	const local = 'port:LOCAL "private recovery" at (80, 80) #blue';
	await editor.fill(local);
	await page.keyboard.press('Control+s');

	/*
	 * Recovery is keyed per compiler version and per tab
	 * (`schemd.playground.draft.v2:<version>:<workspaceId>`), so the slot is
	 * discovered rather than named — a hard-coded key silently stopped
	 * matching when the scheme gained those segments.
	 */
	const slot = await page.evaluate(() =>
		Object.keys(localStorage).find((key) => key.startsWith('schemd.playground.draft.v2:'))
	);
	expect(slot, 'a manual save writes one versioned recovery slot').toBeDefined();
	const stored = await page.evaluate((key) => localStorage.getItem(key), slot!);
	expect(stored).not.toBeNull();
	expect(stored).toContain('private recovery');

	const shared = 'port:SHARED "read-only arrival" at (120, 100) #cyan';
	await editor.fill(shared);
	await expect(page).toHaveURL(/[?&]code=/);
	const sharedUrl = page.url();
	await page.evaluate(([key, value]) => localStorage.setItem(key!, value!), [
		slot!,
		stored!
	] as const);

	await page.goto(sharedUrl);
	await expect(editor).toHaveValue(shared);
	await expect(page.getByText('shared · save manually')).toBeVisible();
	await page.waitForTimeout(700);
	expect(await page.evaluate((key) => localStorage.getItem(key), slot!)).toBe(stored);
});
