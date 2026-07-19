const ROOT_IMAGE_ROLE = /(<svg\b[^>]*?)\srole="img"/u;

/**
 * Full-mode output contains focusable nodes, ports, and wires. An SVG exposed as
 * a single image cannot legally contain those controls, so interactive hosts
 * promote the root to an ARIA group while preserving its title and description.
 */
export function interactiveSchematicSvg(svg: string): string {
	return svg.replace(ROOT_IMAGE_ROLE, '$1 role="group"');
}
