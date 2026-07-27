/**
 * In-browser compilation for the playground.
 *
 * `@schemd/core` is a zero-dependency compiler that finishes a typical
 * schematic in well under a millisecond, and the server never runs a *different*
 * engine than this deployment ships — `/api/compile` always uses the installed
 * version. Sending every keystroke over the network to run that same compiler
 * therefore bought nothing and cost a round trip per edit.
 *
 * The module is loaded inside a native browser worker, so only visitors who
 * open an authoring surface pay for the compiler and a large valid diagram
 * cannot block typing, selection, or assistive technology on the main thread.
 * The endpoint remains the fallback when a browser cannot start that worker.
 *
 * Requests are normalized through the shared contract in `compile-contract.ts`,
 * the same function `/api/compile` uses, so a diagram compiled locally is
 * byte-identical to the same diagram compiled on the server — shared links and
 * embeds must not drift.
 */
import type { SchematicDiagnostic, SchematicNetlist } from '@schemd/core';
import {
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
	readonly result: unknown;
}

interface PendingWorkerRequest {
	readonly resolve: (value: unknown) => void;
	readonly timer: ReturnType<typeof setTimeout>;
	readonly signal?: AbortSignal;
	readonly abort?: () => void;
}

const BROWSER_COMPILE_DEADLINE_MS = 1_000;
let compilerWorker: Worker | undefined;
let workerUnavailable = false;
let requestId = 0;
const pending = new Map<number, PendingWorkerRequest>();

function settleAll(): void {
	for (const [id, request] of pending) {
		clearTimeout(request.timer);
		if (request.signal && request.abort) request.signal.removeEventListener('abort', request.abort);
		pending.delete(id);
		request.resolve(undefined);
	}
}

function resetWorker(permanently = false): void {
	compilerWorker?.terminate();
	compilerWorker = undefined;
	workerUnavailable ||= permanently;
	settleAll();
}

/** Start one lazy, reusable native worker; undefined means "use the endpoint". */
function loadWorker(): Worker | undefined {
	if (workerUnavailable || typeof Worker === 'undefined') return undefined;
	if (compilerWorker) return compilerWorker;
	try {
		const worker = new Worker(new URL('./compile-browser.worker.ts', import.meta.url), {
			type: 'module',
			name: 'schemd-compiler'
		});
		worker.onmessage = (event: MessageEvent<unknown>): void => {
			const message = event.data as WorkerResponse;
			if (typeof message !== 'object' || message === null || typeof message.id !== 'number') {
				return;
			}
			const request = pending.get(message.id);
			if (!request) return;
			pending.delete(message.id);
			clearTimeout(request.timer);
			if (request.signal && request.abort) {
				request.signal.removeEventListener('abort', request.abort);
			}
			request.resolve(message.result);
		};
		worker.onerror = (event): void => {
			event.preventDefault();
			resetWorker(true);
		};
		compilerWorker = worker;
		return worker;
	} catch {
		workerUnavailable = true;
		return undefined;
	}
}

function runWorker<T>(
	kind: 'compile' | 'inspect',
	request: CompileRequest,
	signal?: AbortSignal
): Promise<T | undefined> {
	if (signal?.aborted) return Promise.resolve(undefined);
	const worker = loadWorker();
	if (!worker) return Promise.resolve(undefined);
	const id = ++requestId;
	return new Promise((resolve) => {
		const abort = signal
			? (): void => {
					/* Synchronous compiler work cannot be cancelled by a message.
					 * Terminate the stale worker so the replacement can start the
					 * newest edit immediately rather than queue behind it. */
					resetWorker();
				}
			: undefined;
		const timer = setTimeout(() => resetWorker(), BROWSER_COMPILE_DEADLINE_MS);
		pending.set(id, {
			resolve: (value) => resolve(value as T | undefined),
			timer,
			signal,
			abort
		});
		if (signal && abort) signal.addEventListener('abort', abort, { once: true });
		try {
			worker.postMessage({ id, kind, request });
		} catch {
			resetWorker(true);
		}
	});
}

/** Warm the module while the visitor is still reading, not while typing. */
export function prefetchCompiler(): void {
	loadWorker();
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
export async function inspectInBrowser(
	request: CompileRequest,
	signal?: AbortSignal
): Promise<InspectionOutcome | undefined> {
	const normalized = normalizeCompileRequest(request);
	if (!normalized) return MALFORMED_COMPILE_REQUEST;
	return runWorker<InspectionOutcome>('inspect', normalized, signal);
}

/**
 * Compile in the browser.
 *
 * @returns The same payload `/api/compile` returns, or `undefined` when this
 * browser cannot compile locally — the caller then falls back to the endpoint.
 */
export async function compileInBrowser(
	request: CompileRequest,
	signal?: AbortSignal
): Promise<CompileOutcome | undefined> {
	const normalized = normalizeCompileRequest(request);
	if (!normalized) return MALFORMED_COMPILE_REQUEST;
	return runWorker<CompileOutcome>('compile', normalized, signal);
}
