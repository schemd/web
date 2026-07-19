import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './e2e',
	testMatch: '**/*.e2e.ts',
	snapshotPathTemplate: '{testDir}/{testFilePath}-snapshots/{arg}-{projectName}.png',
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: 2,
	reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
	expect: {
		toHaveScreenshot: {
			threshold: 0.2,
			maxDiffPixelRatio: 0.03
		}
	},
	use: {
		baseURL: 'http://127.0.0.1:4173',
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure'
	},
	webServer: {
		command: 'bun run build && bun run start:test',
		url: 'http://127.0.0.1:4173',
		reuseExistingServer: !process.env.CI,
		timeout: 60_000
	},
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }]
});
