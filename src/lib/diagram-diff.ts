/**
 * Semantic diff for schemd diagrams.
 *
 * A picture diff tells you pixels moved. This tells you what *changed*: which
 * components appeared, which nets gained or lost terminals, which connections
 * were rerouted. That is the thing missing from diagram-as-code — a diagram
 * nobody can review is a diagram nobody trusts in a pull request.
 *
 * The comparison runs over `@schemd/core` netlists, so it inherits the
 * compiler's own topology resolution rather than guessing from geometry. Pure
 * and DOM-free; the route only renders what this returns.
 */
import type { NetlistNode, SchematicNetlist } from '@schemd/core';

/** How a single subject differs between the two documents. */
export type DiagramChangeKind =
	| 'component-added'
	| 'component-removed'
	| 'component-moved'
	| 'component-relabelled'
	| 'component-retyped'
	| 'net-added'
	| 'net-removed'
	| 'net-terminals-changed'
	| 'connection-added'
	| 'connection-removed';

/** One reviewable difference, phrased the way a reviewer would say it. */
export interface DiagramChange {
	readonly kind: DiagramChangeKind;
	/** Component id, net id, or connection description the change concerns. */
	readonly subject: string;
	readonly summary: string;
	/** Detail lines, such as the terminals a net gained or lost. */
	readonly details: readonly string[];
}

/** The complete delta between two compiled documents. */
export interface DiagramDelta {
	readonly changes: readonly DiagramChange[];
	readonly counts: {
		readonly components: number;
		readonly nets: number;
		readonly connections: number;
	};
	/** True when the two netlists are topologically identical. */
	readonly identical: boolean;
}

const terminalKey = (terminal: { componentId: string; port: string }): string =>
	`${terminal.componentId}.${terminal.port}`;

const edgeKey = (edge: {
	from: { componentId: string; port: string };
	to: { componentId: string; port: string };
}): string => [terminalKey(edge.from), terminalKey(edge.to)].sort().join(' ↔ ');

/**
 * Pair nets across the two documents.
 *
 * A named net matches its namesake. An unnamed one cannot be matched by id:
 * `$1`, `$2`, … are assigned in source order, so moving a declaration would
 * rename every net after it and a reordered-but-identical document would read
 * as a rewrite. Unnamed nets are paired by how many terminals they share,
 * strongest overlap first, which is order-independent and still deterministic.
 */
function pairNets(
	before: SchematicNetlist['nets'],
	after: SchematicNetlist['nets']
): {
	readonly pairs: readonly [SchematicNetlist['nets'][number], SchematicNetlist['nets'][number]][];
	readonly removed: readonly SchematicNetlist['nets'][number][];
	readonly added: readonly SchematicNetlist['nets'][number][];
} {
	const pairs: [SchematicNetlist['nets'][number], SchematicNetlist['nets'][number]][] = [];
	const unmatchedBefore = new Set(before);
	const unmatchedAfter = new Set(after);

	for (const original of before) {
		if (!original.name) continue;
		const match = after.find((net) => net.name === original.name);
		if (!match) continue;
		pairs.push([original, match]);
		unmatchedBefore.delete(original);
		unmatchedAfter.delete(match);
	}

	const overlaps: {
		before: SchematicNetlist['nets'][number];
		after: SchematicNetlist['nets'][number];
		shared: number;
	}[] = [];
	for (const original of unmatchedBefore) {
		const had = new Set(original.terminals.map(terminalKey));
		for (const candidate of unmatchedAfter) {
			const shared = candidate.terminals.filter((terminal) =>
				had.has(terminalKey(terminal))
			).length;
			if (shared > 0) overlaps.push({ before: original, after: candidate, shared });
		}
	}
	overlaps.sort(
		(left, right) =>
			right.shared - left.shared ||
			left.before.id.localeCompare(right.before.id) ||
			left.after.id.localeCompare(right.after.id)
	);
	for (const overlap of overlaps) {
		if (!unmatchedBefore.has(overlap.before) || !unmatchedAfter.has(overlap.after)) continue;
		pairs.push([overlap.before, overlap.after]);
		unmatchedBefore.delete(overlap.before);
		unmatchedAfter.delete(overlap.after);
	}

	return { pairs, removed: [...unmatchedBefore], added: [...unmatchedAfter] };
}

/** How a net is named in a review: its author name, else its terminals. */
const netLabel = (net: {
	name: string | undefined;
	terminals: readonly { componentId: string; port: string }[];
}): string => net.name ?? net.terminals.map(terminalKey).join('–');

