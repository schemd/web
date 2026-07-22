import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

interface ManifestEntry {
	readonly file: string;
	readonly src?: string;
	readonly imports?: readonly string[];
	readonly dynamicImports?: readonly string[];
	readonly isDynamicEntry?: boolean;
}

const CLIENT_ROOT = join(process.cwd(), '.svelte-kit/output/client');
const MANIFEST_PATH = join(CLIENT_ROOT, '.vite/manifest.json');
const MAX_SINGLE_JS_GZIP = 22 * 1024;
const MAX_ALL_JS_GZIP = 180 * 1024;
const MAX_SIMULATION_SHELL_RAW = 20 * 1024;
const MAX_MODERN_MATH_FONTS = 320 * 1024;
const MAX_CLIENT_OUTPUT = 1_100 * 1024;
const EXPECTED_SIMULATIONS = 13;

function assertBudget(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`Build budget failed: ${message}`);
}

function kib(bytes: number): string {
	return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function filesBelow(root: string): Promise<readonly string[]> {
	const entries = await readdir(root, { withFileTypes: true });
	const nested = await Promise.all(
		entries.map((entry) => {
			const path = join(root, entry.name);
			return entry.isDirectory() ? filesBelow(path) : Promise.resolve([path]);
		})
	);
	return nested.flat();
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8')) as Record<string, ManifestEntry>;
const clientFiles = await filesBelow(CLIENT_ROOT);
const javascript = [...new Set(Object.values(manifest).map((entry) => entry.file))].filter((file) =>
	file.endsWith('.js')
);

let allJavascriptGzip = 0;
let largestJavascript = { file: '', gzip: 0 };
for (const file of javascript) {
	const compressed = gzipSync(await readFile(join(CLIENT_ROOT, file))).byteLength;
	allJavascriptGzip += compressed;
	if (compressed > largestJavascript.gzip) largestJavascript = { file, gzip: compressed };
}
assertBudget(
	largestJavascript.gzip <= MAX_SINGLE_JS_GZIP,
	`${largestJavascript.file} is ${kib(largestJavascript.gzip)} gzip; limit ${kib(MAX_SINGLE_JS_GZIP)}`
);
assertBudget(
	allJavascriptGzip <= MAX_ALL_JS_GZIP,
	`all client JavaScript is ${kib(allJavascriptGzip)} gzip; limit ${kib(MAX_ALL_JS_GZIP)}`
);

const simulationShell = Object.values(manifest).find(
	(entry) =>
		entry.dynamicImports?.filter((source) => source.startsWith('src/lib/components/sims/'))
			.length === EXPECTED_SIMULATIONS
);
assertBudget(simulationShell, 'simulation route lost its explicit lazy-load registry');
const simulationImports = simulationShell.dynamicImports!.filter((source) =>
	source.startsWith('src/lib/components/sims/')
);
assertBudget(
	(await stat(join(CLIENT_ROOT, simulationShell.file))).size <= MAX_SIMULATION_SHELL_RAW,
	`simulation shell exceeds ${kib(MAX_SIMULATION_SHELL_RAW)} raw`
);
for (const source of simulationImports) {
	assertBudget(manifest[source]?.isDynamicEntry, `${source} is no longer a dynamic entry`);
}

const legacyMathFonts = clientFiles.filter((file) => /KaTeX_.+\.(?:woff|ttf)$/.test(file));
assertBudget(
	legacyMathFonts.length === 0,
	`legacy KaTeX fonts emitted: ${legacyMathFonts.join(', ')}`
);
const modernMathFonts = clientFiles.filter((file) => /KaTeX_.+\.woff2$/.test(file));
const modernMathFontBytes = (
	await Promise.all(modernMathFonts.map(async (file) => (await stat(file)).size))
).reduce((total, bytes) => total + bytes, 0);
assertBudget(
	modernMathFontBytes <= MAX_MODERN_MATH_FONTS,
	`KaTeX WOFF2 assets are ${kib(modernMathFontBytes)}; limit ${kib(MAX_MODERN_MATH_FONTS)}`
);

const clientBytes = (
	await Promise.all(clientFiles.map(async (file) => (await stat(file)).size))
).reduce((total, bytes) => total + bytes, 0);
assertBudget(
	clientBytes <= MAX_CLIENT_OUTPUT,
	`client output is ${kib(clientBytes)}; limit ${kib(MAX_CLIENT_OUTPUT)}`
);

console.info(
	[
		`Build budgets passed: ${kib(clientBytes)} client output`,
		`${kib(allJavascriptGzip)} total JS gzip`,
		`${kib(largestJavascript.gzip)} largest JS chunk`,
		`${simulationImports.length} lazy simulation chunks`,
		`${kib(modernMathFontBytes)} WOFF2 math fonts`
	].join(' · ')
);
