/**
 * Compile every `schemd` fence in the English and Spanish documentation corpora.
 *
 * The docs pipeline compiles fences at request time, so a broken example is a
 * 500 for one page rather than a failed build. This walks the whole corpus and
 * reports every fence that does not compile, with its file, its title, and the
 * compiler's own one-based line number. Translations must keep the source's
 * complete fenced code, page identity, ordering and section anchors intact.
 *
 *   bun scripts/check-doc-fences.ts [0.4 …]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const ROOT = join(process.cwd(), 'src/lib/content/schemd');
const FENCE = /^```(schemd[^\n]*)\n([\s\S]*?)^```$/gm;
const CODE_FENCE = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[\t ]*(?:\r?\n|$)/gm;
/* Older lines intentionally fall back to English. These lines promise a
 * complete Spanish corpus, so deleting a directory must fail the gate too. */
const SPANISH_LINES = ['1.2', '1.3'];

const requested = process.argv.slice(2);
const documentedLines = (await readdir(ROOT, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.filter((line) => /^\d+\.\d+$/.test(line))
	.sort();
const lines = documentedLines.filter((line) => requested.length === 0 || requested.includes(line));
const translatedLines = new Set([
	...SPANISH_LINES,
	...(await readdir(join(ROOT, 'es'), { withFileTypes: true }).catch(() => []))
		.filter((entry) => entry.isDirectory() && /^\d+\.\d+$/.test(entry.name))
		.map((entry) => entry.name)
]);

const counts = { en: 0, es: 0 };
let translatedPages = 0;
let preservedFences = 0;
const failures: string[] = [];
/*
 * Each documented line must teach with its own examples. The 0.3 and 0.4
 * corpora were once byte-identical, which made the version switcher look like
 * it did nothing — so an example body reused across lines is an error, not a
 * saving. Reuse *within* one line is fine: a reference page may legitimately
 * revisit a specimen.
 */
const bodiesByLine = new Map<string, string>();

for (const line of requested) {
	if (!lines.includes(line)) failures.push(`Unknown documentation line: ${line}`);
}
for (const line of translatedLines) {
	if (!documentedLines.includes(line) && (requested.length === 0 || requested.includes(line))) {
		failures.push(`es/${line}: no matching English documentation line`);
	}
}

function compileFences(markdown: string, where: string, line: string, locale: 'en' | 'es'): void {
	for (const [, info, body] of markdown.matchAll(FENCE)) {
		counts[locale] += 1;
		const fence = parseSchematicFence(info!);
		if (!fence) {
			failures.push(`${where}: unparseable fence header \`${info}\``);
			continue;
		}
		/* A translation repeats its own line's examples by design. Only the
		 * English corpus establishes whether an example was reused across lines. */
		if (locale === 'en') {
			const normalized = body!.trim();
			const seenIn = bodiesByLine.get(normalized);
			if (seenIn !== undefined && seenIn !== line) {
				failures.push(
					`${where} · ${fence.title}: identical example already used in ${seenIn}; give each line its own`
				);
			}
			bodiesByLine.set(normalized, line);
		}

		try {
			const result = compileSchematic(body!, fence);
			if (result.metrics.components === 0) {
				failures.push(`${where} · ${fence.title}: fence declares no components`);
			}
		} catch (error) {
			failures.push(`${where} · ${fence.title}: ${(error as Error).message}`);
		}
	}
}

function fields(directive: string): ReadonlyMap<string, string> {
	return new Map(
		directive.split(';').flatMap((entry) => {
			const equals = entry.indexOf('=');
			return equals < 0 ? [] : [[entry.slice(0, equals).trim(), entry.slice(equals + 1).trim()]];
		})
	);
}

function pageMeta(markdown: string, where: string): ReadonlyMap<string, string> | undefined {
	const directives = [...markdown.matchAll(/<!--\s*schemd-doc:\s*([\s\S]*?)-->/g)];
	if (directives.length !== 1) {
		failures.push(
			`${where}: expected one schemd-doc metadata directive, found ${directives.length}`
		);
		return undefined;
	}
	const meta = fields(directives[0]![1]!);
	for (const key of ['id', 'label', 'title', 'summary', 'category', 'order']) {
		if (!meta.get(key)) failures.push(`${where}: schemd-doc metadata is missing ${key}`);
	}
	return meta;
}

function checkTranslation(english: string, spanish: string, where: string): void {
	const original = pageMeta(english, where.replace(/^es\//, ''));
	const translation = pageMeta(spanish, where);
	for (const key of ['id', 'order']) {
		if (original?.get(key) !== translation?.get(key)) {
			failures.push(`${where}: schemd-doc ${key} must match its English source`);
		}
	}
	const sectionIds = (markdown: string) =>
		[...markdown.matchAll(/<!--\s*schemd-section:\s*([\s\S]*?)-->/g)].map((match) =>
			fields(match[1]!).get('id')
		);
	if (JSON.stringify(sectionIds(english)) !== JSON.stringify(sectionIds(spanish))) {
		failures.push(`${where}: section IDs and their order must match its English source`);
	}
	const originalFences = [...english.matchAll(CODE_FENCE)].map((match) => match[0]);
	const translatedFences = [...spanish.matchAll(CODE_FENCE)].map((match) => match[0]);
	if (originalFences.length !== translatedFences.length) {
		failures.push(
			`${where}: expected ${originalFences.length} complete code fences, found ${translatedFences.length}`
		);
	}
	for (let index = 0; index < originalFences.length; index += 1) {
		if (originalFences[index] !== translatedFences[index]) {
			failures.push(
				`${where}: code fence ${index + 1} must be byte-identical to its English source`
			);
		} else {
			preservedFences += 1;
		}
	}
	translatedPages += 1;
}

for (const line of lines) {
	const directory = join(ROOT, line);
	const files = (await readdir(directory)).filter((name) => name.endsWith('.md')).sort();
	const englishByFile = new Map<string, string>();
	for (const file of files) {
		const markdown = await readFile(join(directory, file), 'utf8');
		englishByFile.set(file, markdown);
		compileFences(markdown, `${line}/${file}`, line, 'en');
	}
	if (!translatedLines.has(line)) continue;

	const spanishDirectory = join(ROOT, 'es', line);
	let spanishFiles: string[];
	try {
		spanishFiles = (await readdir(spanishDirectory)).filter((name) => name.endsWith('.md')).sort();
	} catch (error) {
		failures.push(
			`es/${line}: could not read required Spanish corpus: ${(error as Error).message}`
		);
		continue;
	}
	for (const file of files) {
		if (!spanishFiles.includes(file))
			failures.push(`es/${line}/${file}: missing Spanish translation`);
	}
	for (const file of spanishFiles) {
		const markdown = await readFile(join(spanishDirectory, file), 'utf8');
		const where = `es/${line}/${file}`;
		compileFences(markdown, where, line, 'es');
		const english = englishByFile.get(file);
		if (english === undefined) {
			failures.push(`${where}: no matching English source file`);
			continue;
		}
		checkTranslation(english, markdown, where);
	}
}

if (failures.length > 0) {
	console.error(
		`${failures.length} documentation checks failed across ${counts.en + counts.es} schematic fences:\n`
	);
	for (const failure of failures) console.error(`  ✗ ${failure}`);
	process.exit(1);
}
console.info(
	`All ${counts.en + counts.es} documentation schematic fences compile (English: ${counts.en}; Spanish: ${counts.es}) across ${lines.join(', ')}. No English example is shared between lines.`
);
console.info(
	`Spanish parity: ${translatedPages} pages, ${preservedFences} byte-identical code fences, matching file sets, metadata IDs/order and section IDs.`
);
