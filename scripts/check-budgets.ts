import { gzipSync } from 'node:zlib';
import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const clientRoot = resolve(import.meta.dir, '../.svelte-kit/output/client/_app/immutable');
const MAX_INITIAL_CSS_GZIP = 20 * 1024;
const MAX_COMPILER_GZIP = 20 * 1024;

async function filesBelow(directory: string): Promise<readonly string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const paths: string[] = [];
	for (const entry of entries) {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) paths.push(...(await filesBelow(path)));
		else if (entry.isFile()) paths.push(path);
	}
	return paths;
}

const files = await filesBelow(clientRoot);
const cssFiles = files.filter((path) => path.endsWith('.css'));
const css = Buffer.concat(await Promise.all(cssFiles.map((path) => readFile(path))));
const cssGzip = gzipSync(css, { level: 9 }).byteLength;
if (cssGzip > MAX_INITIAL_CSS_GZIP)
	throw new Error(
		`Combined first-party CSS is ${cssGzip} B gzip, above ${MAX_INITIAL_CSS_GZIP} B.`
	);

const workerFiles = files.filter((path) => path.includes('/workers/') && path.endsWith('.js'));
if (workerFiles.length !== 1)
	throw new Error(`Expected one versioned compiler worker; found ${workerFiles.length}.`);
const worker = await readFile(workerFiles[0]);
const workerGzip = gzipSync(worker, { level: 9 }).byteLength;
if (workerGzip > MAX_COMPILER_GZIP)
	throw new Error(`Compiler worker is ${workerGzip} B gzip, above ${MAX_COMPILER_GZIP} B.`);

const browserJavaScript = files.filter(
	(path) => path.endsWith('.js') && !path.includes('/workers/')
);
for (const path of browserJavaScript) {
	const source = await readFile(path, 'utf8');
	if (source.includes('SchematicSyntaxError') || source.includes('MAX_SCHEMATIC_COMPONENTS')) {
		throw new Error(`Compiler code leaked into a non-worker browser chunk: ${path}`);
	}
}

const appTemplate = await readFile(resolve(import.meta.dir, '../src/app.html'), 'utf8');
if (/<script\s+[^>]*src=["']https?:\/\//iu.test(appTemplate))
	throw new Error('A third-party runtime script was added to app.html.');

console.log(`CSS: ${cssGzip} B gzip across ${cssFiles.length} route-scoped files.`);
console.log(`Versioned compiler worker: ${workerGzip} B gzip.`);
console.log(`Scanned ${browserJavaScript.length} non-worker browser chunks; compiler code absent.`);
