/**
 * Give a compiled diagram the description the compiler can derive for it.
 *
 * `alt="RC filter"` is whatever the author remembered to type, and it drifts
 * from the diagram the moment the diagram changes. `@schemd/core/describe`
 * derives the sentence from the document's own topology instead, so it cannot
 * drift and needs no author effort.
 *
 * The compiler already wraps its SVG in `<figure class="schematic-frame">` with
 * the fence title as the caption, so the description belongs *in* that figure.
 * Wrapping it in a second one produces two captions for one diagram.
 */
import { describeSchematic } from '@schemd/core/describe';
import type { SchematicCompilation } from '@schemd/core';

const FRAME_OPEN = '<figure class="schematic-frame">';
const FRAME_CLOSE = '</figcaption></figure>';

function escapeAttribute(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

/**
 * Label a compiled diagram with its derived description.
 *
 * @param compiled - A compilation, whose `document` carries the topology.
 * @returns The SVG with the figure labelled and the summary beside the title.
 *
 * If the compiler ever changes its frame markup the diagram is returned
 * untouched, because shipping the diagram unlabelled beats shipping it
 * half-rewritten.
 */
export function describedDiagram(compiled: SchematicCompilation): string {
	const svg = compiled.svg;
	if (!svg.startsWith(FRAME_OPEN) || !svg.endsWith(FRAME_CLOSE)) return svg;

	const description = describeSchematic(compiled.document);
	const labelled =
		`<figure class="schematic-frame" role="group" aria-label="${escapeAttribute(description.headline)}"` +
		` data-schematic-description="${escapeAttribute(description.text)}">` +
		svg.slice(FRAME_OPEN.length);
	return (
		`${labelled.slice(0, -FRAME_CLOSE.length)} ` +
		`<span class="schematic-summary">${escapeAttribute(description.headline)}</span>` +
		FRAME_CLOSE
	);
}
