import { describe, expect, test } from 'vitest';
import { consumeRateLimit, readLimitedJson } from './request-guard';

describe('public request guards', () => {
	test('rejects the wrong media type and declared oversized bodies', async () => {
		const text = await readLimitedJson(
			new Request('https://test', { method: 'POST', body: '{}' }),
			32
		);
		expect(text).toMatchObject({ ok: false, status: 415 });

		const oversized = await readLimitedJson(
			new Request('https://test', {
				method: 'POST',
				headers: { 'content-type': 'application/json', 'content-length': '33' },
				body: '{}'
			}),
			32
		);
		expect(oversized).toMatchObject({ ok: false, status: 413 });
	});

	test('stops chunked bodies at the byte ceiling and parses valid JSON', async () => {
		const valid = await readLimitedJson(
			new Request('https://test', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{"ok":true}'
			}),
			32
		);
		expect(valid).toEqual({ ok: true, value: { ok: true } });

		const streamed = new ReadableStream<Uint8Array>({
			start(controller) {
				controller.enqueue(new TextEncoder().encode('{"payload":"'));
				controller.enqueue(new TextEncoder().encode('x'.repeat(64)));
				controller.enqueue(new TextEncoder().encode('"}'));
				controller.close();
			}
		});
		const tooLarge = await readLimitedJson(
			new Request('https://test', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: streamed,
				duplex: 'half'
			} as RequestInit),
			32
		);
		expect(tooLarge).toMatchObject({ ok: false, status: 413 });
	});

	test('refills token buckets deterministically', () => {
		const policy = { capacity: 2, refillPerSecond: 1 };
		expect(consumeRateLimit('test', 'client-a', policy, 1_000).allowed).toBe(true);
		expect(consumeRateLimit('test', 'client-a', policy, 1_000).allowed).toBe(true);
		expect(consumeRateLimit('test', 'client-a', policy, 1_000).allowed).toBe(false);
		expect(consumeRateLimit('test', 'client-a', policy, 2_000).allowed).toBe(true);
	});
});