const moved = (before: NetlistNode, after: NetlistNode): boolean =>
	before.x !== after.x || before.y !== after.y;

/** Sort order that keeps a delta stable between runs and readable top-down. */
const KIND_ORDER: readonly DiagramChangeKind[] = [
	'component-removed',
	'component-added',
	'component-retyped',
	'component-relabelled',
	'component-moved',
	'net-removed',
	'net-added',
	'net-terminals-changed',
	'connection-removed',
	'connection-added'
];

/**
 * Compare two netlists.
 *
 * @param before - Netlist of the original document.
 * @param after - Netlist of the revised document.
 * @returns Ordered changes plus per-category counts.
 */
export function diffNetlists(before: SchematicNetlist, after: SchematicNetlist): DiagramDelta {
	const changes: DiagramChange[] = [];

	const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
	const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));

	for (const [id, node] of beforeNodes) {
		if (afterNodes.has(id)) continue;
		changes.push({
			kind: 'component-removed',
			subject: id,
			summary: `${id} (${node.kind}) removed`,
			details: []
		});
	}
	for (const [id, node] of afterNodes) {
		if (beforeNodes.has(id)) continue;
		changes.push({
			kind: 'component-added',
			subject: id,
			summary: `${id} (${node.kind}) added`,
			details: [`at (${node.x}, ${node.y})`]
		});
	}
	for (const [id, node] of afterNodes) {
		const original = beforeNodes.get(id);
		if (!original) continue;
		if (original.kind !== node.kind) {
			changes.push({
				kind: 'component-retyped',
				subject: id,
				summary: `${id} changed from ${original.kind} to ${node.kind}`,
				details: []
			});
		}
		if (original.label !== node.label) {
			changes.push({
				kind: 'component-relabelled',
				subject: id,
				summary: `${id} relabelled`,
				details: [`"${original.label}" → "${node.label}"`]
			});
		}
		if (moved(original, node)) {
			changes.push({
				kind: 'component-moved',
				subject: id,
				summary: `${id} moved`,
				details: [`(${original.x}, ${original.y}) → (${node.x}, ${node.y})`]
			});
		}
	}

	const { pairs, removed, added } = pairNets(before.nets, after.nets);

	for (const net of removed) {
		changes.push({
			kind: 'net-removed',
			subject: netLabel(net),
			summary: `net ${netLabel(net)} removed`,
			details: [net.terminals.map(terminalKey).join(', ')]
		});
	}
	for (const net of added) {
		changes.push({
			kind: 'net-added',
			subject: netLabel(net),
			summary: `net ${netLabel(net)} added`,
			details: [net.terminals.map(terminalKey).join(', ')]
		});
	}
	for (const [original, net] of pairs) {
		const key = netLabel(net);
		const had = new Set(original.terminals.map(terminalKey));
		const has = new Set(net.terminals.map(terminalKey));
		const gained = [...has].filter((terminal) => !had.has(terminal));
		const lost = [...had].filter((terminal) => !has.has(terminal));
		if (gained.length === 0 && lost.length === 0) continue;
		changes.push({
			kind: 'net-terminals-changed',
			subject: key,
			summary: `net ${key} changed`,
			details: [
				...(gained.length ? [`gained ${gained.join(', ')}`] : []),
				...(lost.length ? [`lost ${lost.join(', ')}`] : [])
			]
		});
	}

	const beforeEdges = new Map(before.edges.map((edge) => [edgeKey(edge), edge]));
	const afterEdges = new Map(after.edges.map((edge) => [edgeKey(edge), edge]));
	for (const [key] of beforeEdges) {
		if (afterEdges.has(key)) continue;
		changes.push({
			kind: 'connection-removed',
			subject: key,
			summary: `connection ${key} removed`,
			details: []
		});
	}
	for (const [key, edge] of afterEdges) {
		if (beforeEdges.has(key)) continue;
		changes.push({
			kind: 'connection-added',
			subject: key,
			summary: `connection ${key} added`,
			details: [`line ${edge.line}`]
		});
	}

	changes.sort(
		(left, right) =>
			KIND_ORDER.indexOf(left.kind) - KIND_ORDER.indexOf(right.kind) ||
			left.subject.localeCompare(right.subject)
	);

	const counts = {
		components: changes.filter((change) => change.kind.startsWith('component-')).length,
		nets: changes.filter((change) => change.kind.startsWith('net-')).length,
		connections: changes.filter((change) => change.kind.startsWith('connection-')).length
	};

	return { changes, counts, identical: changes.length === 0 };
}
