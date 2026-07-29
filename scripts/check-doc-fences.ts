/**
 * Compile every `schemd` fence in the documentation corpus.
 *
 * The docs pipeline compiles fences at request time, so a broken example is a
 * 500 for one page rather than a failed build. This walks the whole corpus and
 * reports every fence that does not compile, with its file, its title, and the
 * compiler's own one-based line number — which is what makes authoring a new
 * example a fast loop instead of a click-through.
 *
 *   bun scripts/check-doc-fences.ts [0.4 …]
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compileSchematic, parseSchematicFence } from '@schemd/core';

const ROOT = join(process.cwd(), 'src/lib/content/schemd');
const FENCE = /^```(schemd[^\n]*)\n([\s\S]*?)^```$/gm;

const requested = process.argv.slice(2);
const lines = (await readdir(ROOT, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name)
	.filter((line) => requested.length === 0 || requested.includes(line))
	.sort();

let fences = 0;
const failures: string[] = [];
/*
 * Each documented line must teach with its own examples. The 0.3 and 0.4
 * corpora were once byte-identical, which made the version switcher look like
 * it did nothing — so an example body reused across lines is an error, not a
 * saving. Reuse *within* one line is fine: a reference page may legitimately
 * revisit a specimen.
 */
const bodiesByLine = new Map<string, string>();

for (const line of lines) {
	const directory = join(ROOT, line);
	for (const file of (await readdir(directory)).filter((name) => name.endsWith('.md')).sort()) {
		const markdown = await readFile(join(directory, file), 'utf8');
		for (const [, info, body] of markdown.matchAll(FENCE)) {
			fences += 1;
			const where = `${line}/${file}`;
			const fence = parseSchematicFence(info!);
			if (!fence) {
				failures.push(`${where}: unparseable fence header \`${info}\``);
				continue;
			}
			const normalized = body!.trim();
			const seenIn = bodiesByLine.get(normalized);
			if (seenIn !== undefined && seenIn !== line) {
				failures.push(
					`${where} · ${fence.title}: identical example already used in ${seenIn}; give each line its own`
				);
			}
			bodiesByLine.set(normalized, line);

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
}

if (failures.length > 0) {
	console.error(`${failures.length} of ${fences} fences failed:\n`);
	for (const failure of failures) console.error(`  ✗ ${failure}`);
	process.exit(1);
}
console.info(
	`All ${fences} documentation fences compile across ${lines.join(', ')}, with no example shared between lines.`
);
