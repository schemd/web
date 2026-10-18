import { expect, test, type Page } from '@playwright/test';

/**
 * Interaction fuzzer.
 *
 * Every page the sitemap advertises, plus the instruments it deliberately
 * leaves out, is driven by a seeded random walk: clicks on whatever is
 * interactive at that moment, keys, text in every field, slider and select
 * changes, and viewport flips between phone and desktop. A page error, an
 * unhandled rejection, or a console error ends the walk and fails with the
 * seed, the page, and the actions that led there, so the run can be replayed:
 *
 *   FUZZ_SEED=1234 FUZZ_FULL=1 bun run test:fuzz
 *
 * The default run walks a fixed sample of pages briefly; `FUZZ_FULL=1` walks
 * every page, and `FUZZ_STEPS` sets the length of each walk.
 */

const SEED = Number(process.env['FUZZ_SEED'] ?? 20261017);
const FULL = process.env['FUZZ_FULL'] === '1';
const STEPS = Number(process.env['FUZZ_STEPS'] ?? (FULL ? 60 : 24));
const SHARDS = 6;
/* Comma-separated paths to walk instead of the sitemap, for replaying a seed. */
const ONLY = process.env['FUZZ_PATHS']?.split(',').filter(Boolean);

/* Shards are independent pages; let them run side by side. */
test.describe.configure({ mode: 'parallel' });

/* Pages the sitemap leaves out on purpose (historical or tool pages). */
const EXTRA_PATHS = [
	'/inspector/1.0.0',
	'/inspector/0.8.0',
	'/playground/0.8.0',
	'/diff/1.0.0',
	'/embed/1.0.0',
	'/simulations/1.0.0/new',
	'/docs/1.0/does-not-exist',
	'/no-such-page'
];

/* Source fragments for editors: sound, broken, and hostile. */
const SNIPPETS = [
	'\nresistor:RZ "1 k\\Omega" at (300, 300) #amber',
	'\nRZ.in -> RZ.out #amber [ortho]',
	'\ncapacitor:CZ "C" right-of RZ by 120 #cyan',
	'\njunction:JZ "j" below CZ by 80',
	'\nport:PZ "P" at (-100000, 4) #blue',
	'\nnand:GZ "G" at (400, 200) [inputs=99]',
	'\n[[[[',
	'\n"unterminated',
	'\nsubcircuit X(a, b) {',
	'\n}',
	'\nZZ.q -> YY.r',
	'\nresistor:R1 "dup" at (1, 1)',
	'\n\u0000‮😀 \\frac{1}{',
	'\n' + 'x'.repeat(400),
	'\nsource:VZ "V" at (100, 100) [type=voltage-dc orientation=sideways]',
	'\nresistor:RQ "R" left-of RQ by 10'
];

const KEYS = [
	'Tab',
	'Shift+Tab',
	'Enter',
	'Escape',
	'ArrowDown',
	'ArrowUp',
	'ArrowLeft',
	'ArrowRight',
	'Home',
	'End',
	'Space',
	'Backspace',
	'Control+k',
	'Meta+k',
	'F1',
	'F8',
	'Control+z',
	'Control+Shift+z'
];

const VIEWPORTS = [
	{ width: 1360, height: 860 },
	{ width: 390, height: 844 },
	{ width: 820, height: 1000 }
];

