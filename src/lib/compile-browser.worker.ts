/**
 * Native browser-worker boundary for the local compiler.
 *
 * The playground can legally produce a 2 MiB SVG. Even a linear compiler
 * blocks interaction when that work runs on the document's main thread, and a
 * stale-generation check cannot interrupt synchronous JavaScript. This module
 * keeps parsing, routing, netlist inspection, and SVG serialization off the UI
 * thread without adding an editor or worker dependency.
 */
import type { SchematicDiagnostic, SchematicNetlist } from '@schemd/core';
import {
	HOST_COMPILER_LIMITS,
	MALFORMED_COMPILE_REQUEST,
	normalizeCompileRequest,
	type CompileFailure,
	type CompileOutcome,
	type CompileRequest
} from '$lib/compile-contract';

interface WorkerRequest {
	readonly id: number;
	readonly kind: 'compile' | 'inspect';
	readonly request: CompileRequest;
}

type InspectionOutcome =
	| {
			readonly ok: true;
			readonly svg: string;
			readonly netlist: SchematicNetlist;
			readonly diagnostics: readonly SchematicDiagnostic[];
	  }
	| CompileFailure;

interface WorkerResponse {
	readonly id: number;
	readonly result: CompileOutcome | InspectionOutcome | undefined;
}

const corePromise = import('@schemd/core').catch(() => undefined);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

async function execute(message: WorkerRequest): Promise<WorkerResponse> {
	const core = await corePromise;
	if (!core) return { id: message.id, result: undefined };
	const normalized = normalizeCompileRequest(message.request);
	if (!normalized) return { id: message.id, result: MALFORMED_COMPILE_REQUEST };

	/* Pass structured options directly. Synthesizing a Markdown fence would
	 * create a second parser boundary where a title containing a newline could
	 * alter syntax instead of remaining inert data. */
	const options = {
		bounds: { width: normalized.width, height: normalized.height },
		title: normalized.title,
		limits: HOST_COMPILER_LIMITS
	};

	try {
		if (message.kind === 'inspect') {
			const document = core.parseSchematic(normalized.source, options);
			const svg = core.renderSchematic(document, {
				...options,
				mode: normalized.mode,
				idPrefix: 'review'
			});
			const { netlist, diagnostics } = core.inspectSchematic(document);
			return { id: message.id, result: { ok: true, svg, netlist, diagnostics } };
		}

		const startedAt = performance.now();
		const compiled = core.compileSchematic(normalized.source, {
			...options,
			mode: normalized.mode,
			idPrefix: 'play'
		});
		return {
			id: message.id,
			result: {
				ok: true,
				svg: compiled.svg,
				metrics: { ...compiled.metrics },
				sourceMap: compiled.sourceMap,
				ms: Math.round((performance.now() - startedAt) * 100) / 100
			}
		};
	} catch (failure) {
		if (failure instanceof core.SchematicSyntaxError) {
			return {
				id: message.id,
				result: { ok: false, message: failure.message, line: failure.line }
			};
		}
		return {
			id: message.id,
			result: {
				ok: false,
				message:
					message.kind === 'inspect'
						? 'Inspection failed unexpectedly.'
						: 'Compilation failed unexpectedly.',
				line: undefined
			}
		};
	}
}

globalThis.onmessage = (event: MessageEvent<unknown>): void => {
	const value = event.data;
	if (
		!isRecord(value) ||
		typeof value['id'] !== 'number' ||
		(value['kind'] !== 'compile' && value['kind'] !== 'inspect') ||
		!isRecord(value['request'])
	) {
		return;
	}
	const message: WorkerRequest = {
		id: value['id'],
		kind: value['kind'],
		request: value['request'] as unknown as CompileRequest
	};
	void execute(message).then((response) => globalThis.postMessage(response));
};
