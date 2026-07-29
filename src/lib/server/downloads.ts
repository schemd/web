/**
 * npm download telemetry.
 *
 * The registry publishes counts, not a feed, so "live" here means one poller
 * for the whole process rather than one per reader. `adapter-node` keeps this
 * module alive across requests, so a single timer refreshes the snapshot and
 * every connected live query observes the same object. Fifty readers cost npm
 * exactly what one reader costs.
 *
 * npm settles a day's counts hours after the day ends, so the numbers move in
 * steps, not continuously. The stream reflects that honestly: every poll is
 * emitted so the page can show how fresh its own reading is, but `revision`
 * only advances when a number actually moved. Nothing here animates a figure
 * that did not change.
 */

const POINT_URL = (period: string) =>
	`https://api.npmjs.org/downloads/point/${period}/@schemd/core`;
const RANGE_URL = (from: string, to: string) =>
	`https://api.npmjs.org/downloads/range/${from}:${to}/@schemd/core`;
const PER_VERSION_URL = 'https://api.npmjs.org/versions/@schemd%2Fcore/last-week';

const REFRESH_INTERVAL_MS = 60_000;
const FETCH_TIMEOUT_MS = 6_000;
/** Days of daily history the trend chart plots. */
export const HISTORY_DAYS = 30;

/** One day of the daily series. */
export interface DownloadDay {
	readonly day: string;
	readonly downloads: number;
}

/** Downloads attributed to one published release over the last week. */
export interface VersionShare {
	readonly version: string;
	readonly downloads: number;
}

/** Everything the downloads page renders, as one immutable snapshot. */
export interface DownloadSnapshot {
	readonly lastDay: number;
	readonly lastWeek: number;
	readonly lastMonth: number;
	/** Oldest first, exactly `HISTORY_DAYS` entries when npm cooperates. */
	readonly history: readonly DownloadDay[];
	/** Last week's counts per release, heaviest first. */
	readonly byVersion: readonly VersionShare[];
	/** Milliseconds since epoch of the last poll attempt, 0 when never polled. */
	readonly checkedAt: number;
	/** Whether the last poll reached the registry. */
	readonly live: boolean;
	/** Monotonic counter; a reader can tell a re-poll from a real change. */
	readonly revision: number;
}

const EMPTY: DownloadSnapshot = {
	lastDay: 0,
	lastWeek: 0,
	lastMonth: 0,
	history: [],
	byVersion: [],
	checkedAt: 0,
	live: false,
	revision: 0
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function asCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.trunc(value) : 0;
}

/** `YYYY-MM-DD` in UTC — npm's day boundaries are UTC, not the server's. */
export function isoDay(at: number): string {
	return new Date(at).toISOString().slice(0, 10);
}

async function fetchJson(url: string): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: { accept: 'application/json' }
		});
		if (!response.ok) throw new Error(`${url} responded ${response.status}`);
		return (await response.json()) as unknown;
	} finally {
		clearTimeout(timer);
	}
}

function parsePoint(payload: unknown): number {
	return isRecord(payload) ? asCount(payload['downloads']) : 0;
}

/** Normalize npm's daily series: oldest first, malformed days dropped. */
export function parseRange(payload: unknown): readonly DownloadDay[] {
	if (!isRecord(payload) || !Array.isArray(payload['downloads'])) return [];
	const days: DownloadDay[] = [];
	for (const entry of payload['downloads']) {
		if (!isRecord(entry)) continue;
		const day = entry['day'];
		if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
		days.push({ day, downloads: asCount(entry['downloads']) });
	}
	return days.sort((left, right) => left.day.localeCompare(right.day));
}

/** Per-release counts, heaviest first, zero-count releases dropped. */
export function parseVersions(payload: unknown): readonly VersionShare[] {
	if (!isRecord(payload) || !isRecord(payload['downloads'])) return [];
	return Object.entries(payload['downloads'])
		.map(([version, downloads]) => ({ version, downloads: asCount(downloads) }))
		.filter((entry) => entry.downloads > 0)
		.sort((left, right) => right.downloads - left.downloads);
}

