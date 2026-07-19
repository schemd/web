import {
	fetchReleaseRegistry,
	releaseSnapshot,
	type ReleaseRegistrySnapshot
} from './release-registry';

export type ReleaseCacheState = 'fresh' | 'refreshed' | 'stale' | 'fallback';

export interface CachedReleaseRegistrySnapshot extends ReleaseRegistrySnapshot {
	readonly cache: {
		readonly state: ReleaseCacheState;
		readonly cachedAt: string;
		readonly expiresAt: string;
	};
}

interface CacheEntry {
	readonly snapshot: ReleaseRegistrySnapshot;
	readonly cachedAt: number;
	readonly expiresAt: number;
	readonly staleUntil: number;
}

export interface ReleaseRegistryCacheOptions {
	readonly freshMilliseconds: number;
	readonly staleMilliseconds: number;
	readonly retryMilliseconds: number;
	readonly now: () => number;
	readonly initialSnapshot?: ReleaseRegistrySnapshot;
}

export interface ReleaseRegistryCache {
	get(): Promise<CachedReleaseRegistrySnapshot>;
}

const FIFTEEN_MINUTES = 15 * 60 * 1_000;
const ONE_DAY = 24 * 60 * 60 * 1_000;
const ONE_MINUTE = 60 * 1_000;

function assertDuration(value: number, name: string): void {
	if (!Number.isSafeInteger(value) || value < 1)
		throw new RangeError(`${name} must be a positive integer.`);
}

function decorate(entry: CacheEntry, state: ReleaseCacheState): CachedReleaseRegistrySnapshot {
	return {
		...entry.snapshot,
		cache: {
			state,
			cachedAt: new Date(entry.cachedAt).toISOString(),
			expiresAt: new Date(entry.expiresAt).toISOString()
		}
	};
}

export function createReleaseRegistryCache(
	load: () => Promise<ReleaseRegistrySnapshot>,
	options: ReleaseRegistryCacheOptions
): ReleaseRegistryCache {
	assertDuration(options.freshMilliseconds, 'freshMilliseconds');
	assertDuration(options.staleMilliseconds, 'staleMilliseconds');
	assertDuration(options.retryMilliseconds, 'retryMilliseconds');

	const initialTime = options.now();
	let entry: CacheEntry | undefined =
		options.initialSnapshot === undefined
			? undefined
			: {
					snapshot: options.initialSnapshot,
					cachedAt: initialTime,
					expiresAt: initialTime - 1,
					staleUntil: Number.MAX_SAFE_INTEGER
				};
	let refreshPromise: Promise<CachedReleaseRegistrySnapshot> | undefined;

	async function refresh(): Promise<CachedReleaseRegistrySnapshot> {
		const previous = entry;
		try {
			const snapshot = await load();
			const refreshedAt = options.now();
			if (snapshot.source === 'verified-fallback' && previous?.snapshot.source === 'network') {
				entry = {
					...previous,
					expiresAt: refreshedAt + options.retryMilliseconds,
					staleUntil: refreshedAt + options.staleMilliseconds
				};
				return decorate(entry, 'stale');
			}
			entry = {
				snapshot,
				cachedAt: refreshedAt,
				expiresAt:
					refreshedAt +
					(snapshot.source === 'network' ? options.freshMilliseconds : options.retryMilliseconds),
				staleUntil: refreshedAt + options.staleMilliseconds
			};
			return decorate(entry, snapshot.source === 'network' ? 'refreshed' : 'fallback');
		} catch {
			if (previous) {
				const failedAt = options.now();
				entry = {
					...previous,
					expiresAt: failedAt + options.retryMilliseconds,
					staleUntil: Math.max(previous.staleUntil, failedAt + options.retryMilliseconds)
				};
				return decorate(entry, 'stale');
			}
			const failedAt = options.now();
			entry = {
				snapshot: releaseSnapshot(undefined, undefined),
				cachedAt: failedAt,
				expiresAt: failedAt + options.retryMilliseconds,
				staleUntil: failedAt + options.staleMilliseconds
			};
			return decorate(entry, 'fallback');
		}
	}

	function startRefresh(): Promise<CachedReleaseRegistrySnapshot> {
		if (refreshPromise) return refreshPromise;
		const pending = refresh();
		refreshPromise = pending;
		void pending.then(() => {
			refreshPromise = undefined;
		});
		return pending;
	}

	return {
		async get(): Promise<CachedReleaseRegistrySnapshot> {
			const currentTime = options.now();
			if (!entry) return startRefresh();
			if (currentTime < entry.expiresAt) return decorate(entry, 'fresh');
			if (currentTime <= entry.staleUntil) {
				void startRefresh();
				return decorate(entry, 'stale');
			}
			return startRefresh();
		}
	};
}

const verifiedSnapshot = releaseSnapshot(undefined, undefined);

const processReleaseRegistry = createReleaseRegistryCache(fetchReleaseRegistry, {
	freshMilliseconds: FIFTEEN_MINUTES,
	staleMilliseconds: ONE_DAY,
	retryMilliseconds: ONE_MINUTE,
	now: Date.now,
	initialSnapshot: verifiedSnapshot
});

export function getCachedReleaseRegistry(): Promise<CachedReleaseRegistrySnapshot> {
	return processReleaseRegistry.get();
}
