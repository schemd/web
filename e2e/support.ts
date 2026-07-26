import type { Page } from '@playwright/test';

/**
 * Shared Playwright helpers.
 *
 * Every suite wants the same contract — a browser error is a test failure, not
 * a line in a log nobody reads — and each suite had its own copy of it.
 */

/** Turn any page error or console error into a test failure. */
export function failOnClientErrors(page: Page): void {
	page.on('pageerror', (failure) => {
		throw failure;
	});
	page.on('console', (message) => {
		if (message.type() === 'error') throw new Error(`Browser console: ${message.text()}`);
	});
}
