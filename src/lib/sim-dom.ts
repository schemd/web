/**
 * Event-delegation helpers for full-mode compiled schematics.
 *
 * Every function operates on the `data-*` attributes and state classes that
 * `@schemd/core` emits in `full` mode — no simulation ever mutates SVG
 * geometry, only classes and CSS custom properties.
 */

interface SimulationDomIndex {
	readonly svg: Element | null;
	readonly nodes: ReadonlyMap<string, readonly Element[]>;
	readonly wiresBySource: ReadonlyMap<string, readonly Element[]>;
	readonly wirePathsBySource: ReadonlyMap<string, readonly SVGElement[]>;
	readonly wiresByNet: ReadonlyMap<string, readonly Element[]>;
	readonly sourceByNet: ReadonlyMap<string, string>;
	activeTeachingNodes: Set<Element>;
	activeTeachingWires: Set<Element>;
	settledTeachingNodes: Set<Element>;
	settledTeachingWires: Set<Element>;
}

/**
 * A compiled schematic is immutable after `{@html svg}` mounts. Index its
 * delegation hooks once, then reuse direct element references for every frame.
 * This keeps the continuously animated labs O(changed elements), rather than
 * repeatedly asking the selector engine to walk a large SVG.
 */
const DOM_INDEX = new WeakMap<Element, SimulationDomIndex>();

function append<K, V>(map: Map<K, V[]>, key: K, value: V): void {
	const values = map.get(key);
	if (values) values.push(value);
	else map.set(key, [value]);
}

function indexFor(host: Element): SimulationDomIndex {
	const svg = host.querySelector('svg');
	const cached = DOM_INDEX.get(host);
	if (cached?.svg === svg) return cached;

	const nodes = new Map<string, Element[]>();
	const wiresBySource = new Map<string, Element[]>();
	const wirePathsBySource = new Map<string, SVGElement[]>();
	const wiresByNet = new Map<string, Element[]>();
	const sourceByNet = new Map<string, string>();

	for (const node of host.querySelectorAll('[data-node-id]')) {
		const id = node.getAttribute('data-node-id');
		if (id) append(nodes, id, node);
	}
	for (const wire of host.querySelectorAll('[data-wire-source]')) {
		const source = wire.getAttribute('data-wire-source');
		if (!source) continue;
		append(wiresBySource, source, wire);
		for (const path of wire.querySelectorAll<SVGElement>('path')) {
			append(wirePathsBySource, source, path);
		}
		const netId = wire.getAttribute('data-net-id');
		if (netId) {
			append(wiresByNet, netId, wire);
			if (!sourceByNet.has(netId)) sourceByNet.set(netId, source);
		}
	}

	const index: SimulationDomIndex = {
		svg,
		nodes,
		wiresBySource,
		wirePathsBySource,
		wiresByNet,
		sourceByNet,
		activeTeachingNodes: new Set(),
		activeTeachingWires: new Set(),
		settledTeachingNodes: new Set(),
		settledTeachingWires: new Set()
	};
	DOM_INDEX.set(host, index);
	return index;
}

/** Toggle `is-active` on every wire whose source endpoint matches. */
export function setWiresFrom(host: Element, sourceEndpoint: string, active: boolean): void {
	for (const wire of indexFor(host).wiresBySource.get(sourceEndpoint) ?? []) {
		wire.classList.toggle('is-active', active);
	}
}

/** Toggle `is-active` on a node group by component ID. */
export function setNodeActive(host: Element, nodeId: string, active: boolean): void {
	for (const node of indexFor(host).nodes.get(nodeId) ?? []) {
		node.classList.toggle('is-active', active);
	}
}

/** Toggle `is-degraded` (fault dimming) on a node group. */
export function setNodeDegraded(host: Element, nodeId: string, degraded: boolean): void {
	for (const node of indexFor(host).nodes.get(nodeId) ?? []) {
		node.classList.toggle('is-degraded', degraded);
	}
}

/** Resolve the component ID for any element inside a delegated group. */
export function delegatedNodeId(element: Element): string | undefined {
	return (
		element.closest('[data-node-id]')?.getAttribute('data-node-id') ??
		element.closest('[data-parent-node]')?.getAttribute('data-parent-node') ??
		undefined
	);
}

/** Resolve a wire's source endpoint (`ID.port`) for a delegated element. */
export function delegatedWireSource(element: Element): string | undefined {
	return element.closest('[data-wire-source]')?.getAttribute('data-wire-source') ?? undefined;
}

/** Set an inline style property on every wire path from a source endpoint. */
export function styleWiresFrom(
	host: Element,
	sourceEndpoint: string,
	property: string,
	value: string
): void {
	for (const path of indexFor(host).wirePathsBySource.get(sourceEndpoint) ?? []) {
		path.style.setProperty(property, value);
	}
}

/**
 * Drive net-topology lighting from `@schemd/core@0.3.2` `data-net-id` groups.
 *
 * A net is the first-class electrical identity the compiler resolves, so
 * lighting a whole net (every branch that shares a terminal) is one call rather
 * than one per source endpoint. `level` selects the shared optics class:
 * `'off'` clears both, `'active'` marks a carrying-but-low net, and `'high'`
 * marks a logic-1 / high-signal net that glows.
 */
export type NetLevel = 'off' | 'active' | 'high';

