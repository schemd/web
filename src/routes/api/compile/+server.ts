import {
	MAX_SCHEMATIC_SOURCE_CHARACTERS,
	SCHEMD_OUTPUT_MODES,
	type SchemdOutputMode
} from '@schemd/core';
import { json } from '@sveltejs/kit';
import { compileIsolated } from '$lib/server/compiler-pool';
import { interactiveSchematicSvg } from '$lib/server/interactive-svg';
import type { RequestHandler } from './$types';

const MAX_REQUEST_BYTES = MAX_SCHEMATIC_SOURCE_CHARACTERS * 4 + 4_096;
const BOUNDS_PATTERN = /^([1-9]\d{1,3})x([1-9]\d{1,3})$/u;
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 520;
const DEFAULT_TITLE = 'Engineering schematic';

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function outputMode(value: unknown): SchemdOutputMode | undefined {
	if (typeof value !== 'string') return undefined;
	for (const mode of SCHEMD_OUTPUT_MODES) {
		if (value === mode) return mode;
	}
	return undefined;
}

function bounds(value: unknown): { readonly width: number; readonly height: number } | undefined {
	if (value === undefined) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
	if (typeof value !== 'string') return undefined;
	const match = value.match(BOUNDS_PATTERN);
	if (match === null) return undefined;
	const width = Number(match[1]);
	const height = Number(match[2]);
	if (
		!Number.isSafeInteger(width) ||
		!Number.isSafeInteger(height) ||
		width < 64 ||
		height < 64 ||
		width > 4096 ||
		height > 4096
	) {
		return undefined;
	}
	return { width, height };
}

async function requestPayload(request: Request): Promise<unknown> {
	const declaredLength = Number(request.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
		throw new RangeError('Compile request exceeds the request budget.');
	}
	if (request.body === null) return undefined;
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const read = await reader.read();
		if (read.done) break;
		total += read.value.byteLength;
		if (total > MAX_REQUEST_BYTES) {
			await reader.cancel('Compile request exceeds the request budget.');
			throw new RangeError('Compile request exceeds the request budget.');
		}
		chunks.push(read.value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
	const payload: unknown = JSON.parse(decoded);
	return payload;
}

function compileId(): string {
	return `api-${Date.now().toString(36)}-${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export const POST: RequestHandler = async ({ request, setHeaders }) => {
	setHeaders({
		'cache-control': 'no-store',
		'x-content-type-options': 'nosniff'
	});
	let payload: unknown;
	try {
		payload = await requestPayload(request);
	} catch (reason) {
		const tooLarge = reason instanceof RangeError;
		return json(
			{
				ok: false,
				error: tooLarge ? reason.message : 'Request body must be valid UTF-8 JSON.',
				line: null,
				diagnostic: {
					message: tooLarge ? reason.message : 'Request body must be valid UTF-8 JSON.',
					line: null
				}
			},
			{ status: tooLarge ? 413 : 400 }
		);
	}
	if (!isRecord(payload) || typeof payload.source !== 'string') {
		return json(
			{
				ok: false,
				error: 'Compile requests require a string source field.',
				line: null,
				diagnostic: { message: 'Compile requests require a string source field.', line: null }
			},
			{ status: 400 }
		);
	}
	if (payload.source.length > MAX_SCHEMATIC_SOURCE_CHARACTERS) {
		return json(
			{
				ok: false,
				error: `Source exceeds ${MAX_SCHEMATIC_SOURCE_CHARACTERS} characters.`,
				line: null,
				diagnostic: {
					message: `Source exceeds ${MAX_SCHEMATIC_SOURCE_CHARACTERS} characters.`,
					line: null
				}
			},
			{ status: 413 }
		);
	}
	const mode = payload.mode === undefined ? 'default' : outputMode(payload.mode);
	if (mode === undefined) {
		return json(
			{
				ok: false,
				error: 'Mode must be default, embedded-css, or full.',
				line: null,
				diagnostic: {
					message: 'Mode must be default, embedded-css, or full.',
					line: null
				}
			},
			{ status: 400 }
		);
	}
	const requestedBounds = bounds(payload.bounds);
	if (requestedBounds === undefined) {
		return json(
			{
				ok: false,
				error: 'Bounds must use WIDTHxHEIGHT with each dimension from 64 through 4096.',
				line: null,
				diagnostic: {
					message: 'Bounds must use WIDTHxHEIGHT with each dimension from 64 through 4096.',
					line: null
				}
			},
			{ status: 400 }
		);
	}
	const title = payload.title === undefined ? DEFAULT_TITLE : payload.title;
	if (typeof title !== 'string' || title.trim().length === 0 || title.length > 512) {
		return json(
			{
				ok: false,
				error: 'Title must be a non-empty string of at most 512 characters.',
				line: null,
				diagnostic: {
					message: 'Title must be a non-empty string of at most 512 characters.',
					line: null
				}
			},
			{ status: 400 }
		);
	}
	const startedAt = performance.now();
	const compilation = await compileIsolated({
		source: payload.source,
		bounds: requestedBounds,
		title,
		mode,
		idPrefix: compileId()
	});
	if (compilation.ok) {
		return json({
			ok: true,
			mode,
			svg: interactiveSchematicSvg(compilation.svg),
			metrics: compilation.metrics,
			durationMilliseconds: Math.max(0, performance.now() - startedAt)
		});
	}
	const status =
		compilation.kind === 'overloaded' ? 503 : compilation.kind === 'internal' ? 500 : 422;
	return json(
		{
			ok: false,
			mode,
			error: compilation.message,
			line: compilation.line,
			diagnostic: { message: compilation.message, line: compilation.line },
			durationMilliseconds: Math.max(0, performance.now() - startedAt)
		},
		{
			status,
			headers: compilation.kind === 'overloaded' ? { 'retry-after': '1' } : undefined
		}
	);
};
