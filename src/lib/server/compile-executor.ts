/**
 * Warm isolated compilation with a real wall-clock deadline.
 *
 * Promise.race cannot interrupt synchronous JavaScript: its timeout runs only
 * after the compiler yields. This pool executes untrusted server compilations
 * in reusable worker threads. A timed-out worker is terminated and replaced;
 * healthy workers retain the imported compiler for low steady-state latency.
 */
import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import type { SchematicDiagnostic, SchematicLimitOptions } from '@schemd/core';
import type {
	CompileFailure,
	CompileOutcome,
	CompileRequest
} from '$lib/compile-contract';

export const SERVER_COMPILE_DEADLINE_MS = 300;
export const SERVER_COMPILE_CONCURRENCY = Math.max(1, Math.min(4, availableParallelism() - 1));
export const SERVER_COMPILE_QUEUE_CAPACITY = 8;

type Execution<Outcome> =
	| { readonly kind: 'complete'; readonly outcome: Outcome }
	| { readonly kind: 'timeout' }
	| { readonly kind: 'busy' }
	| { readonly kind: 'failed' };

export type CompileExecution = Execution<CompileOutcome>;

export const MAX_VERIFY_DIAGNOSTICS = 512;
export type InspectOutcome =
	| {
			readonly ok: true;
			readonly diagnostics: readonly SchematicDiagnostic[];
			readonly truncated: boolean;
			readonly counts: { readonly errors: number; readonly warnings: number; readonly notes: number };
			readonly netlist: {
				readonly components: number;
				readonly nets: number;
				readonly connections: number;
			};
	  }
	| CompileFailure;
export type InspectExecution = Execution<InspectOutcome>;
type CoreOutcome = CompileOutcome | InspectOutcome;
type WorkerExecution = Execution<CoreOutcome>;

interface QueuedJob {
	readonly operation: 'compile' | 'inspect';
	readonly request: CompileRequest;
	readonly limits: SchematicLimitOptions;
	readonly expiresAt: number;
	readonly resolve: (execution: WorkerExecution) => void;
	timer?: ReturnType<typeof setTimeout>;
	settled: boolean;
}

interface WorkerSlot {
	readonly worker: Worker;
	ready: boolean;
	job?: QueuedJob;
	retired: boolean;
}

export interface CompileExecutorOptions {
	readonly deadlineMs?: number;
	readonly concurrency?: number;
	readonly maxQueue?: number;
	/** Test seam for exercising bootstrap failure containment. */
	readonly coreModuleUrl?: string;
}

const CORE_MODULE_URL = import.meta.resolve('@schemd/core');

/* Static application code only. Request fields are structured-cloned into the
 * worker and passed directly as compile options; no title or source is ever
 * interpolated into executable code or a synthetic fence. */
const WORKER_SOURCE = String.raw`
'use strict';
const { parentPort, workerData } = require('node:worker_threads');
let api;
(async () => {
  try {
    api = await import(workerData.coreModuleUrl);
    parentPort.postMessage({ kind: 'ready' });
  } catch {
    parentPort.postMessage({ kind: 'bootstrap-failed' });
  }
})();
parentPort.on('message', ({ operation, request, limits }) => {
  try {
    const startedAt = performance.now();
    const options = {
      bounds: { width: request.width, height: request.height },
      title: request.title,
      limits
    };
    if (operation === 'inspect') {
      const document = api.parseSchematic(request.source, options);
      const { netlist, diagnostics } = api.inspectSchematic(document);
      const errors = diagnostics.filter((entry) => entry.severity === 'error').length;
      const warnings = diagnostics.filter((entry) => entry.severity === 'warning').length;
      parentPort.postMessage({
        kind: 'complete',
        outcome: {
          ok: true,
          diagnostics: diagnostics.slice(0, ${MAX_VERIFY_DIAGNOSTICS}),
          truncated: diagnostics.length > ${MAX_VERIFY_DIAGNOSTICS},
          counts: { errors, warnings, notes: diagnostics.length - errors - warnings },
          netlist: {
            components: netlist.nodes.length,
            nets: netlist.nets.length,
            connections: netlist.edges.length
          }
        }
      });
      return;
    }
    const compiled = api.compileSchematic(request.source, {
      ...options,
      limits,
      mode: request.mode,
      idPrefix: 'play'
    });
    parentPort.postMessage({
      kind: 'complete',
      outcome: {
        ok: true,
        svg: compiled.svg,
        metrics: { ...compiled.metrics },
        sourceMap: compiled.sourceMap,
        ms: Math.round((performance.now() - startedAt) * 100) / 100
      }
    });
  } catch (failure) {
    if (failure instanceof api.SchematicSyntaxError) {
      parentPort.postMessage({
        kind: 'complete',
        outcome: { ok: false, message: failure.message, line: failure.line }
      });
    } else {
      parentPort.postMessage({ kind: 'failed' });
    }
  }
});
`;

