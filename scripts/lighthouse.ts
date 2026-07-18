import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';

const host = '127.0.0.1';
const port = 4174;
const origin = `http://${host}:${port}`;
const routes = [
	{ name: 'landing', path: '/' },
	{ name: 'documentation', path: '/docs/v0.2.1/overview' },
	{ name: 'playground', path: '/playground/v0.2.1' },
	{ name: 'simulation', path: '/simulations/v0.2.1/rc-low-pass' }
] as const;
const scoreCategories = ['performance', 'accessibility', 'best-practices', 'seo'] as const;

function pause(milliseconds: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForServer(): Promise<void> {
	for (let attempt = 0; attempt < 60; attempt += 1) {
		try {
			const response = await fetch(origin);
			if (response.ok) return;
		} catch {
			// The preview process is still starting.
		}
		await pause(250);
	}
	throw new Error(`Preview did not start at ${origin}.`);
}

const preview = Bun.spawn(
	['bun', 'run', 'preview', '--', '--host', host, '--port', String(port), '--strictPort'],
	{
		cwd: process.cwd(),
		stdout: 'inherit',
		stderr: 'inherit'
	}
);

let chrome: Awaited<ReturnType<typeof launch>> | undefined;

try {
	await waitForServer();
	chrome = await launch({
		chromeFlags: ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage'],
		logLevel: 'error'
	});
	await mkdir('artifacts/lighthouse', { recursive: true });

	for (const route of routes) {
		const result = await lighthouse(`${origin}${route.path}`, {
			port: chrome.port,
			logLevel: 'error',
			output: 'json',
			onlyCategories: [...scoreCategories],
			formFactor: 'mobile',
			screenEmulation: {
				mobile: true,
				width: 390,
				height: 844,
				deviceScaleFactor: 2,
				disabled: false
			}
		});
		if (!result) throw new Error(`Lighthouse did not return a result for ${route.path}.`);

		const scores = Object.fromEntries(
			scoreCategories.map((category) => {
				const value = result.lhr.categories[category]?.score;
				if (value === null || value === undefined)
					throw new Error(`${category} did not return a score.`);
				return [category, Math.round(value * 100)];
			})
		);
		const largestContentfulPaint = result.lhr.audits['largest-contentful-paint']?.numericValue;
		const cumulativeLayoutShift = result.lhr.audits['cumulative-layout-shift']?.numericValue;
		const measurement = {
			route: route.path,
			scores,
			largestContentfulPaint,
			cumulativeLayoutShift,
			fetchTime: result.lhr.fetchTime
		};
		console.log(JSON.stringify(measurement));
		await writeFile(`artifacts/lighthouse/${route.name}.json`, JSON.stringify(result.lhr, null, 2));

		if (scores.performance < 95)
			throw new Error(`${route.path} performance was ${scores.performance}, below 95.`);
		for (const category of scoreCategories.slice(1)) {
			if (scores[category] !== 100)
				throw new Error(`${route.path} ${category} was ${scores[category]}, below 100.`);
		}
		if (largestContentfulPaint === undefined || largestContentfulPaint >= 1_800) {
			throw new Error(
				`${route.path} LCP was ${largestContentfulPaint ?? 'unavailable'} ms, budget is below 1800 ms.`
			);
		}
		if (cumulativeLayoutShift === undefined || cumulativeLayoutShift >= 0.05) {
			throw new Error(
				`${route.path} CLS was ${cumulativeLayoutShift ?? 'unavailable'}, budget is below 0.05.`
			);
		}
	}
} finally {
	chrome?.kill();
	preview.kill();
	await preview.exited;
}
