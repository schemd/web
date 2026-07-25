/**
 * In-browser compilation for the playground.
 *
 * `@schemd/core` is a zero-dependency compiler that finishes a typical
 * schematic in well under a millisecond, and the server never runs a *different*
 * engine than this deployment ships — `/api/compile` always uses the installed
 * version. Sending every keystroke over the network to run that same compiler
 * therefore bought nothing and cost a round trip per edit.
 *
 * The module is loaded on demand, so only visitors who open the playground pay
 * for the compiler; the endpoint stays exactly as it was for SSR, embeds, and
 * as the fallback when a browser cannot load the module.
 *
 * Request normalization here mirrors `parseRequest` in `/api/compile` field for
 * field, so a diagram compiled locally is byte-identical to the same diagram
 * compiled on the server — shared links and embeds must not drift.
 */
import type { SchematicDiagnostic, SchematicNetlist, SchematicSourceMap } from '@schemd/core';

export interface CompileRequest {
	readonly source: string;
	readonly width: number;
	readonly height: number;
	readonly title: string;
	readonly mode: string;
}

export interface CompileSuccess {
	readonly ok: true;
	readonly svg: string;
	readonly metrics: {
		readonly sourceCharacters: number;
		readonly components: number;
		readonly connections: number;
		readonly svgBytes: number;
	};
	readonly sourceMap: SchematicSourceMap;
	readonly ms: number;
}

export interface CompileFailure {
	readonly ok: false;
	readonly message: string;
	readonly line: number | undefined;
}

export type CompileOutcome = CompileSuccess | CompileFailure;

/** Same ceilings the endpoint enforces before it reaches the compiler. */
const MAX_SOURCE_CHARACTERS = 131_072;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;
const MAX_TITLE_CHARACTERS = 512;

type CoreModule = typeof import('@schemd/core');

let corePromise: Promise<CoreModule | undefined> | undefined;

/** Load the compiler once per session; `undefined` means "use the endpoint". */
function loadCore(): Promise<CoreModule | undefined> {
	corePromise ??= import('@schemd/core').catch(() => undefined);
	return corePromise;
}

/** Warm the module while the visitor is still reading, not while typing. */
export function prefetchCompiler(): void {
	void loadCore();
}

/** Reject anything the endpoint would reject, with the same normalization. */
function normalize(request: CompileRequest): CompileRequest | undefined {
	const { source, width, height, title, mode } = request;
	if (typeof source !== 'string' || source.length > MAX_SOURCE_CHARACTERS) return undefined;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
	if (width < MIN_DIMENSION || width > MAX_DIMENSION) return undefined;
	if (height < MIN_DIMENSION || height > MAX_DIMENSION) return undefined;
	if (typeof title !== 'string' || title.length > MAX_TITLE_CHARACTERS) return undefined;
	return {
		source,
		width: Math.trunc(width),
		height: Math.trunc(height),
		title: title.replace(/"/g, '').trim() || 'Playground schematic',
		mode
	};
}

/**
 * Compile *and* inspect in the browser.
 *
 * The review route needs the picture and the topology behind it; doing both
 * from one parse keeps them describing the same document.
 *
 * @returns SVG, netlist, and design-rule diagnostics, or a failure — and
 * `undefined` when this browser cannot compile locally.
 */
export async function inspectInBrowser(request: CompileRequest): Promise<
	| {
			readonly ok: true;
			readonly svg: string;
			readonly netlist: SchematicNetlist;
			readonly diagnostics: readonly SchematicDiagnostic[];
	  }
	| CompileFailure
	| undefined
> {
	const core = await loadCore();
	if (!core) return undefined;

	const normalized = normalize(request);
	if (!normalized) return { ok: false, message: 'Malformed compile request.', line: undefined };

	const {
		parseSchematic,
		parseSchematicFence,
		renderSchematic,
		inspectSchematic,
		SchematicSyntaxError
	} = core;
	try {
		const fence = parseSchematicFence(
			`schemd bounds="${normalized.width}x${normalized.height}" title="${normalized.title}"`
		);
		if (!fence) return { ok: false, message: 'Malformed compile request.', line: undefined };
		const document = parseSchematic(normalized.source, fence);
		const svg = renderSchematic(document, {
			...fence,
			mode: normalized.mode as Parameters<typeof renderSchematic>[1]['mode'],
			idPrefix: 'review'
		});
		const { netlist, diagnostics } = inspectSchematic(document);
		return { ok: true, svg, netlist, diagnostics };
	} catch (failure) {
		if (failure instanceof SchematicSyntaxError) {
			return { ok: false, message: failure.message, line: failure.line };
		}
		return { ok: false, message: 'Inspection failed unexpectedly.', line: undefined };
	}
}

/**
 * Compile in the browser.
 *
 * @returns The same payload `/api/compile` returns, or `undefined` when this
 * browser cannot compile locally — the caller then falls back to the endpoint.
 */
export async function compileInBrowser(
	request: CompileRequest
): Promise<CompileOutcome | undefined> {
	const core = await loadCore();
	if (!core) return undefined;

	const normalized = normalize(request);
	if (!normalized) return { ok: false, message: 'Malformed compile request.', line: undefined };

	const { compileSchematic, parseSchematicFence, SCHEMD_OUTPUT_MODES, SchematicSyntaxError } = core;
	if (!SCHEMD_OUTPUT_MODES.some((mode) => mode === normalized.mode)) {
		return { ok: false, message: 'Malformed compile request.', line: undefined };
	}

	try {
		const fence = parseSchematicFence(
			`schemd bounds="${normalized.width}x${normalized.height}" title="${normalized.title}"`
		);
		if (!fence) return { ok: false, message: 'Malformed compile request.', line: undefined };
		const startedAt = performance.now();
		const compiled = compileSchematic(normalized.source, {
			...fence,
			mode: normalized.mode as Parameters<typeof compileSchematic>[1]['mode'],
			idPrefix: 'play'
		});
		return {
			ok: true,
			svg: compiled.svg,
			metrics: { ...compiled.metrics },
			sourceMap: compiled.sourceMap,
			ms: Math.round((performance.now() - startedAt) * 100) / 100
		};
	} catch (failure) {
		if (failure instanceof SchematicSyntaxError) {
			return { ok: false, message: failure.message, line: failure.line };
		}
		return { ok: false, message: 'Compilation failed unexpectedly.', line: undefined };
	}
}
