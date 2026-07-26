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
 * Requests are normalized through the shared contract in `compile-contract.ts`,
 * the same function `/api/compile` uses, so a diagram compiled locally is
 * byte-identical to the same diagram compiled on the server — shared links and
 * embeds must not drift.
 */
import type { SchematicDiagnostic, SchematicNetlist } from '@schemd/core';
import {
	compileFenceSpec,
	MALFORMED_COMPILE_REQUEST,
	normalizeCompileRequest,
	type CompileFailure,
	type CompileOutcome,
	type CompileRequest
} from '$lib/compile-contract';

export type {
	CompileFailure,
	CompileOutcome,
	CompileRequest,
	CompileSuccess
} from '$lib/compile-contract';

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

	const normalized = normalizeCompileRequest(request);
	if (!normalized) return MALFORMED_COMPILE_REQUEST;

	const {
		parseSchematic,
		parseSchematicFence,
		renderSchematic,
		inspectSchematic,
		SchematicSyntaxError
	} = core;
	try {
		const fence = parseSchematicFence(compileFenceSpec(normalized));
		if (!fence) return MALFORMED_COMPILE_REQUEST;
		const document = parseSchematic(normalized.source, fence);
		const svg = renderSchematic(document, { ...fence, mode: normalized.mode, idPrefix: 'review' });
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

	const normalized = normalizeCompileRequest(request);
	if (!normalized) return MALFORMED_COMPILE_REQUEST;

	const { compileSchematic, parseSchematicFence, SchematicSyntaxError } = core;
	try {
		const fence = parseSchematicFence(compileFenceSpec(normalized));
		if (!fence) return MALFORMED_COMPILE_REQUEST;
		const startedAt = performance.now();
		const compiled = compileSchematic(normalized.source, {
			...fence,
			mode: normalized.mode,
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
