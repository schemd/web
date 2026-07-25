/**
 * The conformance badge.
 *
 * A README badge is the smallest unit of trust a project can publish, and this
 * one is not decorative: it reports the live result of running `verifyNetlist`
 * over every documented diagram. Text is drawn with `textLength`, so the badge
 * measures correctly without shipping or assuming a font — the same discipline
 * the compiler itself uses.
 */
import type { RequestHandler } from './$types';
import { loadConformance } from '$lib/server/conformance';

const HEIGHT = 20;
const CHAR = 6.6;
const PADDING = 9;

const COLORS = { pass: '#2ea44f', warn: '#dbab09', fail: '#d1242f' } as const;

const escapeXml = (value: string): string =>
	value.replace(/[<>&"']/g, (character) => `&#${character.codePointAt(0)};`);

/** One flat badge: label on grey, value on a verdict colour. */
function badge(label: string, value: string, color: string): string {
	const labelWidth = Math.ceil(label.length * CHAR) + PADDING * 2;
	const valueWidth = Math.ceil(value.length * CHAR) + PADDING * 2;
	const total = labelWidth + valueWidth;
	const text = (content: string, x: number, width: number) =>
		`<text x="${x}" y="14" fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" textLength="${width}" lengthAdjust="spacingAndGlyphs">${escapeXml(content)}</text>`;

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${HEIGHT}" role="img" aria-label="${escapeXml(`${label}: ${value}`)}">
<title>${escapeXml(`${label}: ${value}`)}</title>
<rect width="${labelWidth}" height="${HEIGHT}" fill="#444" rx="3" />
<rect x="${labelWidth}" width="${valueWidth}" height="${HEIGHT}" fill="${color}" rx="3" />
<rect x="${labelWidth - 3}" width="6" height="${HEIGHT}" fill="${color}" />
${text(label, PADDING, Math.ceil(label.length * CHAR))}
${text(value, labelWidth + PADDING, Math.ceil(value.length * CHAR))}
</svg>`;
}

export const GET: RequestHandler = async () => {
	const { totals } = loadConformance();
	const clean = totals.clean === totals.diagrams;
	const value = clean
		? `${totals.diagrams}/${totals.diagrams} clean`
		: `${totals.errors} error${totals.errors === 1 ? '' : 's'}, ${totals.warnings} warning${totals.warnings === 1 ? '' : 's'}`;
	const color = totals.errors > 0 ? COLORS.fail : clean ? COLORS.pass : COLORS.warn;

	return new Response(badge('schemd conformance', value, color), {
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			/* Cheap to recompute, but a README hotlinks it: let caches carry it. */
			'cache-control': 'public, max-age=300, s-maxage=900, stale-while-revalidate=86400'
		}
	});
};
