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
import { clientAddress, consumeRateLimit, readLimitedJson } from '$lib/server/request-guard';
import {
	compileSchematic,
	parseSchematicFence,
	SCHEMD_OUTPUT_MODES,
	SchematicSyntaxError,
	type SchemdOutputMode,
	type SchematicSourceMap
} from '@schemd/core';

interface CompileRequest {
	readonly source: string;
	readonly width: number;
	readonly height: number;
	readonly title: string;
	readonly mode: SchemdOutputMode;
}

interface CompileSuccess {
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

interface CompileFailure {
	readonly ok: false;
	readonly message: string;
	readonly line: number | undefined;
}

const MAX_CACHE_ENTRIES = 64;
const MAX_CACHE_BYTES = 16 * 1024 * 1024;
/* JSON escaping can nearly double an otherwise valid source payload. Keep the
 * transport ceiling above the source ceiling without relaxing compiler limits. */
const MAX_REQUEST_BYTES = 280 * 1024;
interface CacheEntry {
	readonly value: CompileSuccess | CompileFailure;
	readonly bytes: number;
}
const cache = new Map<string, CacheEntry>();
let cacheBytes = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isOutputMode(value: unknown): value is SchemdOutputMode {
	return typeof value === 'string' && SCHEMD_OUTPUT_MODES.some((mode) => mode === value);
}

function parseRequest(body: unknown): CompileRequest | undefined {
	if (!isRecord(body)) return undefined;
	const candidate = body;
	const { source, width, height, title, mode } = candidate;
	if (typeof source !== 'string' || source.length > 131_072) return undefined;
	if (typeof width !== 'number' || typeof height !== 'number') return undefined;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
	if (width < 64 || width > 4096 || height < 64 || height > 4096) return undefined;
	if (typeof title !== 'string' || title.length > 512) return undefined;
	if (!isOutputMode(mode)) return undefined;
	return {
		source,
		width: Math.trunc(width),
		height: Math.trunc(height),
		title: title.replace(/"/g, '').trim() || 'Playground schematic',
		mode
	};
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
				headers: { 'cache-control': 'no-store', 'retry-after': String(rate.retryAfterSeconds) }
			}
		);
	}

	const body = await readLimitedJson(request, MAX_REQUEST_BYTES);
	if (!body.ok) {
		return json(
			{ ok: false, message: body.message, line: undefined },
			{ status: body.status, headers: { 'cache-control': 'no-store' } }
		);
	}
	const parsed = parseRequest(body.value);
	if (!parsed) {
		return json(
			{ ok: false, message: 'Malformed compile request.', line: undefined },
			{ status: 400, headers: { 'cache-control': 'no-store' } }
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
		const fence = parseSchematicFence(
			`schemd bounds="${parsed.width}x${parsed.height}" title="${parsed.title}"`
		);
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