/** Compare the parts a reader can see; the timestamp alone is not a change. */
function sameReading(left: DownloadSnapshot, right: DownloadSnapshot): boolean {
	return (
		left.lastDay === right.lastDay &&
		left.lastWeek === right.lastWeek &&
		left.lastMonth === right.lastMonth &&
		left.live === right.live &&
		left.history.length === right.history.length &&
		left.history.every(
			(day, index) =>
				day.day === right.history[index]?.day && day.downloads === right.history[index]?.downloads
		) &&
		left.byVersion.length === right.byVersion.length &&
		left.byVersion.every(
			(entry, index) =>
				entry.version === right.byVersion[index]?.version &&
				entry.downloads === right.byVersion[index]?.downloads
		)
	);
}

type Fetcher = (url: string) => Promise<unknown>;

export interface DownloadStore {
	/** The current snapshot, starting a poll if none has run yet. */
	read(): Promise<DownloadSnapshot>;
	/**
	 * Yield the current snapshot, then every subsequent one that differs.
	 * Ends when the caller stops iterating (a reader navigating away).
	 */
	watch(signal?: AbortSignal): AsyncGenerator<DownloadSnapshot>;
}

/**
 * Build the shared poller around an injected transport.
 *
 * The seam exists so tests can drive the polling loop deterministically
 * without reaching the network, exactly as the release registry does.
 */
export function createDownloadStore(
	fetcher: Fetcher = fetchJson,
	now: () => number = Date.now,
	intervalMs: number = REFRESH_INTERVAL_MS
): DownloadStore {
	let snapshot = EMPTY;
	let inFlight: Promise<DownloadSnapshot> | undefined;
	const waiters = new Set<() => void>();

	function publish(next: DownloadSnapshot): DownloadSnapshot {
		/* A poll that found nothing new must not wake every reader — but it did
		 * happen, so the check timestamp advances on the shared object. */
		snapshot = sameReading(snapshot, next)
			? { ...snapshot, checkedAt: next.checkedAt, live: next.live }
			: { ...next, revision: snapshot.revision + 1 };
		for (const wake of waiters) wake();
		return snapshot;
	}

	async function poll(): Promise<DownloadSnapshot> {
		const at = now();
		try {
			const to = isoDay(at);
			const from = isoDay(at - (HISTORY_DAYS - 1) * 86_400_000);
			const [day, week, month, range, versions] = await Promise.all([
				fetcher(POINT_URL('last-day')),
				fetcher(POINT_URL('last-week')),
				fetcher(POINT_URL('last-month')),
				fetcher(RANGE_URL(from, to)).catch(() => undefined),
				fetcher(PER_VERSION_URL).catch(() => undefined)
			]);
			return publish({
				lastDay: parsePoint(day),
				lastWeek: parsePoint(week),
				lastMonth: parsePoint(month),
				history: parseRange(range),
				byVersion: parseVersions(versions),
				checkedAt: at,
				live: true,
				revision: snapshot.revision
			});
		} catch {
			/* Keep serving the last good reading, but stop claiming it is live. */
			return publish({ ...snapshot, checkedAt: at, live: false });
		} finally {
			inFlight = undefined;
		}
	}

	function refreshIfStale(): Promise<DownloadSnapshot> {
		if (inFlight) return inFlight;
		if (snapshot.checkedAt !== 0 && now() - snapshot.checkedAt < intervalMs) {
			return Promise.resolve(snapshot);
		}
		inFlight = poll();
		return inFlight;
	}

	return {
		read: refreshIfStale,
		async *watch(signal?: AbortSignal): AsyncGenerator<DownloadSnapshot> {
			let seen = await refreshIfStale();
			yield seen;
			while (!signal?.aborted) {
				/* Wake on another reader's poll, on our own interval, or on the
				 * reader leaving — whichever lands first. Every registration is
				 * torn down on the way out, because this loop can run for as long
				 * as a tab stays open. */
				await new Promise<void>((resolve) => {
					let settled = false;
					const wake = (): void => {
						if (settled) return;
						settled = true;
						clearTimeout(timer);
						waiters.delete(wake);
						signal?.removeEventListener('abort', wake);
						resolve();
					};
					const timer = setTimeout(wake, intervalMs);
					waiters.add(wake);
					signal?.addEventListener('abort', wake, { once: true });
				});
				if (signal?.aborted) return;
				const next = await refreshIfStale();
				/* `publish` mints a new object per poll, so identity is the test:
				 * a fresh reading always reaches the reader, and `revision` tells
				 * it whether any number actually moved. */
				if (next !== seen) {
					seen = next;
					yield seen;
				}
			}
		}
	};
}

/** Process-lifetime poller shared by every connected reader. */
export const downloadStore = createDownloadStore();
