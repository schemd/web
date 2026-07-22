import type { RequestHandler } from './$types';
import { clientAddress, consumeRateLimit, readLimitedJson } from '$lib/server/request-guard';
import type { InteractionName, TelemetryEvent, VitalName, VitalRating } from '$lib/telemetry';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_EVENTS = 20;
type Viewport = 'small' | 'medium' | 'large';
const VITALS = new Set<VitalName>(['CLS', 'INP', 'LCP', 'TTFB']);
const RATINGS = new Set<VitalRating>(['good', 'needs-improvement', 'poor']);
const VIEWPORTS = new Set<Viewport>(['small', 'medium', 'large']);
const INTERACTIONS = new Set<InteractionName>([
	'copy_embed',
	'copy_fence',
	'copy_install',
	'copy_share',
	'download_png',
	'download_svg'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function inSet<T extends string>(values: ReadonlySet<T>, value: unknown): value is T {
	return typeof value === 'string' && values.has(value as T);
}

function base(value: Record<string, unknown>): { at: number; path: string } | undefined {
	const at = value['at'];
	const path = value['path'];
	if (value['v'] !== 1 || typeof at !== 'number' || !Number.isFinite(at)) return undefined;
	if (typeof path !== 'string' || !path.startsWith('/') || path.length > 256) return undefined;
	if (path.includes('?') || path.includes('#')) return undefined;
	for (const character of path) {
		const code = character.charCodeAt(0);
		if (code < 32 || code === 127) return undefined;
	}
	return { at: Math.trunc(at), path };
}

/** Strictly rebuild events so unknown client fields never reach structured logs. */
export function _parseTelemetryBatch(value: unknown): readonly TelemetryEvent[] | undefined {
	if (!isRecord(value) || !Array.isArray(value['events'])) return undefined;
	if (value['events'].length === 0 || value['events'].length > MAX_EVENTS) return undefined;
	const events: TelemetryEvent[] = [];
	for (const candidate of value['events']) {
		if (!isRecord(candidate)) return undefined;
		const common = base(candidate);
		if (!common) return undefined;
		if (candidate['type'] === 'page_view' && inSet(VIEWPORTS, candidate['viewport'])) {
			events.push({
				v: 1,
				type: 'page_view',
				...common,
				viewport: candidate['viewport']
			});
		} else if (
			candidate['type'] === 'web_vital' &&
			inSet(VITALS, candidate['name']) &&
			inSet(RATINGS, candidate['rating']) &&
			typeof candidate['value'] === 'number' &&
			Number.isFinite(candidate['value']) &&
			candidate['value'] >= 0 &&
			candidate['value'] <= 60_000
		) {
			events.push({
				v: 1,
				type: 'web_vital',
				...common,
				name: candidate['name'],
				value: candidate['value'],
				rating: candidate['rating']
			});
		} else if (candidate['type'] === 'interaction' && inSet(INTERACTIONS, candidate['name'])) {
			events.push({
				v: 1,
				type: 'interaction',
				...common,
				name: candidate['name']
			});
		} else return undefined;
	}
	return events;
}

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const client = clientAddress(getClientAddress);
	const rate = consumeRateLimit('telemetry', client, { capacity: 40, refillPerSecond: 1 });
	if (!rate.allowed) {
		return new Response(null, {
			status: 429,
			headers: { 'cache-control': 'no-store', 'retry-after': String(rate.retryAfterSeconds) }
		});
	}

	const body = await readLimitedJson(request, MAX_BODY_BYTES);
	if (!body.ok) {
		return new Response(body.message, {
			status: body.status,
			headers: { 'cache-control': 'no-store' }
		});
	}
	const events = _parseTelemetryBatch(body.value);
	if (!events) {
		return new Response('Malformed telemetry batch.', {
			status: 400,
			headers: { 'cache-control': 'no-store' }
		});
	}

	console.info(JSON.stringify({ kind: 'schemd.telemetry.batch', receivedAt: Date.now(), events }));
	return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
};
