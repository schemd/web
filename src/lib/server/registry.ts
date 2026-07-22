/**
 * Node-powered registry sync engine.
 *
 * Because the site runs on `adapter-node`, this module lives for the whole
 * process. We exploit that: release data from the npm registry and the GitHub
 * API is aggregated into a persistent in-memory cache with a
 * stale-while-revalidate refresh loop, so no request ever blocks on the
 * network after first warm-up.
 */
import { building } from '$app/environment';
import { DOCUMENTED_VERSIONS } from './versions';

/** One published release aggregated from npm (and GitHub when reachable). */
export interface SchemdRelease {
	/** Exact semver string, e.g. `0.2.1`. */
	readonly version: string;
	/** ISO-8601 publish timestamp from the npm `time` map. */
	readonly publishedAt: string;
	/** Unpacked install footprint in bytes, when npm reports it. */
	readonly unpackedSize: number | undefined;
	/** Number of files in the published tarball, when npm reports it. */
	readonly fileCount: number | undefined;
	/** Abbreviated git head from npm's `gitHead` field, when present. */
	readonly gitHead: string | undefined;
	/** Release notes pulled from GitHub releases, when the API is reachable. */
	readonly notes: string | undefined;
	/** False only for the deterministic local-development release candidate. */
	readonly released: boolean;
}

/** Aggregated registry state shared by every route. */
export interface SchemdRegistry {
	/** Releases sorted newest-first. */
	readonly releases: readonly SchemdRelease[];
	/** The npm dist-tag `latest` version. */
	readonly latest: string;
	/** Milliseconds-since-epoch of the last successful sync, 0 when seeded. */
	readonly syncedAt: number;
	/** Whether the last refresh attempt reached the npm registry. */
	readonly live: boolean;
}

const NPM_PACKAGE_URL = 'https://registry.npmjs.org/@schemd/core';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/schemd/core/releases?per_page=50';
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 6_000;

/**
 * Seed data lets every route render deterministically before the first
 * network round-trip completes and when the registry is unreachable. The
 * version pinned here matches the workspace's installed `@schemd/core`.
 */
/**
 * Editorial notes per known release, shown on the changelog when the npm
 * registry is unreachable. Adding a release is one entry here; the newest key
 * becomes the site's installed-engine version and every seed derives from it.
 * Documentation lines are discovered separately from content folders.
 */
const RELEASE_NOTES: Readonly<Record<string, { unpackedSize?: number; notes?: string }>> = {
	'0.3.3': {
		notes:
			'CNOT is now an intrinsic two-track controlled-X gate: the control rail enters at `in1` and leaves unchanged at `out1`, while the target rail enters at `in2` and leaves at `out2`. The renderer preserves both quantum tracks through one compact symbol, the compiler rejects missing or oversubscribed rails, legacy `control`/`target` aliases remain accepted, and the website examples and simulation timelines use the canonical indexed ports.'
	},
	'0.3.2': {
		unpackedSize: 298_854,
		notes:
			'Net topology, universal collision rules, and overlap detection. Signal wires resolve to first-class nets (`net=NAME`, deterministic $N identities, one domain/width contract per net); same-net crossings stay continuous while separate nets bridge; straight, Bézier, and orthogonal routes share one collision policy with soft channel occupancy; physical overlap is rejected with source-line diagnostics; open markers are genuinely transparent; Chromium visual goldens, property fuzzing, and a mutation gate pin it all.'
	},
	'0.3.1': {
		unpackedSize: 260_610,
		notes:
			'Routing, fidelity, and accessibility patch. Dense sub-clearance layouts now route as straight traces instead of failing, empty qgate detail rows no longer inflate the shared quantum shell, and embedded-css output keeps hover-only groups out of the tab order under its role="img" root.'
	},
	'0.3.0': {
		unpackedSize: 258_900,
		notes:
			'Quarter-turn orientation geometry across every primitive, deterministic source maps for editor↔vector round-tripping, drift-free micro-math baselines, and expanded electrical, digital, quantum, and UML families.'
	},
	'0.2.1': {}
};

/** Every known release, newest first, derived from the editorial record. */
const KNOWN_RELEASE_VERSIONS: readonly string[] = Object.keys(RELEASE_NOTES).sort((a, b) =>
	compareVersionsDesc(a, b)
);

/** The release this deployment's installed `@schemd/core` engine executes. */
export const WEBSITE_CORE_VERSION = KNOWN_RELEASE_VERSIONS[0]!;
/** The oldest release kept alive for legacy playground/simulation deep links. */
export const HISTORICAL_CORE_VERSION = KNOWN_RELEASE_VERSIONS[KNOWN_RELEASE_VERSIONS.length - 1]!;
/** Documented docs lines (newest first), re-exported for route/test callers. */
export const DOCUMENTATION_VERSIONS: readonly string[] = DOCUMENTED_VERSIONS;

/**
 * Seed every known release so routes resolve offline. The newest is the local
 * release candidate (`released: false`) until npm confirms its publication.
 */
const SEED_RELEASES: readonly SchemdRelease[] = KNOWN_RELEASE_VERSIONS.map((version) => ({
	version,
	publishedAt: new Date(0).toISOString(),
	unpackedSize: RELEASE_NOTES[version]?.unpackedSize,
	fileCount: RELEASE_NOTES[version]?.unpackedSize === undefined ? undefined : 24,
	gitHead: undefined,
	notes: RELEASE_NOTES[version]?.notes,
	released: version !== KNOWN_RELEASE_VERSIONS[0]
}));

