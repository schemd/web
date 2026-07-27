/**
 * The playground's compile endpoint.
 *
 * `@schemd/core` is a server-side compiler, and we keep it that way: the
 * browser sends source, the long-running Node process compiles it, and the
 * response carries either the SVG plus metrics or a structured line-numbered
 * diagnostic. A small LRU keyed on the full request keeps repeated
 * compilations (shared links, mode flips) at memory speed.
 */
import { json } from '@sveltejs/kit';
import { createHash } from 'node:crypto';
import type { RequestHandler } from './$types';
import {
	clientAddress,
	consumeRateLimit,
	NO_STORE,
	rateLimitHeaders,
	readLimitedJson
} from '$lib/server/request-guard';
import {
	COMPILE_LIMITS,
	HOST_COMPILER_LIMITS,
	normalizeCompileRequest,
	type CompileFailure,
	type CompileRequest,
	type CompileSuccess
} from '$lib/compile-contract';
import {
	compileExecutor,
	SERVER_COMPILE_DEADLINE_MS,
	type CompileExecution
} from '$lib/server/compile-executor';
import type { SchematicLimitOptions } from '@schemd/core';

const MAX_CACHE_ENTRIES = 64;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_REQUEST_BYTES = COMPILE_LIMITS.maxRequestBytes;
interface CacheEntry {
	readonly value: CompileSuccess | CompileFailure;
	readonly bytes: number;
}
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

/** Focused regression seam; the cache itself remains module-private. */
export function _compileCacheSnapshot(): { readonly entries: number; readonly bytes: number } {
	return { entries: cache.size, bytes: cacheBytes };
}

function requestKey(request: CompileRequest): string {
	return createHash('sha256')
		.update(request.mode)
		.update('\0')
		.update(String(request.width))
		.update('x')
		.update(String(request.height))
		.update('\0')
		.update(request.title)
		.update('\0')
		.update(request.source)
		.digest('base64url');
}

function responseBytes(value: CompileSuccess | CompileFailure): number {
	return Buffer.byteLength(JSON.stringify(value));
}

function cacheResult(key: string, value: CompileSuccess | CompileFailure): void {
	const bytes = responseBytes(value);
	if (bytes > MAX_CACHE_BYTES) return;
	const previous = cache.get(key);
	if (previous) cacheBytes -= previous.bytes;
	/* Refresh insertion order when two identical misses complete concurrently. */
	cache.delete(key);
	cache.set(key, { value, bytes });
	cacheBytes += bytes;
	while (cache.size > MAX_CACHE_ENTRIES || cacheBytes > MAX_CACHE_BYTES) {
		const oldestKey = cache.keys().next().value;
		if (oldestKey === undefined) break;
		const oldest = cache.get(oldestKey);
		if (oldest) cacheBytes -= oldest.bytes;
		cache.delete(oldestKey);
	}
}

function responseHeaders(duration: number, description: 'cache' | 'compile'): HeadersInit {
	return {
		'cache-control': 'no-store',
		'server-timing': `schemd;dur=${duration.toFixed(2)};desc="${description}"`
	};
}

interface CompileRunner {
	run(request: CompileRequest, limits: SchematicLimitOptions): Promise<CompileExecution>;
}

/** Handler factory keeps timeout/capacity/cache branches unit-testable. */
export function _createCompileHandler(runner: CompileRunner = compileExecutor): RequestHandler {
	/* Collapse identical concurrent misses before they consume another worker
	 * slot. The map belongs to this handler instance so injected test runners
	 * and independently constructed servers can never share promises. */
	const inFlight = new Map<string, Promise<CompileExecution>>();

	return async ({ request, getClientAddress }) => {
		const rate = consumeRateLimit('compile', clientAddress(getClientAddress), {
			capacity: 80,
			refillPerSecond: 4
		});
		if (!rate.allowed) {
			return json(
				{ ok: false, message: 'Compile rate limit exceeded.', line: undefined },
				{
					status: 429,
					headers: rateLimitHeaders(rate.retryAfterSeconds)
				}
			);
		}

		const body = await readLimitedJson(request, MAX_REQUEST_BYTES);
		if (!body.ok) {
			return json(
				{ ok: false, message: body.message, line: undefined },
				{ status: body.status, headers: NO_STORE }
			);
		}
		const parsed = normalizeCompileRequest(body.value);
		if (!parsed) {
			return json(
				{ ok: false, message: 'Malformed compile request.', line: undefined },
				{ status: 400, headers: NO_STORE }
			);
		}

		const key = requestKey(parsed);
		const hit = cache.get(key);
		if (hit) {
			cache.delete(key);
			cache.set(key, hit);
			return json(hit.value, { headers: responseHeaders(0, 'cache') });
		}

		const requestStartedAt = performance.now();
		let pending = inFlight.get(key);
		if (!pending) {
			pending = runner
				.run(parsed, HOST_COMPILER_LIMITS)
				.catch((): CompileExecution => ({ kind: 'failed' }));
			inFlight.set(key, pending);
			void pending.finally(() => {
				if (inFlight.get(key) === pending) inFlight.delete(key);
			});
		}
		const execution = await pending;
		if (execution.kind === 'timeout') {
			return json(
				{
					ok: false,
					message: `Compilation exceeded the ${SERVER_COMPILE_DEADLINE_MS} ms server deadline.`,
					line: undefined
				},
				{
					status: 503,
					headers: {
						...responseHeaders(performance.now() - requestStartedAt, 'compile'),
						'retry-after': '1'
					}
				}
			);
		}
		if (execution.kind === 'busy') {
			return json(
				{ ok: false, message: 'Compiler is at capacity. Retry shortly.', line: undefined },
				{ status: 503, headers: { ...NO_STORE, 'retry-after': '1' } }
			);
		}
		if (execution.kind === 'failed') {
			return json(
				{ ok: false, message: 'Compilation failed unexpectedly.', line: undefined },
				{
					status: 500,
					headers: responseHeaders(performance.now() - requestStartedAt, 'compile')
				}
			);
		}

		const result: CompileSuccess | CompileFailure = execution.outcome;

		cacheResult(key, result);
		return json(result, {
			headers: responseHeaders(performance.now() - requestStartedAt, 'compile')
		});
	};
}

export const POST: RequestHandler = _createCompileHandler();
