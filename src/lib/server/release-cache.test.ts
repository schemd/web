import { afterEach, describe, expect, it, vi } from 'vitest';
import { createReleaseRegistryCache, getCachedReleaseRegistry } from './release-cache';
import type { ReleaseRegistrySnapshot } from './release-registry';

const networkSnapshot: ReleaseRegistrySnapshot = {
	registryLatest: '0.2.1',
	supportedLatest: '0.2.1',
	source: 'network',
	releases: []
};

const fallbackSnapshot: ReleaseRegistrySnapshot = {
	registryLatest: '0.2.1',
	supportedLatest: '0.2.1',
	source: 'verified-fallback',
	releases: []
};

function options(now: () => number, initialSnapshot?: ReleaseRegistrySnapshot) {
	return {
		freshMilliseconds: 100,
		staleMilliseconds: 1_000,
		retryMilliseconds: 20,
		now,
		...(initialSnapshot === undefined ? {} : { initialSnapshot })
	};
}

describe('process release registry cache', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('deduplicates a cold refresh and serves the result as fresh', async () => {
		let currentTime = 1_000;
		let resolveLoad: ((snapshot: ReleaseRegistrySnapshot) => void) | undefined;
		const load = vi.fn(
			() =>
				new Promise<ReleaseRegistrySnapshot>((resolve) => {
					resolveLoad = resolve;
				})
		);
		const cache = createReleaseRegistryCache(
			load,
			options(() => currentTime)
		);
		const first = cache.get();
		const second = cache.get();
		expect(load).toHaveBeenCalledTimes(1);
		resolveLoad?.(networkSnapshot);
		expect((await first).cache.state).toBe('refreshed');
		expect((await second).cache.state).toBe('refreshed');
		currentTime = 1_050;
		const fresh = await cache.get();
		expect(fresh.cache.state).toBe('fresh');
		expect(fresh.cache.cachedAt).toBe('1970-01-01T00:00:01.000Z');
	});

	it('serves stale data immediately while one background refresh runs', async () => {
		let currentTime = 1_000;
		let resolveLoad: ((snapshot: ReleaseRegistrySnapshot) => void) | undefined;
		const load = vi.fn(
			() =>
				new Promise<ReleaseRegistrySnapshot>((resolve) => {
					resolveLoad = resolve;
				})
		);
		const cache = createReleaseRegistryCache(
			load,
			options(() => currentTime, fallbackSnapshot)
		);
		const stale = await cache.get();
		expect(stale.cache.state).toBe('stale');
		expect(load).toHaveBeenCalledTimes(1);
		expect((await cache.get()).cache.state).toBe('stale');
		expect(load).toHaveBeenCalledTimes(1);
		currentTime = 1_010;
		resolveLoad?.(networkSnapshot);
		await Promise.resolve();
		await Promise.resolve();
		expect((await cache.get()).cache.state).toBe('fresh');
	});

	it('retains the last network result when a refresh falls back or throws', async () => {
		let currentTime = 1_000;
		const load = vi
			.fn<() => Promise<ReleaseRegistrySnapshot>>()
			.mockResolvedValueOnce(networkSnapshot)
			.mockResolvedValueOnce(fallbackSnapshot)
			.mockRejectedValueOnce(new Error('offline'));
		const cache = createReleaseRegistryCache(
			load,
			options(() => currentTime)
		);
		expect((await cache.get()).cache.state).toBe('refreshed');
		currentTime = 1_101;
		expect((await cache.get()).cache.state).toBe('stale');
		await Promise.resolve();
		await Promise.resolve();
		expect((await cache.get()).source).toBe('network');
		currentTime = 1_122;
		expect((await cache.get()).cache.state).toBe('stale');
		await Promise.resolve();
		await Promise.resolve();
		expect((await cache.get()).source).toBe('network');
	});

	it('uses a bounded verified fallback after an initial loader failure', async () => {
		let currentTime = 1_000;
		const cache = createReleaseRegistryCache(
			vi.fn().mockRejectedValue(new Error('offline')),
			options(() => currentTime)
		);
		const fallback = await cache.get();
		expect(fallback.source).toBe('verified-fallback');
		expect(fallback.cache.state).toBe('fallback');
		currentTime = 1_010;
		expect((await cache.get()).cache.state).toBe('fresh');
	});

	it('caches a resolved fallback and exposes the process singleton', async () => {
		let currentTime = 1_000;
		const cache = createReleaseRegistryCache(
			vi.fn().mockResolvedValue(fallbackSnapshot),
			options(() => currentTime)
		);
		const fallback = await cache.get();
		expect(fallback.cache.state).toBe('fallback');
		currentTime = 1_010;
		expect((await cache.get()).cache.state).toBe('fresh');

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
		expect((await getCachedReleaseRegistry()).cache.state).toBe('stale');
		await Promise.resolve();
		await Promise.resolve();
	});

	it('waits for a refresh after the stale retention window', async () => {
		let currentTime = 1_000;
		const load = vi.fn().mockResolvedValue(networkSnapshot);
		const cache = createReleaseRegistryCache(
			load,
			options(() => currentTime)
		);
		await cache.get();
		currentTime = 2_101;
		const refreshed = await cache.get();
		expect(refreshed.cache.state).toBe('refreshed');
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('rejects invalid cache durations', () => {
		const load = vi.fn().mockResolvedValue(networkSnapshot);
		expect(() =>
			createReleaseRegistryCache(load, {
				...options(Date.now),
				freshMilliseconds: 0
			})
		).toThrowError('freshMilliseconds');
		expect(() =>
			createReleaseRegistryCache(load, {
				...options(Date.now),
				staleMilliseconds: 1.2
			})
		).toThrowError('staleMilliseconds');
		expect(() =>
			createReleaseRegistryCache(load, {
				...options(Date.now),
				retryMilliseconds: Number.MAX_VALUE
			})
		).toThrowError('retryMilliseconds');
	});
});