export function setNetLevel(host: Element, netId: string, level: NetLevel): void {
	for (const wire of indexFor(host).wiresByNet.get(netId) ?? []) {
		wire.classList.toggle('net-active', level !== 'off');
		wire.classList.toggle('net-high-signal', level === 'high');
	}
}

/** Paint every indexed net in one pass, with no selector walk or deduplication. */
export function setNetLevels(
	host: Element,
	resolve: (netId: string, sourceEndpoint: string | undefined) => NetLevel
): void {
	const index = indexFor(host);
	for (const [netId, wires] of index.wiresByNet) {
		const level = resolve(netId, index.sourceByNet.get(netId));
		for (const wire of wires) {
			wire.classList.toggle('net-active', level !== 'off');
			wire.classList.toggle('net-high-signal', level === 'high');
		}
	}
}

export interface PropagationFrame {
	readonly nodes?: readonly string[];
	readonly wires?: readonly string[];
	readonly highNodes?: readonly string[];
	readonly highWires?: readonly string[];
	/**
	 * Reached by an earlier stage of the same run.
	 *
	 * A cumulative frame lights everything it has ever reached, so the last stage
	 * of every lab ended with the whole drawing at full brightness — which is
	 * indistinguishable from no animation at all, and is why propagation read as
	 * broken. Splitting *reached earlier* from *arriving now* is what makes the
	 * front visible: settled sits between the active glow and the untouched dark.
	 */
	readonly settledNodes?: readonly string[];
	readonly settledWires?: readonly string[];
	readonly settledHighNodes?: readonly string[];
	readonly settledHighWires?: readonly string[];
}

/** Resolve node ids, plus high-only ids the simulation currently drives high. */
function collectNodes(
	index: SimulationDomIndex,
	ids: readonly string[] | undefined,
	highIds: readonly string[] | undefined
): Set<Element> {
	const collected = new Set<Element>();
	for (const id of ids ?? []) {
		for (const node of index.nodes.get(id) ?? []) collected.add(node);
	}
	for (const id of highIds ?? []) {
		for (const node of index.nodes.get(id) ?? []) {
			if (node.classList.contains('is-active')) collected.add(node);
		}
	}
	return collected;
}

/** Resolve wire sources, plus high-only sources currently carrying logic 1. */
function collectWires(
	index: SimulationDomIndex,
	sources: readonly string[] | undefined,
	highSources: readonly string[] | undefined
): Set<Element> {
	const collected = new Set<Element>();
	for (const source of sources ?? []) {
		for (const wire of index.wiresBySource.get(source) ?? []) collected.add(wire);
	}
	for (const source of highSources ?? []) {
		for (const wire of index.wiresBySource.get(source) ?? []) {
			if (wire.classList.contains('net-high-signal') || wire.classList.contains('is-active')) {
				collected.add(wire);
			}
		}
	}
	return collected;
}

/** Apply one tier's class, mutating only the elements that changed. */
function retier(previous: Set<Element>, next: Set<Element>, className: string): void {
	for (const element of previous) {
		if (!next.has(element)) element.classList.remove(className);
	}
	for (const element of next) {
		if (!previous.has(element)) element.classList.add(className);
	}
}

/**
 * Paint one teaching frame without disturbing the simulation's electrical
 * `is-active` / `net-high-signal` state. Only elements that changed between
 * frames receive a class mutation.
 */
export function setPropagationFrame(host: Element, frame: PropagationFrame): void {
	const index = indexFor(host);
	const nextNodes = collectNodes(index, frame.nodes, frame.highNodes);
	const nextWires = collectWires(index, frame.wires, frame.highWires);
	const nextSettledNodes = collectNodes(index, frame.settledNodes, frame.settledHighNodes);
	const nextSettledWires = collectWires(index, frame.settledWires, frame.settledHighWires);
	/* The active tier wins: an element arriving now is never merely settled, or
	   it would carry both classes and the dimmer one could win the cascade. */
	for (const node of nextNodes) nextSettledNodes.delete(node);
	for (const wire of nextWires) nextSettledWires.delete(wire);

	retier(index.activeTeachingNodes, nextNodes, 'is-propagating');
	retier(index.activeTeachingWires, nextWires, 'is-propagating');
	retier(index.settledTeachingNodes, nextSettledNodes, 'is-settled');
	retier(index.settledTeachingWires, nextSettledWires, 'is-settled');

	index.activeTeachingNodes = nextNodes;
	index.activeTeachingWires = nextWires;
	index.settledTeachingNodes = nextSettledNodes;
	index.settledTeachingWires = nextSettledWires;
	host.classList.add('is-teaching');
}

/** Remove the teaching overlay while preserving the live simulation state. */
export function clearPropagationFrame(host: Element): void {
	const index = indexFor(host);
	for (const node of index.activeTeachingNodes) node.classList.remove('is-propagating');
	for (const wire of index.activeTeachingWires) wire.classList.remove('is-propagating');
	for (const node of index.settledTeachingNodes) node.classList.remove('is-settled');
	for (const wire of index.settledTeachingWires) wire.classList.remove('is-settled');
	index.activeTeachingNodes.clear();
	index.activeTeachingWires.clear();
	index.settledTeachingNodes.clear();
	index.settledTeachingWires.clear();
	host.classList.remove('is-teaching');
}

/** Resolve the net identity for any element inside a delegated wire group. */
export function delegatedNetId(element: Element): string | undefined {
	return element.closest('[data-net-id]')?.getAttribute('data-net-id') ?? undefined;
}