/** mulberry32: small, seedable, and the same on every machine. */
function rng(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function hash(text: string): number {
	let h = 2166136261;
	for (let index = 0; index < text.length; index += 1) {
		h = Math.imul(h ^ text.charCodeAt(index), 16777619);
	}
	return h >>> 0;
}

interface Target {
	readonly kind: 'click' | 'fill' | 'range' | 'select' | 'check';
	readonly label: string;
	readonly max?: number;
	readonly min?: number;
	readonly options?: number;
}

/**
 * Tag one random interactive element with `data-fuzz-target` and describe it.
 * Links that leave the page are not candidates: the sitemap already visits
 * every page, and a walk that wanders off stops testing the page it is on.
 */
async function pickTarget(page: Page, roll: number): Promise<Target | undefined> {
	return page.evaluate((roll) => {
		document.querySelector('[data-fuzz-target]')?.removeAttribute('data-fuzz-target');
		const selector = [
			'button:not([disabled])',
			'[role="button"]',
			'[role="tab"]',
			'[role="option"]',
			'[role="switch"]',
			'summary',
			'input:not([disabled]):not([type="hidden"])',
			'textarea:not([disabled])',
			'select:not([disabled])',
			'a[href^="#"]',
			'[tabindex="0"]'
		].join(',');
		const candidates = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(
			(element) => {
				const box = element.getBoundingClientRect();
				if (box.width === 0 || box.height === 0) return false;
				const style = getComputedStyle(element);
				return style.visibility !== 'hidden' && style.pointerEvents !== 'none';
			}
		);
		if (candidates.length === 0) return undefined;
		const element = candidates[Math.floor(roll * candidates.length)]!;
		element.setAttribute('data-fuzz-target', '');
		const label = (element.getAttribute('aria-label') ?? element.textContent ?? element.tagName)
			.trim()
			.replace(/\s+/g, ' ')
			.slice(0, 48);
		const name = `${element.tagName.toLowerCase()}「${label}」`;
		if (element instanceof HTMLSelectElement) {
			return { kind: 'select', label: name, options: element.options.length } as const;
		}
		if (element instanceof HTMLInputElement) {
			if (element.type === 'range') {
				return {
					kind: 'range',
					label: name,
					min: Number(element.min || 0),
					max: Number(element.max || 100)
				} as const;
			}
			if (element.type === 'checkbox' || element.type === 'radio') {
				return { kind: 'check', label: name } as const;
			}
			if (element.type !== 'button' && element.type !== 'submit') {
				return { kind: 'fill', label: name } as const;
			}
		}
		if (element instanceof HTMLTextAreaElement || element.isContentEditable) {
			return { kind: 'fill', label: name } as const;
		}
		return { kind: 'click', label: name } as const;
	}, roll);
}

async function walk(page: Page, path: string, seed: number): Promise<void> {
	const random = rng(seed);
	const trail: string[] = [];
	const failures: string[] = [];
	page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
	page.on('console', (message) => {
		if (message.type() === 'error') failures.push(`console: ${message.text()}`);
	});

	/* Parallel walks share one address, so together they exceed the per-address
	 * telemetry budget no single visitor can reach (a tab sends at most one
	 * batch per 1.5 s). Telemetry is answered here, outside the system under test. */
	await page.route('**/api/telemetry**', (route) => route.fulfill({ status: 204 }));

	const viewport = VIEWPORTS[Math.floor(random() * VIEWPORTS.length)]!;
	await page.setViewportSize(viewport);
	trail.push(`open ${path} at ${viewport.width}×${viewport.height}`);
	const response = await page.goto(path, { waitUntil: 'networkidle' });
	expect(response, `no response for ${path}`).not.toBeNull();
	const origin = new URL(page.url()).pathname;

	for (let step = 0; step < STEPS && failures.length === 0; step += 1) {
		const roll = random();
		try {
			if (roll < 0.08) {
				const key = KEYS[Math.floor(random() * KEYS.length)]!;
				trail.push(`key ${key}`);
				await page.keyboard.press(key);
			} else if (roll < 0.12) {
				const next = VIEWPORTS[Math.floor(random() * VIEWPORTS.length)]!;
				trail.push(`resize ${next.width}×${next.height}`);
				await page.setViewportSize(next);
			} else {
				const target = await pickTarget(page, random());
				if (target === undefined) continue;
				const locator = page.locator('[data-fuzz-target]');
				if (target.kind === 'fill') {
					const text = SNIPPETS[Math.floor(random() * SNIPPETS.length)]!;
					trail.push(`type into ${target.label}: ${JSON.stringify(text.slice(0, 40))}`);
					await locator.click({ timeout: 800 });
					await page.keyboard.press('End');
					await page.keyboard.insertText(text);
				} else if (target.kind === 'range') {
					const value = Math.round(target.min! + random() * (target.max! - target.min!));
					trail.push(`slide ${target.label} to ${value}`);
					await locator.fill(String(value), { timeout: 800 });
				} else if (target.kind === 'select') {
					const index = Math.floor(random() * Math.max(1, target.options!));
					trail.push(`select option ${index} of ${target.label}`);
					await locator.selectOption({ index }, { timeout: 800 });
				} else if (target.kind === 'check') {
					trail.push(`toggle ${target.label}`);
					await locator.click({ timeout: 800 });
				} else {
					trail.push(`click ${target.label}`);
					await locator.click({ timeout: 800 });
				}
			}
		} catch (error) {
			/* An element that moved, closed, or is covered is not a bug; the walk
			 * picks another. A crash is caught by the listeners, not here. */
			if (
				!(error instanceof Error) ||
				!/Timeout|detached|not attached|intercepts|outside of the viewport|not an <input>|Target page|selectOption|not visible/i.test(
					error.message
				)
			) {
				throw error;
			}
		}
		await page.waitForTimeout(40);
		/* A click that navigated is fine; bring the walk home and continue. */
		if (new URL(page.url()).pathname !== origin) {
			trail.push(`(navigated to ${new URL(page.url()).pathname}; returning)`);
			await page.goto(path, { waitUntil: 'networkidle' });
		}
	}
	await page.waitForTimeout(150);

	expect(
		failures,
		`seed ${seed} on ${path}\n${trail.slice(-14).join('\n')}\n— ${failures.join('\n— ')}`
	).toEqual([]);
}

async function sitemapPaths(page: Page): Promise<string[]> {
	const response = await page.request.get('/sitemap.xml');
	const xml = await response.text();
	const paths = Array.from(
		xml.matchAll(/<loc>([^<]+)<\/loc>/g),
		(match) => new URL(match[1]!).pathname
	);
	return [...new Set([...paths, ...EXTRA_PATHS])].sort();
}

for (let shard = 0; shard < SHARDS; shard += 1) {
	test(`interaction fuzz, shard ${shard + 1} of ${SHARDS}`, async ({ page }) => {
		test.setTimeout(FULL ? 1_800_000 : 240_000);
		const all = await sitemapPaths(page);
		const mine = all.filter((_, index) => index % SHARDS === shard);
		/* The default run samples three pages per shard, chosen by the seed. */
		const random = rng(SEED + shard);
		const chosen = ONLY
			? ONLY.filter((_, index) => index % SHARDS === shard)
			: FULL
				? mine
				: [...mine].sort(() => random() - 0.5).slice(0, 3);
		for (const path of chosen) {
			await walk(page, path, (SEED ^ hash(path)) >>> 0);
			console.log(`fuzz: ${path} held`);
			page.removeAllListeners('pageerror');
			page.removeAllListeners('console');
		}
	});
}
