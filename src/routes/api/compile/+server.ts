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
import { compileSchematic, parseSchematicFence, SchematicSyntaxError } from '@schemd/core';
import {
	COMPILE_LIMITS,
	compileFenceSpec,
	normalizeCompileRequest,
	type CompileFailure,
	type CompileRequest,
	type CompileSuccess
} from '$lib/compile-contract';

const MAX_CACHE_ENTRIES = 64;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
const MAX_REQUEST_BYTES = COMPILE_LIMITS.maxRequestBytes;
interface CacheEntry {
	readonly value: CompileSuccess | CompileFailure;
	readonly bytes: number;
}
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

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

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
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

	let result: CompileSuccess | CompileFailure;
	const requestStartedAt = performance.now();
	try {
		const fence = parseSchematicFence(compileFenceSpec(parsed));
		if (!fence) throw new SchematicSyntaxError('Unreachable: canonical fence.');
		const startedAt = performance.now();
		const compiled = compileSchematic(parsed.source, {
			...fence,
			mode: parsed.mode,
			idPrefix: 'play'
		});
		result = {
			ok: true,
			svg: compiled.svg,
			metrics: { ...compiled.metrics },
			sourceMap: compiled.sourceMap,
			ms: Math.round((performance.now() - startedAt) * 100) / 100
		};
	} catch (failure) {
		if (failure instanceof SchematicSyntaxError) {
			result = { ok: false, message: failure.message, line: failure.line };
		} else {
			result = { ok: false, message: 'Compilation failed unexpectedly.', line: undefined };
		}
	}

	cacheResult(key, result);
	return json(result, {
		headers: responseHeaders(performance.now() - requestStartedAt, 'compile')
	});
};
