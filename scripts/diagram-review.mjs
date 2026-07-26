/**
 * Report the *topological* change to every schemd diagram a branch touches.
 *
 * Reviewing a diagram change today means opening two SVGs and comparing them by
 * eye. Pixels move for a hundred uninteresting reasons — a component nudged
 * twenty units, a label rewrapped, the router picking an equally valid corridor
 * — and none of those change what the circuit *is*. What a reviewer needs to
 * know is which components appeared, which nets gained terminals, and which
 * connections were rerouted.
 *
 * The compiler already answers that, so this compiles both revisions of each
 * changed fence and prints the delta as Markdown for a PR comment or job
 * summary.
 *
 * Usage: node scripts/diagram-review.mjs <baseRef> [--out=FILE]
 *
 * Exits 0 whether or not diagrams changed — this reports, it does not gate. A
 * fence that fails to compile is already the documentation build's failure.
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

import { parseSchematic, parseSchematicFence, buildNetlist } from '@schemd/core';
import { fencedDiagrams } from '../src/lib/schemd-fence.ts';
import { diffNetlists } from '../src/lib/diagram-diff.ts';

const baseRef = process.argv[2];
if (!baseRef) {
	console.error('Usage: node scripts/diagram-review.mjs <baseRef> [--out=FILE]');
	process.exit(1);
}
const outFlag = process.argv.find((argument) => argument.startsWith('--out='));
const outFile = outFlag?.slice('--out='.length);

const git = (...args) =>
	execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/** File contents at a ref, or `undefined` when the file did not exist there. */
function fileAt(ref, path) {
	try {
		return git('show', `${ref}:${path}`);
	} catch {
		return undefined;
	}
}

/** Markdown documents this branch changed. */
function changedMarkdown() {
	const output = git('diff', '--name-only', `${baseRef}...HEAD`, '--', '*.md');
	return output.split('\n').filter((line) => line.endsWith('.md'));
}

/** Netlist for one fence, or `undefined` if it does not compile. */
function netlistOf(spec, source) {
	try {
		const fence = parseSchematicFence(spec);
		if (!fence) return undefined;
		return buildNetlist(parseSchematic(source, fence));
	} catch {
		return undefined;
	}
}

/** Index a document's fences by ordinal so revisions can be paired. */
function diagramsIn(markdown) {
	return markdown === undefined
		? new Map()
		: new Map([...fencedDiagrams(markdown)].map((d) => [d.ordinal, d]));
}

const sections = [];
let changedDiagrams = 0;

for (const path of changedMarkdown()) {
	const before = diagramsIn(fileAt(baseRef, path));
	const after = diagramsIn(fileAt('HEAD', path));
	const ordinals = [...new Set([...before.keys(), ...after.keys()])].sort((a, b) => a - b);

	for (const ordinal of ordinals) {
		const wasThere = before.get(ordinal);
		const isThere = after.get(ordinal);
		const label = `\`${path}\` · diagram ${ordinal}`;

		if (!wasThere && isThere) {
			changedDiagrams += 1;
			sections.push(`### ${label}\n\nNew diagram.\n`);
			continue;
		}
		if (wasThere && !isThere) {
			changedDiagrams += 1;
			sections.push(`### ${label}\n\nDiagram removed.\n`);
			continue;
		}
		if (!wasThere || !isThere) continue;
		if (wasThere.source === isThere.source && wasThere.spec === isThere.spec) continue;

		const left = netlistOf(wasThere.spec, wasThere.source);
		const right = netlistOf(isThere.spec, isThere.source);
		if (!left || !right) {
			changedDiagrams += 1;
			sections.push(`### ${label}\n\nSource changed; a revision does not compile.\n`);
			continue;
		}

		const delta = diffNetlists(left, right);
		if (delta.identical) {
			sections.push(
				`### ${label}\n\nSource changed, topology did not. The two revisions describe the same circuit.\n`
			);
			continue;
		}

		changedDiagrams += 1;
		const rows = delta.changes.map(
			(change) =>
				`| ${change.kind.replace(/-/g, ' ')} | ${change.summary} | ${change.details.join(' · ') || '—'} |`
		);
		sections.push(
			`### ${label}\n\n` +
				`${delta.counts.components} component, ${delta.counts.nets} net and ${delta.counts.connections} connection changes.\n\n` +
				`| change | subject | detail |\n| --- | --- | --- |\n${rows.join('\n')}\n`
		);
	}
}

const report =
	sections.length === 0
		? '## Diagram review\n\nNo schemd diagram changed on this branch.\n'
		: `## Diagram review\n\n${changedDiagrams === 0 ? 'No topological change.' : `${changedDiagrams} diagram(s) changed shape.`}\n\n${sections.join('\n')}`;

if (outFile) writeFileSync(outFile, report);
process.stdout.write(report);
