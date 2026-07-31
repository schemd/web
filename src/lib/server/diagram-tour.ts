/**
 * A narrated walk through a diagram, one net at a time.
 *
 * The accessibility story for every diagram tool is "we put alt text on it",
 * which for a schematic is close to useless — one paragraph cannot carry
 * topology. `describeNetlist` already writes a sentence per net; what it lacks
 * is a way to say *which* net each sentence is about while it is being read.
 *
 * This pairs each sentence with the node and net identifiers it concerns, so a
 * client can light exactly that net through the `data-*` hooks `full` mode
 * emits. The sequence is derived here, on the server, rather than in the
 * browser: it is a pure function of the document, so it caches with the page and
 * two visitors are never given different tours of the same diagram.
 */
import { buildNetlist } from '@schemd/core';
import { describeNetlist } from '@schemd/core/describe';
import type { SchematicDocument } from '@schemd/core';

/** One step of the tour: a sentence, and what it is talking about. */
export interface DiagramTourStop {
	/** Net identity, matching `data-net-id` in the compiled markup. */
	readonly netId: string;
	/** Author-supplied net name, when the source declared one. */
	readonly name?: string;
	/** The sentence to speak and to show in the transcript. */
	readonly text: string;
	/** Components on this net, for highlighting; matches `data-node-id`. */
	readonly nodes: readonly string[];
	/** Source lines that contributed, so a host can also move a caret. */
	readonly lines: readonly number[];
}

/** A complete tour: an opening summary, then one stop per net. */
export interface DiagramTour {
	/** Spoken first — scale and signal domain in one sentence. */
	readonly headline: string;
	/** What the diagram contains, spoken second. */
	readonly inventory: string;
	readonly stops: readonly DiagramTourStop[];
}

/**
 * Build the tour for one validated document.
 *
 * Nets with a single terminal are kept rather than filtered. A net going nowhere
 * is exactly the kind of thing a reader who cannot see the diagram most needs
 * told, and `verifyNetlist` already treats it as a finding.
 *
 * @param document - A document the parser has already validated.
 * @returns A stable sequence; the same document always yields the same tour.
 */
export function buildDiagramTour(document: SchematicDocument): DiagramTour {
	const netlist = buildNetlist(document);
	const description = describeNetlist(netlist);

	/*
	 * `describeNetlist` returns one sentence per net in net order, so the two
	 * arrays line up by index. Zipping on that is only safe while it holds, so
	 * the pairing is bounded by the shorter of the two rather than assumed: a
	 * future release that summarises two nets in one sentence would otherwise
	 * silently attach sentences to the wrong nets.
	 */
	const pairs = Math.min(netlist.nets.length, description.connections.length);
	const stops: DiagramTourStop[] = [];
	for (let index = 0; index < pairs; index += 1) {
		const net = netlist.nets[index]!;
		stops.push({
			netId: net.id,
			...(net.name === undefined ? {} : { name: net.name }),
			text: description.connections[index]!,
			/* Deduplicated, in first-mention order: a net that touches a component
			   twice is one highlight, not two. */
			nodes: [...new Set(net.terminals.map((terminal) => terminal.componentId))],
			lines: net.lines
		});
	}

	return { headline: description.headline, inventory: description.inventory, stops };
}