export class CompileExecutor {
	readonly #deadlineMs: number;
	readonly #concurrency: number;
	readonly #maxQueue: number;
	readonly #coreModuleUrl: string;
	readonly #queue: QueuedJob[] = [];
	readonly #slots: WorkerSlot[] = [];
	#warmTarget = 0;
	#bootstrapFailures = 0;
	#bootstrapRetryAt = 0;
	#bootstrapTimer?: ReturnType<typeof setTimeout>;

	constructor(options: CompileExecutorOptions = {}) {
		this.#deadlineMs = Math.max(1, Math.trunc(options.deadlineMs ?? SERVER_COMPILE_DEADLINE_MS));
		this.#concurrency = Math.max(1, Math.trunc(options.concurrency ?? SERVER_COMPILE_CONCURRENCY));
		this.#maxQueue = Math.max(0, Math.trunc(options.maxQueue ?? SERVER_COMPILE_QUEUE_CAPACITY));
		this.#coreModuleUrl = options.coreModuleUrl ?? CORE_MODULE_URL;
	}

	run(request: CompileRequest, limits: SchematicLimitOptions): Promise<CompileExecution> {
		return this.#enqueue('compile', request, limits) as Promise<CompileExecution>;
	}

	inspect(request: CompileRequest, limits: SchematicLimitOptions): Promise<InspectExecution> {
		return this.#enqueue('inspect', request, limits) as Promise<InspectExecution>;
	}

