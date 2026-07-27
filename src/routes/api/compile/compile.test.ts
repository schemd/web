import { describe, expect, it, vi } from 'vitest';
import type { SchematicLimitOptions } from '@schemd/core';
import {
	HOST_COMPILER_LIMITS,
	type CompileRequest as CompileRequestPayload
} from '$lib/compile-contract';
import { _compileCacheSnapshot, _createCompileHandler } from './+server';

function compileRequest(title: string): Request {
	return new Request('https://schemd.test/api/compile', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			source: 'port:A "A" at (80, 80) #blue',
			width: 320,
			height: 180,
			title,
			mode: 'full'
		})
	});
}

async function invoke(
	handler: ReturnType<typeof _createCompileHandler>,
	request: Request,
	client: string
): Promise<Response> {
	return (await handler({
		request,
		getClientAddress: () => client
	} as never)) as Response;
}

const success = {
	kind: 'complete' as const,
	outcome: {
		ok: true as const,
		svg: '<div data-schematic><svg></svg></div>',
		metrics: {
			sourceCharacters: 32,
			components: 1,
			connections: 0,
			svgBytes: 42
		},
		sourceMap: { nodes: [{ id: 'A', line: 1 }], wires: [] },
		ms: 0.2
	}
};

describe('POST /api/compile', () => {
	it('passes strict 0.4 host limits and serves repeat requests from the LRU', async () => {
		const run = vi.fn(async (request: CompileRequestPayload, limits: SchematicLimitOptions) => {
			void request;
			void limits;
			return success;
		});
		const handler = _createCompileHandler({ run });
		const title = `cache-${Date.now()}-${Math.random()}`;

		const first = await invoke(handler, compileRequest(title), 'compile-cache-test');
		expect(first.status).toBe(200);
		expect(first.headers.get('server-timing')).toContain('desc="compile"');
		expect(await first.json()).toMatchObject({ ok: true, metrics: { components: 1 } });
		expect(run).toHaveBeenCalledTimes(1);
		expect(run.mock.calls[0]?.[1]).toEqual(HOST_COMPILER_LIMITS);

		const second = await invoke(handler, compileRequest(title), 'compile-cache-test');
		expect(second.status).toBe(200);
		expect(second.headers.get('server-timing')).toContain('desc="cache"');
		expect(run).toHaveBeenCalledTimes(1);
	});

	it('coalesces concurrent identical misses and accounts one cache entry', async () => {
		const completions: Array<() => void> = [];
		const run = vi.fn(
			(request: CompileRequestPayload, limits: SchematicLimitOptions) =>
				new Promise<typeof success>((resolve) => {
					void request;
					void limits;
					completions.push(() => resolve(success));
				})
		);
		const handler = _createCompileHandler({ run });
		const title = `concurrent-${Date.now()}-${Math.random()}`;
		const before = _compileCacheSnapshot();
		const first = invoke(handler, compileRequest(title), 'compile-race-a');
		const second = invoke(handler, compileRequest(title), 'compile-race-b');
		await vi.waitFor(() => expect(completions).toHaveLength(1));
		for (const complete of completions) complete();
		expect((await first).status).toBe(200);
		expect((await second).status).toBe(200);
		expect(run).toHaveBeenCalledTimes(1);
		const after = _compileCacheSnapshot();
		expect(after.entries).toBe(before.entries + 1);
		expect(after.bytes - before.bytes).toBe(Buffer.byteLength(JSON.stringify(success.outcome)));
	});

	it.each([
		['timeout', 'Compilation exceeded', 'timeout'],
		['busy', 'Compiler is at capacity', 'busy']
	] as const)('maps %s isolation outcomes to retryable 503 responses', async (_, message, kind) => {
		const handler = _createCompileHandler({ run: async () => ({ kind }) });
		const response = await invoke(
			handler,
			compileRequest(`${kind}-${Date.now()}-${Math.random()}`),
			`compile-${kind}-test`
		);
		expect(response.status).toBe(503);
		expect(response.headers.get('retry-after')).toBe('1');
		expect(response.headers.get('cache-control')).toBe('no-store');
		expect(await response.json()).toMatchObject({
			ok: false,
			message: expect.stringContaining(message)
		});
	});

	it('maps a worker crash to 500 without leaking internals', async () => {
		const handler = _createCompileHandler({ run: async () => ({ kind: 'failed' }) });
		const response = await invoke(
			handler,
			compileRequest(`failed-${Date.now()}-${Math.random()}`),
			'compile-failed-test'
		);
		expect(response.status).toBe(500);
		expect(await response.json()).toMatchObject({
			ok: false,
			message: 'Compilation failed unexpectedly.'
		});
	});

	it('contains an unexpectedly rejected runner promise as an opaque 500', async () => {
		const handler = _createCompileHandler({
			run: async () => {
				throw new Error('sensitive worker detail');
			}
		});
		const response = await invoke(
			handler,
			compileRequest(`rejected-${Date.now()}-${Math.random()}`),
			'compile-rejected-test'
		);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			ok: false,
			message: 'Compilation failed unexpectedly.'
		});
	});

	it('rejects malformed input before scheduling a worker', async () => {
		const run = vi.fn(async (request: CompileRequestPayload, limits: SchematicLimitOptions) => {
			void request;
			void limits;
			return success;
		});
		const handler = _createCompileHandler({ run });
		const response = await invoke(
			handler,
			new Request('https://schemd.test/api/compile', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: '{"source":42}'
			}),
			'compile-malformed-test'
		);
		expect(response.status).toBe(400);
		expect(run).not.toHaveBeenCalled();
	});
});
