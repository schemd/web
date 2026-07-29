import { readFile, readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { gzipSync } from 'node:zlib';

interface ManifestEntry {
	readonly file: string;
	readonly name?: string;
	readonly src?: string;
	readonly imports?: readonly string[];
	readonly dynamicImports?: readonly string[];
	readonly isDynamicEntry?: boolean;
}

const CLIENT_ROOT = join(process.cwd(), '.svelte-kit/output/client');
const MANIFEST_PATH = join(CLIENT_ROOT, '.vite/manifest.json');
const MAX_SINGLE_JS_GZIP = 22 * 1024;
/*
 * The compiler is the one chunk allowed to be large, because it is the one
 * chunk nobody downloads unless they start an authoring surface. It runs in a
 * native worker so a legal worst-case compile cannot block the document thread.
 * Keep it emitted once, referenced only by the tiny compiler facade, and out of
 * Vite's document module graph.
 */
const COMPILER_MODULE = 'node_modules/@schemd/core/dist/index.js';
const COMPILER_WORKER = /\/workers\/compile-browser\.worker-[^/]+\.js$/;
/*
 * Worker isolation adds a small message/validation boundary to the compiler's
 * public entry. Budget it separately instead of concealing it inside an
 * inflated application allowance. The combined ceiling is exactly the sum.
 */
const MAX_COMPILER_JS_GZIP = 36 * 1024;
/*
 * Raised from 146/182 KiB in 0.4. The laboratory grew from five environments
 * to thirteen, and each one ships its own lazily loaded chunk plus its share
 * of the shared instrument shell; the document budget had been exceeded on
 * `main` since that landed. These ceilings are set just above the measured
 * cost of the current catalogue, so the next unaccounted regression still
 * fails here rather than reaching a visitor.
 *
 * Raised again for the live install-telemetry page: `query.live` ships a
 * streaming client runtime that static pages do not, and it is loaded by the
 * route that needs it.
 */
const MAX_DOCUMENT_JS_GZIP = 162 * 1024;
const MAX_ALL_JS_GZIP = 198 * 1024;
/*
 * Prediction, evidence validation, progression, and the selected lab's async
 * loader are SSR-critical shell code. Keep the hard raw ceiling tight enough
 * to catch accidental model bundling without pretending that pedagogy is free.
 *
 * Raised from 27 KiB alongside the JavaScript ceilings above: the shell holds
 * one static registry entry per environment, so thirteen laboratories cost
 * more shell than five did. The models themselves stay in their own chunks —
 * the `isDynamicEntry` assertion below is what actually guards that.
 */
const MAX_SIMULATION_SHELL_RAW = 38 * 1024;
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
const javascript = clientFiles.filter((file) => file.endsWith('.js'));
const compilerWorkers = javascript.filter((file) =>
	COMPILER_WORKER.test(`/${relative(CLIENT_ROOT, file).replaceAll('\\', '/')}`)
);
assertBudget(
	compilerWorkers.length === 1,
	`expected one compiler worker, emitted ${compilerWorkers.length}: ${compilerWorkers.join(', ')}`
);
const compilerWorker = compilerWorkers[0]!;
const compilerWorkerName = relative(CLIENT_ROOT, compilerWorker).replaceAll('\\', '/');
const compilerFacade = Object.values(manifest).find((entry) => entry.name === 'compile-client');
assertBudget(compilerFacade, 'the compiler worker facade is missing from the client manifest');
assertBudget(
	manifest[COMPILER_MODULE] === undefined,
	'the schemd compiler leaked into the document module graph instead of its worker'
);

let allJavascriptGzip = 0;
let documentJavascriptGzip = 0;
let compilerGzip = 0;
let largestDocumentJavascript = { file: '', gzip: 0 };
const compilerReferences: string[] = [];
for (const file of javascript) {
	const source = await readFile(file);
	const emittedName = relative(CLIENT_ROOT, file).replaceAll('\\', '/');
	const compressed = gzipSync(source).byteLength;
	allJavascriptGzip += compressed;
	if (file === compilerWorker) {
		compilerGzip = compressed;
		continue;
	}
	documentJavascriptGzip += compressed;
	if (source.includes(compilerWorkerName.split('/').at(-1)!)) {
		compilerReferences.push(emittedName);
	}
	if (compressed > largestDocumentJavascript.gzip) {
		largestDocumentJavascript = { file: emittedName, gzip: compressed };
	}
}
assertBudget(
	compilerReferences.length === 1 && compilerReferences[0] === compilerFacade.file,
	`compiler worker is referenced outside its facade: ${compilerReferences.join(', ')}`
);
assertBudget(
	largestDocumentJavascript.gzip <= MAX_SINGLE_JS_GZIP,
	`${largestDocumentJavascript.file} is ${kib(largestDocumentJavascript.gzip)} gzip; limit ${kib(MAX_SINGLE_JS_GZIP)}`
);
assertBudget(
	compilerGzip <= MAX_COMPILER_JS_GZIP,
	`the lazily loaded compiler chunk is ${kib(compilerGzip)} gzip; limit ${kib(MAX_COMPILER_JS_GZIP)}`
);
assertBudget(
	documentJavascriptGzip <= MAX_DOCUMENT_JS_GZIP,
	`document JavaScript is ${kib(documentJavascriptGzip)} gzip; limit ${kib(MAX_DOCUMENT_JS_GZIP)}`
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
		`${kib(documentJavascriptGzip)} document JS gzip`,
		`${kib(largestDocumentJavascript.gzip)} largest document JS chunk`,
		`${kib(compilerGzip)} lazy compiler worker`,
		`${simulationImports.length} lazy simulation chunks`,
		`${kib(modernMathFontBytes)} WOFF2 math fonts`
	].join(' · ')
);
