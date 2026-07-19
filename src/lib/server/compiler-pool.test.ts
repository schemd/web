import { describe, expect, test } from 'vitest';
import { COMPILER_POOL_LIMITS, compileIsolated } from './compiler-pool';

describe('isolated compiler pool', () => {
	test('compiles semantic SVG outside the request event loop', async () => {
		const result = await compileIsolated({
			source: `port:A "A" at (80, 120) #blue
port:B "B" at (360, 120) #emerald
A.out -> B.in #blue [ortho]`,
			bounds: { width: 440, height: 240 },
			title: 'Worker contract',
			mode: 'full',
			idPrefix: 'worker-contract'
		});
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.metrics.components).toBe(2);
			expect(result.svg).toContain('data-node-id="A"');
		}
	});

	test('returns located compiler diagnostics without killing the worker', async () => {
		const result = await compileIsolated({
			source: 'this is not schemd',
			bounds: { width: 440, height: 240 },
			title: 'Worker diagnostic',
			mode: 'default',
			idPrefix: 'worker-diagnostic'
		});
		expect(result).toMatchObject({ ok: false, kind: 'syntax', line: 1 });
		expect(COMPILER_POOL_LIMITS.workers).toBeGreaterThanOrEqual(1);
		expect(COMPILER_POOL_LIMITS.maxQueued).toBe(8);
	});
});
