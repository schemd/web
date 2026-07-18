import { afterEach, describe, expect, it, vi } from 'vitest';
import { RELEASES } from './content/releases';
import type { CompilerWorkerRequest } from './playground/protocol';
import { createVersionWorker } from './playground/workers';
import { simulationPageData } from './server/simulations';

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('runtime boundary glue', () => {
	it('constructs the selected version worker lazily', async () => {
		class FakeWorker {
			constructor(
				readonly url: string | URL,
				readonly options?: WorkerOptions
			) {}
		}
		vi.stubGlobal('Worker', FakeWorker);
		const worker = await createVersionWorker('v0.2.1');
		expect(worker).toBeInstanceOf(FakeWorker);
	});

	it('posts ready, ignores invalid messages, and returns worker success and errors', async () => {
		const postMessage = vi.fn();
		let listener: ((event: MessageEvent<unknown>) => void) | undefined;
		vi.stubGlobal('postMessage', postMessage);
		vi.stubGlobal(
			'addEventListener',
			(_type: string, callback: (event: MessageEvent<unknown>) => void) => {
				listener = callback;
			}
		);
		await import('./playground/workers/v0.2.1.worker');
		expect(postMessage).toHaveBeenCalledWith({ kind: 'ready' });
		if (!listener) throw new Error('Expected worker message listener.');
		listener(new MessageEvent('message', { data: { kind: 'ignore' } }));
		expect(postMessage).toHaveBeenCalledTimes(1);
		const valid: CompilerWorkerRequest = {
			kind: 'compile',
			id: 4,
			version: 'v0.2.1',
			source: 'port:A "A" at (80, 80) #blue',
			fence: 'schemd bounds="160x160" title="A"'
		};
		listener(new MessageEvent('message', { data: valid }));
		expect(postMessage).toHaveBeenLastCalledWith(
			expect.objectContaining({ kind: 'success', id: 4 })
		);
		listener(new MessageEvent('message', { data: { ...valid, id: 5, source: 'bad' } }));
		expect(postMessage).toHaveBeenLastCalledWith(expect.objectContaining({ kind: 'error', id: 5 }));
	});

	it('compiles simulation data and rejects unavailable versions and simulations', () => {
		const data = simulationPageData('v0.2.1', 'rc-low-pass');
		expect(data.svg).toContain('<svg');
		expect(data.definition.id).toBe('rc-low-pass');
		expect(() => simulationPageData('v9.0.0', 'rc-low-pass')).toThrow();
		expect(() => simulationPageData('v0.2.1', 'missing')).toThrow();
	});

	it('keeps verified release history ordered', () => {
		expect(RELEASES.map((release) => release.version)).toEqual([
			'v0.2.1',
			'v0.2.0',
			'v0.1.2',
			'v0.1.1',
			'v0.1.0'
		]);
	});
});