const SEED_REGISTRY: SchemdRegistry = {
	releases: [...SEED_RELEASES],
	latest: WEBSITE_CORE_VERSION,
	live: false,
	syncedAt: 0
};

/** Process-lifetime cache. `adapter-node` keeps this warm across requests. */
let cache: SchemdRegistry = SEED_REGISTRY;
let refreshInFlight: Promise<void> | undefined;
let lastAttemptAt = 0;

/** Narrow unknown JSON without type-casting bypasses. */
function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Fetch JSON with a hard timeout so a slow registry cannot stall requests. */
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

/** Compare semver strings numerically, newest first. */
export function compareVersionsDesc(a: string, b: string): number {
	const parse = (v: string): number[] => v.split(/[.-]/).map((part) => Number(part) || 0);
	const [aa, bb] = [parse(a), parse(b)];
	for (let index = 0; index < Math.max(aa.length, bb.length); index += 1) {
		const delta = (bb[index] ?? 0) - (aa[index] ?? 0);
		if (delta !== 0) return delta;
	}
	return 0;
}

/** Parse the npm packument plus optional GitHub notes into registry state. */
function buildRegistry(packument: unknown, githubReleases: unknown): SchemdRegistry | undefined {
	if (!isRecord(packument)) return undefined;
	const versions = isRecord(packument.versions) ? packument.versions : undefined;
	const time = isRecord(packument.time) ? packument.time : undefined;
	if (!versions || !time) return undefined;

	const notesByTag = new Map<string, string>();
	if (Array.isArray(githubReleases)) {
		for (const entry of githubReleases) {
			if (!isRecord(entry)) continue;
			const tag = asString(entry.tag_name)?.replace(/^v/, '');
			const body = asString(entry.body);
			if (tag && body) notesByTag.set(tag, body);
		}
	}

	const releasesByVersion = new Map(SEED_RELEASES.map((release) => [release.version, release]));
	for (const [version, manifest] of Object.entries(versions)) {
		if (!isRecord(manifest)) continue;
		const dist = isRecord(manifest.dist) ? manifest.dist : undefined;
		releasesByVersion.set(version, {
			version,
			publishedAt: asString(time[version]) ?? new Date(0).toISOString(),
			unpackedSize: dist ? asNumber(dist.unpackedSize) : undefined,
			fileCount: dist ? asNumber(dist.fileCount) : undefined,
			gitHead: asString(manifest.gitHead)?.slice(0, 12),
			notes: notesByTag.get(version) ?? releasesByVersion.get(version)?.notes,
			released: true
		});
	}
	const releases = [...releasesByVersion.values()];
	if (releases.length === 0) return undefined;
	releases.sort((a, b) => compareVersionsDesc(a.version, b.version));
	return {
		releases,
		latest: releases[0]!.version,
		live: true,
		syncedAt: Date.now()
	};
}

/** One guarded refresh pass; GitHub failures degrade gracefully to npm-only. */
async function refresh(): Promise<void> {
	lastAttemptAt = Date.now();
	try {
		const packument = await fetchJson(NPM_PACKAGE_URL);
		const githubReleases = await fetchJson(GITHUB_RELEASES_URL).catch(() => undefined);
		const next = buildRegistry(packument, githubReleases);
		if (next) cache = next;
	} catch {
		/* Keep serving the previous (or seed) snapshot. */
	}
}

/**
 * Return the current registry snapshot, kicking off a background refresh when
 * the cache is stale. Never blocks longer than the first cold sync.
 */
export async function getRegistry(): Promise<SchemdRegistry> {
	if (building || process.env.SCHEMD_REGISTRY_OFFLINE === '1') return cache;
	const stale = Date.now() - lastAttemptAt > REFRESH_INTERVAL_MS;
	if (stale && !refreshInFlight) {
		refreshInFlight = refresh().finally(() => {
			refreshInFlight = undefined;
		});
		/* Cold start: wait once so first paint has real data when reachable. */
		if (cache.syncedAt === 0) await refreshInFlight;
	}
	return cache;
}

/** Resolve a `[version]` path parameter against known releases (exact only). */
export function resolveVersion(registry: SchemdRegistry, parameter: string): string | undefined {
	if (parameter === 'latest') return registry.latest;
	return registry.releases.some((release) => release.version === parameter) ? parameter : undefined;
}

/**
 * Resolve any release parameter — `latest`, an exact release, or a
 * major/minor **line alias** — to a concrete published release. This is what
 * lets a docs line alias (`0.3`) navigate to the playground or simulations,
 * which run one real engine build (`0.3.2`), instead of 404-ing. A bare line
 * resolves to the newest release within it; unknown parameters return
 * `undefined` so the route can still surface a genuine 404.
 */
export function resolveReleaseVersion(
	registry: SchemdRegistry,
	parameter: string
): string | undefined {
	if (parameter === 'latest') return registry.latest;
	const versions = registry.releases.map((release) => release.version);
	if (versions.includes(parameter)) return parameter;
	if (/^\d+(\.\d+)?$/.test(parameter)) {
		const prefix = `${parameter}.`;
		const matches = versions
			.filter((version) => version === parameter || version.startsWith(prefix))
			.sort(compareVersionsDesc);
		if (matches.length > 0) return matches[0];
	}
	return undefined;
}
