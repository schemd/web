/** Small, dependency-free guards shared by public POST endpoints. */

export interface LimitedJsonSuccess {
	readonly ok: true;
	readonly value: unknown;
}

export interface LimitedJsonFailure {
	readonly ok: false;
	readonly status: 400 | 413 | 415;
	readonly message: string;
}

export type LimitedJsonResult = LimitedJsonSuccess | LimitedJsonFailure;

/** Parse JSON without allowing a chunked request to allocate an unbounded body. */
export async function readLimitedJson(
	request: Request,
	maxBytes: number
): Promise<LimitedJsonResult> {
	const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
	if (contentType !== 'application/json') {
		return { ok: false, status: 415, message: 'Content-Type must be application/json.' };
	}

	const declared = Number(request.headers.get('content-length'));
	if (Number.isFinite(declared) && declared > maxBytes) {
		return { ok: false, status: 413, message: 'Request body is too large.' };
	}
	if (!request.body) return { ok: false, status: 400, message: 'Request body is required.' };

	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let bytes = 0;
	try {
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			bytes += value.byteLength;
			if (bytes > maxBytes) {
				await reader.cancel();
				return { ok: false, status: 413, message: 'Request body is too large.' };
			}
			chunks.push(value);
		}

		const joined = new Uint8Array(bytes);
		let offset = 0;
		for (const chunk of chunks) {
			joined.set(chunk, offset);
			offset += chunk.byteLength;
		}
		const text = new TextDecoder('utf-8', { fatal: true }).decode(joined);
		return { ok: true, value: JSON.parse(text) as unknown };
	} catch {
		return { ok: false, status: 400, message: 'Malformed JSON request.' };
	} finally {
		reader.releaseLock();
	}
}

interface Bucket {
	tokens: number;
	updatedAt: number;
}

export interface RatePolicy {
	readonly capacity: number;
	readonly refillPerSecond: number;
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 4_096;

/** Process-local token bucket. Upstream limits remain authoritative in a cluster. */
export function consumeRateLimit(
	namespace: string,
	client: string,
	policy: RatePolicy,
	now = Date.now()
): { readonly allowed: boolean; readonly retryAfterSeconds: number } {
	const key = `${namespace}\0${client}`;
	const previous = buckets.get(key) ?? { tokens: policy.capacity, updatedAt: now };
	const elapsedSeconds = Math.max(0, now - previous.updatedAt) / 1_000;
	const available = Math.min(
		policy.capacity,
		previous.tokens + elapsedSeconds * policy.refillPerSecond
	);
	const allowed = available >= 1;
	buckets.set(key, { tokens: allowed ? available - 1 : available, updatedAt: now });

	if (buckets.size > MAX_BUCKETS) {
		const oldest = buckets.keys().next().value;
		if (oldest !== undefined) buckets.delete(oldest);
	}

	return {
		allowed,
		retryAfterSeconds: allowed
			? 0
			: Math.max(1, Math.ceil((1 - available) / policy.refillPerSecond))
	};
}

/** Stable fallback for adapters that cannot expose a client address locally. */
export function clientAddress(getClientAddress: () => string): string {
	try {
		return getClientAddress();
	} catch {
		return 'unknown';
	}
}
