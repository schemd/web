import { readdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { parseDocumentation } from '../src/lib/docs/parser';

const root = resolve(import.meta.dir, '../src/lib/content/docs');
const versionDirectories = await readdir(root, { withFileTypes: true });
let documentCount = 0;
let exampleCount = 0;

for (const versionDirectory of versionDirectories) {
	if (!versionDirectory.isDirectory()) continue;
	const versionRoot = resolve(root, versionDirectory.name);
	const files = await readdir(versionRoot, { withFileTypes: true });
	for (const file of files) {
		if (!file.isFile() || !file.name.endsWith('.md')) continue;
		const path = resolve(versionRoot, file.name);
		const ast = parseDocumentation(await readFile(path, 'utf8'), path);
		documentCount += 1;
		for (const section of ast.sections) {
			for (const block of section.blocks) {
				if (block.kind !== 'code' || block.language !== 'schemd') continue;
				const fence = parseSchematicFence(`schemd ${block.metadata}`, ast.metadata.title);
				if (!fence) throw new Error(`${path}:${block.position.line}: invalid Schemd fence metadata.`);
				compileSchematic(block.value, { ...fence, idPrefix: `ci-${versionDirectory.name}-${ast.metadata.id}-${block.id}` });
				exampleCount += 1;
			}
		}
	}
}

if (documentCount === 0 || exampleCount === 0) throw new Error('Documentation validation found no documents or Schemd examples.');
console.log(`Compiled ${exampleCount} Schemd examples across ${documentCount} versioned documents.`);
