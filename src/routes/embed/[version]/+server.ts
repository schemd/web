/**
 * Standalone embeddable schematic.
 *
 * `GET /embed/[version]?code=<uri>` compiles the shared source and returns a
 * self-contained `image/svg+xml` document — the compiler's own themed vector,
 * usable directly in an `<img>`, an `<iframe>`, or a hotlink. The dark
 * "hud" blueprint palette is inlined so the SVG renders correctly without the
 * host page's custom properties.
 */
import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { compileSchematic, parseSchematicFence, SchematicSyntaxError } from '@schemd/core';
import { getRegistry, resolveVersion } from '$lib/server/registry';
import { decodeWorkspaceState } from '$lib/state-uri';

const FALLBACK_SOURCE = `port:VIN "V_{in}" at (80, 110) #blue
resistor:R1 "R" at (300, 110) #amber
port:OUT "V_{out}" at (540, 110) #emerald
VIN.out -> R1.in #blue [line]
R1.out -> OUT.in #emerald [line marker-end=arrow]`;

/** Inlined "hud" blueprint palette so the exported vector is self-contained. */
const THEME_STYLE =
	`.schematic-svg{background:#12171d;color:#dbe4ec;` +
	`--schematic-vector-fallback:#9fb2c2;--schematic-grid:#3a4a58}` +
	`.schematic-token--amber{--schematic-vector:#f2b558}` +
	`.schematic-token--blue{--schematic-vector:#7aa8ff}` +
	`.schematic-token--cyan{--schematic-vector:#57d7c4}` +
	`.schematic-token--purple{--schematic-vector:#b490f5}` +
	`.schematic-token--slate{--schematic-vector:#93a4b4}` +
	`.schematic-token--emerald{--schematic-vector:#63d98a}`;

function clampDimension(raw: string | null, fallback: number): number {
	const value = Math.trunc(Number(raw));
	return Number.isFinite(value) && value >= 64 && value <= 4096 ? value : fallback;
}

/** Extract the inner `<svg>` and inject the standalone theme + xmlns. */
function standalone(compiledSvg: string): string {
	const start = compiledSvg.indexOf('<svg');
	const end = compiledSvg.indexOf('</svg>');
	if (start < 0 || end < 0) return compiledSvg;
	const svg = compiledSvg.slice(start, end + '</svg>'.length);
	return svg
		.replace(/(<svg\b)/, '$1 xmlns="http://www.w3.org/2000/svg"')
		.replace(/(<svg[^>]*>)/, `$1<style>${THEME_STYLE}</style>`);
}

function svgResponse(body: string, status = 200): Response {
	return new Response(body, {
		status,
		headers: {
			'content-type': 'image/svg+xml; charset=utf-8',
			'cache-control': 'public, max-age=3600',
			'x-content-type-options': 'nosniff'
		}
	});
}

function errorSvg(message: string, width: number, height: number): string {
	const safe = message.replace(/[<&>]/g, (character) =>
		character === '<' ? '&lt;' : character === '>' ? '&gt;' : '&amp;'
	);
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#12171d" /><text x="50%" y="50%" fill="#f0716f" font-family="monospace" font-size="14" text-anchor="middle">${safe}</text></svg>`;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const registry = await getRegistry();
	const version = resolveVersion(registry, params.version);
	if (version === undefined) {
		error(404, `No embed release named ${params.version}.`);
	}
	if (params.version === 'latest') {
		redirect(307, `/embed/${version}${url.search}`);
	}

	const width = clampDimension(url.searchParams.get('w'), 760);
	const height = clampDimension(url.searchParams.get('h'), 380);
	const code = url.searchParams.get('code');
	const source = (code ? decodeWorkspaceState(code) : undefined) ?? FALLBACK_SOURCE;

	const fence = parseSchematicFence(
		`schemd bounds="${width}x${height}" title="Embedded schematic"`
	);
	if (!fence) return svgResponse(errorSvg('Invalid bounds.', width, height), 400);

	try {
		const compiled = compileSchematic(source, {
			...fence,
			mode: 'embedded-css',
			idPrefix: 'embed'
		});
		return svgResponse(standalone(compiled.svg));
	} catch (failure) {
		const message =
			failure instanceof SchematicSyntaxError ? failure.message : 'Compilation failed.';
		return svgResponse(errorSvg(message, width, height), 200);
	}
};
