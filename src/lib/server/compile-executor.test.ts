import { describe, expect, it } from 'vitest';
import { HOST_COMPILER_LIMITS, type CompileRequest } from '$lib/compile-contract';
import { CompileExecutor } from './compile-executor';

const request = (source: string): CompileRequest => ({
	source,
	width: 320,
	height: 180,
	title: 'Worker test',
	mode: 'full'
});

describe('isolated compile executor', () => {
	it('compiles in an isolated worker and preserves structured source maps', async () => {
		const executor = new CompileExecutor({ concurrency: 1, deadlineMs: 1_000, maxQueue: 1 });
		const result = await executor.run(
			request('port:A "A" at (80, 80) #blue'),
			HOST_COMPILER_LIMITS
		);
		expect(result.kind).toBe('complete');
		if (result.kind !== 'complete') return;
		expect(result.outcome.ok).toBe(true);
		if (!result.outcome.ok) return;
		expect(result.outcome.svg).toContain('data-node-id="A"');
		expect(result.outcome.sourceMap.nodes).toContainEqual({ id: 'A', line: 1 });
	});

	it('returns line-numbered syntax failures without crashing the worker boundary', async () => {
		const executor = new CompileExecutor({ deadlineMs: 1_000 });
		const result = await executor.run(request('not valid'), HOST_COMPILER_LIMITS);
		expect(result.kind).toBe('complete');
		if (result.kind !== 'complete') return;
		expect(result.outcome).toMatchObject({ ok: false, line: 1 });
	});

	it('applies caller limits inside the worker', async () => {
		const executor = new CompileExecutor({ deadlineMs: 1_000 });
		const result = await executor.run(
			request('port:A "A" at (80, 60) #blue\nport:B "B" at (240, 120) #cyan'),
			{ ...HOST_COMPILER_LIMITS, components: 1 }
		);
		expect(result.kind).toBe('complete');
		if (result.kind !== 'complete') return;
		expect(result.outcome).toMatchObject({
			ok: false,
			line: 2,
			message: expect.stringMatching(/component|limit|budget/i)
		});
	});

	it('terminates work at the real deadline and rejects overflow beyond the bounded queue', async () => {
		const timeoutExecutor = new CompileExecutor({ concurrency: 1, deadlineMs: 1, maxQueue: 0 });
		await expect(
			timeoutExecutor.run(request('port:A "A" at (80, 80)'), HOST_COMPILER_LIMITS)
		).resolves.toEqual({ kind: 'timeout' });

		const bounded = new CompileExecutor({ concurrency: 1, deadlineMs: 1_000, maxQueue: 0 });
		const first = bounded.run(request('port:A "A" at (80, 80)'), HOST_COMPILER_LIMITS);
		await expect(
			bounded.run(request('port:B "B" at (80, 80)'), HOST_COMPILER_LIMITS)
		).resolves.toEqual({ kind: 'busy' });
		await expect(first).resolves.toMatchObject({ kind: 'complete' });
	});

	it('opens a circuit after bounded bootstrap failures instead of respawning forever', async () => {
		const executor = new CompileExecutor({
			concurrency: 1,
			deadlineMs: 1_000,
			maxQueue: 1,
			coreModuleUrl: 'file:///definitely-missing-schemd-core.js'
		});
		await expect(
			executor.run(request('port:A "A" at (80, 80) #blue'), HOST_COMPILER_LIMITS)
		).resolves.toEqual({ kind: 'failed' });
		const started = performance.now();
		await expect(
			executor.run(request('port:B "B" at (80, 80) #blue'), HOST_COMPILER_LIMITS)
		).resolves.toEqual({ kind: 'failed' });
		expect(performance.now() - started).toBeLessThan(50);
	});
});
