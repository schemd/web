/**
 * Design-rule checking as a service.
 *
 * The conformance page proves the rules on this site's own corpus; this lets
 * any project run the same check on its own diagrams — in CI, in a pre-commit
 * hook, or from an editor — without installing the compiler. Same rules, same
 * codes, same severities as `@schemd/core` ships.
 *
 * The endpoint is stateless: it parses, inspects, and forgets. Nothing is
 * stored and no source leaves this process.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	clientAddress,
	consumeRateLimit,
	NO_STORE,
	rateLimitHeaders,
	readLimitedJson
} from '$lib/server/request-guard';
import {
	inspectSchematic,
	parseSchematic,
	parseSchematicFence,
	SCHEMATIC_RULES,
	SchematicSyntaxError,
	type SchematicDiagnostic
} from '@schemd/core';

/** Mirrors `/api/compile`: JSON escaping can nearly double a valid payload. */
const MAX_REQUEST_BYTES = 280 * 1024;
const MAX_SOURCE_CHARACTERS = 131_072;
const MIN_DIMENSION = 64;
const MAX_DIMENSION = 4096;

interface VerifyRequest {
	readonly source: string;
	readonly width: number;
	readonly height: number;
	readonly title: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function parseRequest(body: unknown): VerifyRequest | undefined {
	if (!isRecord(body)) return undefined;
	const { source, width = 960, height = 540, title = 'Verified schematic' } = body;
	if (typeof source !== 'string' || source.length === 0) return undefined;
	if (source.length > MAX_SOURCE_CHARACTERS) return undefined;
	if (typeof width !== 'number' || typeof height !== 'number') return undefined;
	if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
	if (width < MIN_DIMENSION || width > MAX_DIMENSION) return undefined;
	if (height < MIN_DIMENSION || height > MAX_DIMENSION) return undefined;
	if (typeof title !== 'string' || title.length > 512) return undefined;
	return {
		source,
		width: Math.trunc(width),
		height: Math.trunc(height),
		title: title.replace(/"/g, '').trim() || 'Verified schematic'
	};
}

/** `ok` answers the only question CI asks: may this build proceed? */
function verdict(diagnostics: readonly SchematicDiagnostic[]) {
	const errors = diagnostics.filter((entry) => entry.severity === 'error').length;
	const warnings = diagnostics.filter((entry) => entry.severity === 'warning').length;
	return {
		ok: errors === 0,
		counts: { errors, warnings, notes: diagnostics.length - errors - warnings }
	};
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const rate = consumeRateLimit('verify', clientAddress(getClientAddress), {
		capacity: 60,
		refillPerSecond: 2
	});
	if (!rate.allowed) {
		return json(
			{ ok: false, error: 'rate-limited', message: 'Verification rate limit exceeded.' },
			{
				status: 429,
				headers: rateLimitHeaders(rate.retryAfterSeconds)
			}
		);
	}

	const body = await readLimitedJson(request, MAX_REQUEST_BYTES);
	if (!body.ok) {
		return json(
			{ ok: false, error: 'malformed', message: body.message },
			{ status: body.status, headers: NO_STORE }
		);
	}
	const parsed = parseRequest(body.value);
	if (!parsed) {
		return json(
			{ ok: false, error: 'malformed', message: 'Malformed verify request.' },
			{ status: 400, headers: NO_STORE }
		);
	}

	try {
		const fence = parseSchematicFence(
			`schemd bounds="${parsed.width}x${parsed.height}" title="${parsed.title}"`
		);
		if (!fence) throw new SchematicSyntaxError('Unreachable: canonical fence.');
		const { netlist, diagnostics } = inspectSchematic(parseSchematic(parsed.source, fence));
		return json(
			{
				...verdict(diagnostics),
				diagnostics,
				netlist: {
					components: netlist.nodes.length,
					nets: netlist.nets.length,
					connections: netlist.edges.length
				},
				rules: SCHEMATIC_RULES
			},
			{ headers: NO_STORE }
		);
	} catch (failure) {
		/* A document that does not compile cannot be checked; say which line. */
		if (failure instanceof SchematicSyntaxError) {
			return json(
				{
					ok: false,
					error: 'compile',
					message: failure.message,
					line: failure.line,
					counts: { errors: 1, warnings: 0, notes: 0 },
					diagnostics: []
				},
				{ status: 422, headers: NO_STORE }
			);
		}
		return json(
			{ ok: false, error: 'internal', message: 'Verification failed unexpectedly.' },
			{ status: 500, headers: NO_STORE }
		);
	}
};
