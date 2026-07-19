import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { SchematicCompilationMetrics, SchemdOutputMode } from '@schemd/core';

const WORKER_COUNT = Math.max(1, Math.min(2, availableParallelism() - 1));
const MAX_QUEUED_COMPILATIONS = 8;
const COMPILATION_TIMEOUT_MILLISECONDS = 2_000;

const WORKER_SOURCE = String.raw`
const { parentPort } = require('node:worker_threads');
const corePromise = import('@schemd/core');

parentPort.on('message', async (job) => {
  try {
    const { compileSchematic } = await corePromise;
    const compilation = compileSchematic(job.source, {
      bounds: job.bounds,
      title: job.title,
      mode: job.mode,
      semanticHooks: job.mode === 'full' ? ['nodes', 'ports', 'wires'] : [],
      idPrefix: job.idPrefix
    });
    parentPort.postMessage({
      id: job.id,
      ok: true,
      svg: compilation.svg,
      metrics: compilation.metrics
    });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : 'Schematic compilation failed.';
    const line =
      reason && typeof reason === 'object' && typeof reason.line === 'number'
        ? reason.line
        : null;
    parentPort.postMessage({ id: job.id, ok: false, message, line });
  }
});
`;

export interface IsolatedCompileInput {
	readonly source: string;
	readonly bounds: { readonly width: number; readonly height: number };
	readonly title: string;
	readonly mode: SchemdOutputMode;
	readonly idPrefix: string;
}

export type IsolatedCompileResult =
	| {
			readonly ok: true;
			readonly svg: string;
			readonly metrics: SchematicCompilationMetrics;
	  }
	| {
			readonly ok: false;
			readonly kind: 'syntax' | 'timeout' | 'overloaded' | 'internal';
			readonly message: string;
			readonly line: number | null;
	  };

interface QueuedCompilation {
	readonly id: number;
	readonly input: IsolatedCompileInput;
	readonly resolve: (result: IsolatedCompileResult) => void;
}

interface WorkerSlot {
	readonly worker: Worker;
	job: QueuedCompilation | undefined;
	timer: ReturnType<typeof setTimeout> | undefined;
}

interface WorkerSuccess {
	readonly id: number;
	readonly ok: true;
	readonly svg: string;
	readonly metrics: SchematicCompilationMetrics;
}

interface WorkerFailure {
	readonly id: number;
	readonly ok: false;
	readonly message: string;
	readonly line: number | null;
}

type WorkerResult = WorkerSuccess | WorkerFailure;

const slots: WorkerSlot[] = [];
const queue: QueuedCompilation[] = [];
let nextJobId = 1;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMetrics(value: unknown): value is SchematicCompilationMetrics {
	return (
		isRecord(value) &&
		typeof value.sourceCharacters === 'number' &&
		typeof value.components === 'number' &&
		typeof value.connections === 'number' &&
		typeof value.svgBytes === 'number'
	);
}

function workerResult(value: unknown): WorkerResult | undefined {
	if (!isRecord(value) || typeof value.id !== 'number' || typeof value.ok !== 'boolean') {
		return undefined;
	}
	if (value.ok) {
		return typeof value.svg === 'string' && isMetrics(value.metrics)
			? { id: value.id, ok: true, svg: value.svg, metrics: value.metrics }
			: undefined;
	}
	return typeof value.message === 'string' &&
		(value.line === null || typeof value.line === 'number')
		? { id: value.id, ok: false, message: value.message, line: value.line }
		: undefined;
}

function removeSlot(slot: WorkerSlot): void {
	const index = slots.indexOf(slot);
	if (index >= 0) slots.splice(index, 1);
}

function replaceSlot(slot: WorkerSlot): void {
	removeSlot(slot);
	void slot.worker.terminate();
	createSlot();
	dispatch();
}

function failSlot(slot: WorkerSlot, message: string): void {
	if (slot.timer !== undefined) clearTimeout(slot.timer);
	const job = slot.job;
	slot.job = undefined;
	job?.resolve({ ok: false, kind: 'internal', message, line: null });
	replaceSlot(slot);
}

function complete(slot: WorkerSlot, value: unknown): void {
	const result = workerResult(value);
	const job = slot.job;
	if (!result || !job || result.id !== job.id) {
		failSlot(slot, 'Compiler worker returned an invalid protocol message.');
		return;
	}
	if (slot.timer !== undefined) clearTimeout(slot.timer);
	slot.timer = undefined;
	slot.job = undefined;
	job.resolve(
		result.ok
			? { ok: true, svg: result.svg, metrics: result.metrics }
			: { ok: false, kind: 'syntax', message: result.message, line: result.line }
	);
	dispatch();
}

function createSlot(): void {
	const worker = new Worker(WORKER_SOURCE, {
		eval: true,
		name: `schemd-compiler-${slots.length + 1}`
	});
	worker.unref();
	const slot: WorkerSlot = { worker, job: undefined, timer: undefined };
	worker.on('message', (value: unknown) => complete(slot, value));
	worker.on('error', () => failSlot(slot, 'Compiler worker terminated unexpectedly.'));
	worker.on('exit', (code) => {
		if (!slots.includes(slot)) return;
		if (code !== 0 || slot.job !== undefined) {
			failSlot(slot, 'Compiler worker exited before returning a result.');
		}
	});
	slots.push(slot);
}

function dispatch(): void {
	for (const slot of slots) {
		if (slot.job !== undefined) continue;
		const job = queue.shift();
		if (!job) return;
		slot.job = job;
		slot.timer = setTimeout(() => {
			slot.timer = undefined;
			const timedOut = slot.job;
			slot.job = undefined;
			timedOut?.resolve({
				ok: false,
				kind: 'timeout',
				message: `Compilation exceeded the ${COMPILATION_TIMEOUT_MILLISECONDS} ms routing budget.`,
				line: null
			});
			replaceSlot(slot);
		}, COMPILATION_TIMEOUT_MILLISECONDS);
		slot.worker.postMessage({ id: job.id, ...job.input });
	}
}

function initialize(): void {
	while (slots.length < WORKER_COUNT) createSlot();
}

export function compileIsolated(input: IsolatedCompileInput): Promise<IsolatedCompileResult> {
	initialize();
	const active = slots.reduce((count, slot) => count + (slot.job ? 1 : 0), 0);
	if (queue.length >= MAX_QUEUED_COMPILATIONS && active === slots.length) {
		return Promise.resolve({
			ok: false,
			kind: 'overloaded',
			message: 'Compiler queue is saturated; retry after the active routing passes finish.',
			line: null
		});
	}
	return new Promise((resolve) => {
		queue.push({ id: nextJobId, input, resolve });
		nextJobId = nextJobId === Number.MAX_SAFE_INTEGER ? 1 : nextJobId + 1;
		dispatch();
	});
}

export const COMPILER_POOL_LIMITS = Object.freeze({
	workers: WORKER_COUNT,
	maxQueued: MAX_QUEUED_COMPILATIONS,
	timeoutMilliseconds: COMPILATION_TIMEOUT_MILLISECONDS
});
