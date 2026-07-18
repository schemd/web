const IMAGE_ROLE = ' role="img"';
const GROUP_ROLE = ' role="group"';

/**
 * Full compiler mode adds keyboard-operable descendants. An SVG advertised as
 * an image cannot legally contain those controls, so the website promotes only
 * the root role while preserving the compiler's labelled semantic structure.
 */
export function exposeInteractiveSvg(svg: string): string {
	const svgStart = svg.indexOf('<svg');
	if (svgStart < 0) throw new Error('Interactive output is missing its SVG root.');
	const openingTagEnd = svg.indexOf('>', svgStart);
	if (openingTagEnd < 0) throw new Error('Interactive SVG is missing its opening tag terminator.');
	const roleIndex = svg.indexOf(IMAGE_ROLE, svgStart);
	if (roleIndex < svgStart || roleIndex > openingTagEnd) {
		throw new Error('Interactive SVG root must expose the compiler image role.');
	}
	return `${svg.slice(0, roleIndex)}${GROUP_ROLE}${svg.slice(roleIndex + IMAGE_ROLE.length)}`;
}
