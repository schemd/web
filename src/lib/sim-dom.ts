/**
 * Event-delegation helpers for full-mode compiled schematics.
 *
 * Every function operates on the `data-*` attributes and state classes that
 * `@schemd/core` emits in `full` mode — no simulation ever mutates SVG
 * geometry, only classes and CSS custom properties.
 */

/** Toggle `is-active` on every wire whose source endpoint matches. */
export function setWiresFrom(host: Element, sourceEndpoint: string, active: boolean): void {
	for (const wire of host.querySelectorAll(`[data-wire-source="${CSS.escape(sourceEndpoint)}"]`)) {
		wire.classList.toggle('is-active', active);
	}
}

/** Toggle `is-active` on a node group by component ID. */
export function setNodeActive(host: Element, nodeId: string, active: boolean): void {
	host
		.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)
		?.classList.toggle('is-active', active);
}

/** Toggle `is-degraded` (fault dimming) on a node group. */
export function setNodeDegraded(host: Element, nodeId: string, degraded: boolean): void {
	host
		.querySelector(`[data-node-id="${CSS.escape(nodeId)}"]`)
		?.classList.toggle('is-degraded', degraded);
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
	for (const wire of host.querySelectorAll(`[data-wire-source="${CSS.escape(sourceEndpoint)}"]`)) {
		for (const path of wire.querySelectorAll('path')) {
			path.style.setProperty(property, value);
		}
	}
}