	#enqueue(
		operation: 'compile' | 'inspect',
		request: CompileRequest,
		limits: SchematicLimitOptions
	): Promise<WorkerExecution> {
		return new Promise((resolve) => {
			const now = performance.now();
			if (this.#bootstrapFailures >= 3 && now < this.#bootstrapRetryAt) {
				resolve({ kind: 'failed' });
				return;
			}
			if (this.#bootstrapFailures >= 3) this.#bootstrapFailures = 0;
			/* Count accepted work, not spawned workers. During bootstrap backoff
			 * `slots.length` can be zero; using it as capacity admitted an
			 * unbounded queue before the first worker became ready. */
			if (this.#activeCount() + this.#queue.length >= this.#concurrency + this.#maxQueue) {
				resolve({ kind: 'busy' });
				return;
			}

			const job: QueuedJob = {
				operation,
				request,
				limits,
				expiresAt: performance.now() + this.#deadlineMs,
				resolve,
				settled: false
			};
			job.timer = setTimeout(() => this.#expire(job), this.#deadlineMs);
			this.#queue.push(job);
			this.#warmTarget = Math.max(
				this.#warmTarget,
				Math.min(this.#concurrency, this.#queue.length + this.#activeCount())
			);
			this.#drain();
		});
	}

	#activeCount(): number {
		return this.#slots.reduce((count, slot) => count + (slot.job ? 1 : 0), 0);
	}

	#spawn(): void {
		const worker = new Worker(WORKER_SOURCE, {
			eval: true,
			workerData: { coreModuleUrl: this.#coreModuleUrl }
		});
		/* An idle warm compiler must not keep tests, builds, or graceful server
		 * shutdown alive. Active jobs retain their own deadline timer. */
		worker.unref();
		const slot: WorkerSlot = { worker, ready: false, retired: false };
		this.#slots.push(slot);

		worker.on('message', (message: unknown) => {
			if (!this.#isMessage(message) || slot.retired) return;
			if (message.kind === 'ready') {
				this.#bootstrapFailures = 0;
				this.#bootstrapRetryAt = 0;
				if (this.#bootstrapTimer) clearTimeout(this.#bootstrapTimer);
				slot.ready = true;
				this.#drain();
			} else if (message.kind === 'complete') {
				this.#finish(slot, { kind: 'complete', outcome: message.outcome as CoreOutcome });
			} else if (message.kind === 'bootstrap-failed') {
				this.#bootstrapFailed(slot);
			} else {
				this.#retire(slot, slot.job ? { kind: 'failed' } : undefined);
			}
		});
		worker.on('error', () => {
			if (!slot.ready && !slot.job) this.#bootstrapFailed(slot);
			else this.#retire(slot, slot.job ? { kind: 'failed' } : undefined);
		});
		worker.on('exit', () => {
			if (slot.retired) return;
			if (!slot.ready && !slot.job) this.#bootstrapFailed(slot);
			else this.#retire(slot, slot.job ? { kind: 'failed' } : undefined);
		});
	}

	#bootstrapFailed(slot: WorkerSlot): void {
		if (slot.retired) return;
		this.#retire(slot, undefined, false);
		this.#bootstrapFailures += 1;
		if (this.#bootstrapFailures >= 3) {
			/* Open a short circuit: fail queued work once and do not respawn in
			 * a tight loop. A later request may probe again after the cooldown. */
			this.#warmTarget = 0;
			this.#bootstrapRetryAt = performance.now() + 5_000;
			for (const job of this.#queue.splice(0)) this.#settle(job, { kind: 'failed' });
			return;
		}
		const delay = 25 * 2 ** (this.#bootstrapFailures - 1);
		this.#bootstrapRetryAt = performance.now() + delay;
		if (this.#bootstrapTimer) clearTimeout(this.#bootstrapTimer);
		this.#bootstrapTimer = setTimeout(() => {
			this.#bootstrapRetryAt = 0;
			this.#drain();
		}, delay);
		this.#bootstrapTimer.unref?.();
	}

	#isMessage(value: unknown): value is { kind: string; outcome?: unknown } {
		return (
			typeof value === 'object' && value !== null && typeof Reflect.get(value, 'kind') === 'string'
		);
	}

	#drain(): void {
		if (performance.now() < this.#bootstrapRetryAt) return;
		const desired = Math.min(
			this.#concurrency,
			Math.max(this.#warmTarget, this.#activeCount() + this.#queue.length)
		);
		while (this.#slots.length < desired) this.#spawn();

		for (const slot of this.#slots) {
			if (!slot.ready || slot.job || slot.retired) continue;
			let job = this.#queue.shift();
			while (job && (job.settled || performance.now() >= job.expiresAt)) {
				this.#settle(job, { kind: 'timeout' });
				job = this.#queue.shift();
			}
			if (!job) continue;
			slot.job = job;
			slot.worker.postMessage({
				operation: job.operation,
				request: job.request,
				limits: job.limits
			});
		}
	}

	#expire(job: QueuedJob): void {
		const queued = this.#queue.indexOf(job);
		if (queued >= 0) {
			this.#queue.splice(queued, 1);
			this.#settle(job, { kind: 'timeout' });
			return;
		}
		const slot = this.#slots.find((candidate) => candidate.job === job);
		if (slot) this.#retire(slot, { kind: 'timeout' });
	}

	#finish(slot: WorkerSlot, execution: WorkerExecution): void {
		const job = slot.job;
		slot.job = undefined;
		if (job) this.#settle(job, execution);
		this.#drain();
	}

	#retire(slot: WorkerSlot, execution?: WorkerExecution, replenish = true): void {
		if (slot.retired) return;
		slot.retired = true;
		const index = this.#slots.indexOf(slot);
		if (index >= 0) this.#slots.splice(index, 1);
		const job = slot.job;
		slot.job = undefined;
		void slot.worker.terminate();
		if (job && execution) this.#settle(job, execution);
		if (replenish) {
			/* Preserve the established warm-water mark after a runtime crash or timeout. */
			while (this.#slots.length < this.#warmTarget) this.#spawn();
			this.#drain();
		}
	}

	#settle(job: QueuedJob, execution: WorkerExecution): void {
		if (job.settled) return;
		job.settled = true;
		if (job.timer) clearTimeout(job.timer);
		job.resolve(execution);
	}
}

/** Process-wide bounded executor used by the public endpoint. */
export const compileExecutor = new CompileExecutor();
