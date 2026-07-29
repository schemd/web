/**
 * Node-powered registry sync engine.
 *
 * Because the site runs on `adapter-node`, this module lives for the whole
 * process. We exploit that: release data from the npm registry and the GitHub
 * API is aggregated into a persistent in-memory cache with a
 * stale-while-revalidate refresh loop, so no request blocks on registry I/O,
 * including the first request in a cold process.
 */
import { building } from '$app/environment';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOCUMENTED_VERSIONS, OLDEST_DOCUMENTED_VERSION } from './versions';
import releaseSnapshot from './release-snapshot.json' with { type: 'json' };

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
	/** True for known historical releases or after npm confirms the installed candidate. */
	readonly released: boolean;
}

/** Aggregated registry state shared by every route. */
export interface SchemdRegistry {
	/** Releases sorted newest-first. */
	readonly releases: readonly SchemdRelease[];
	/**
	 * The npm dist-tag `latest` version after a live refresh. The deterministic
	 * seed names the installed candidate so `/latest` remains routable offline.
	 */
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
 * network round-trip completes and when the registry is unreachable.
 *
 * It is generated, never typed: `scripts/sync-release-snapshot.ts` reads npm's
 * packument and the compiler's own changelog and writes
 * `release-snapshot.json`, which a scheduled job refreshes by pull request. A
 * publish therefore costs no editing here. The snapshot has no authority over
 * the executable engine version — that comes only from the installed
 * `@schemd/core` manifest — and documentation lines are still discovered from
 * content folders.
 */
interface SnapshotRelease {
	readonly version: string;
	readonly publishedAt: string;
	readonly unpackedSize?: number;
	readonly fileCount?: number;
	readonly gitHead?: string;
	readonly notes?: string;
}

const SNAPSHOT = releaseSnapshot as {
	readonly latest: string;
	readonly releases: readonly SnapshotRelease[];
};

/** Extract a strict semver from an installed package manifest. */
export function packageManifestVersion(manifest: unknown): string | undefined {
	if (!isRecord(manifest)) return undefined;
	const version = manifest['version'];
	return typeof version === 'string' && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)
		? version
		: undefined;
}

/**
 * The release this deployment actually executes.
 *
 * This deliberately reads the installed package boundary. Release notes are
 * editorial content and can be stale or reordered without changing the engine
 * behind the playground, diff, embed, and changelog routes.
 */
function installedCoreVersion(): string {
	const entry = fileURLToPath(import.meta.resolve('@schemd/core'));
	const manifestPath = resolve(dirname(entry), '..', 'package.json');
	const manifest: unknown = JSON.parse(readFileSync(manifestPath, 'utf8'));
	const version = packageManifestVersion(manifest);
	if (!version) throw new Error(`Invalid @schemd/core manifest at ${manifestPath}.`);
	return version;
}

export const WEBSITE_CORE_VERSION = installedCoreVersion();

/**
 * Seed every known release so routes resolve offline.
 *
 * A version the snapshot carries was confirmed on npm when the snapshot was
 * generated, so it seeds as published with the metadata npm actually reported.
 * An installed engine the snapshot has never seen is a local build: it stays
 * routable, and stays marked publication-unconfirmed until a live refresh (or
 * the next snapshot) says otherwise.
 */
export function _seedReleases(
	snapshot: readonly SnapshotRelease[],
	installed: string
): readonly SchemdRelease[] {
	const seeded = snapshot.map((release) => ({
		version: release.version,
		publishedAt: release.publishedAt,
		unpackedSize: release.unpackedSize,
		fileCount: release.fileCount,
		gitHead: release.gitHead,
		notes: release.notes,
		released: true
	}));
	if (!seeded.some((release) => release.version === installed)) {
		seeded.push({
			version: installed,
			publishedAt: new Date(0).toISOString(),
			unpackedSize: undefined,
			fileCount: undefined,
			gitHead: undefined,
			notes: undefined,
			released: false
		});
	}
	return seeded.sort((a, b) => compareVersionsDesc(a.version, b.version));
}

const SEED_RELEASES: readonly SchemdRelease[] = _seedReleases(
	SNAPSHOT.releases,
	WEBSITE_CORE_VERSION
);

/**
 * The release legacy deep links land on.
 *
 * This is the newest release inside the *oldest documented line*, not the
 * oldest release npm has ever carried. A visitor arriving from a five-year-old
 * link wants the earliest version this site still explains; sending them to a
 * 0.1.x build the docs never covered would be worse than not redirecting.
 */
export const HISTORICAL_CORE_VERSION =
	SEED_RELEASES.find((release) => release.version.startsWith(`${OLDEST_DOCUMENTED_VERSION}.`))
		?.version ?? SEED_RELEASES[SEED_RELEASES.length - 1]!.version;
/** Documented docs lines (newest first), re-exported for route/test callers. */
export const DOCUMENTATION_VERSIONS: readonly string[] = DOCUMENTED_VERSIONS;

const SEED_REGISTRY: SchemdRegistry = {
	releases: [...SEED_RELEASES],
	latest: WEBSITE_CORE_VERSION,
	live: false,
	syncedAt: 0
};

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

interface ParsedSemver {
	readonly core: readonly [number, number, number];
	readonly prerelease: readonly string[];
}

function parseSemver(version: string): ParsedSemver | undefined {
	/* Release routing also compares major/minor aliases (`0`, `0.4`), so
	 * absent numeric segments have the same precedence as zero. */
	const match = version.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/);
	if (!match) return undefined;
	return {
		core: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)],
		prerelease: match[4]?.split('.') ?? []
	};
}

/** Compare strict semver strings by precedence, newest first. */
export function compareVersionsDesc(a: string, b: string): number {
	const aa = parseSemver(a);
	const bb = parseSemver(b);
	if (!aa || !bb) return a.localeCompare(b);
	for (let index = 0; index < aa.core.length; index += 1) {
		const delta = bb.core[index]! - aa.core[index]!;
		if (delta !== 0) return delta;
	}
	if (aa.prerelease.length === 0 && bb.prerelease.length > 0) return -1;
	if (bb.prerelease.length === 0 && aa.prerelease.length > 0) return 1;
	for (let index = 0; index < Math.max(aa.prerelease.length, bb.prerelease.length); index += 1) {
		const left = aa.prerelease[index];
		const right = bb.prerelease[index];
		if (left === undefined) return 1;
		if (right === undefined) return -1;
		if (left === right) continue;
		const leftNumeric = /^\d+$/.test(left);
		const rightNumeric = /^\d+$/.test(right);
		if (leftNumeric && rightNumeric) return Number(right) - Number(left);
		if (leftNumeric !== rightNumeric) return leftNumeric ? 1 : -1;
		return right.localeCompare(left);
	}
	return 0;
}

/** Parse the npm packument plus optional GitHub notes into registry state. */
export function _buildRegistry(
	packument: unknown,
	githubReleases: unknown
): SchemdRegistry | undefined {
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
	const publishedVersions = new Set<string>();
	for (const [version, manifest] of Object.entries(versions)) {
		if (!isRecord(manifest) || !parseSemver(version)) continue;
		const dist = isRecord(manifest.dist) ? manifest.dist : undefined;
		publishedVersions.add(version);
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
	/*
	 * A live packument is the fresher, complete answer about what npm carries.
	 * A version the seed believed published that this packument does not list
	 * is therefore not published — an unreleased local build, or a snapshot
	 * that has run ahead of the registry.
	 */
	const releases = [...releasesByVersion.values()].map((release) =>
		release.released && !publishedVersions.has(release.version)
			? { ...release, released: false }
			: release
	);
	if (releases.length === 0) return undefined;
	releases.sort((a, b) => compareVersionsDesc(a.version, b.version));
	const distTags = isRecord(packument['dist-tags']) ? packument['dist-tags'] : undefined;
	const taggedLatest = asString(distTags?.['latest']);
	const latest =
		taggedLatest && publishedVersions.has(taggedLatest)
			? taggedLatest
			: releases.find((release) => publishedVersions.has(release.version))?.version;
	if (!latest) return undefined;
	return {
		releases,
		latest,
		live: true,
		syncedAt: Date.now()
	};
}

type RegistryFetcher = (url: string) => Promise<unknown>;

/**
 * Construct the process cache around an injected transport.
 *
 * The injection is deliberately narrow: it makes cold-start behaviour
 * deterministic under test without exposing cache mutation to request code.
 */
export function _createRegistryStore(
	fetcher: RegistryFetcher,
	now: () => number = Date.now
): { read: () => SchemdRegistry } {
	let snapshot = SEED_REGISTRY;
	let refreshInFlight: Promise<void> | undefined;
	let lastAttemptAt = 0;

	/** One guarded refresh pass; GitHub failures degrade gracefully to npm-only. */
	async function refresh(): Promise<void> {
		lastAttemptAt = now();
		try {
			/*
			 * npm is authoritative and GitHub is optional editorial enrichment.
			 * Start both together so a cold process never pays two serial
			 * six-second deadlines.
			 */
			const [packument, githubReleases] = await Promise.all([
				fetcher(NPM_PACKAGE_URL),
				fetcher(GITHUB_RELEASES_URL).catch(() => undefined)
			]);
			const next = _buildRegistry(packument, githubReleases);
			if (next) snapshot = next;
		} catch {
			/* Keep serving the previous (or seed) snapshot. */
		}
	}

	return {
		read(): SchemdRegistry {
			const stale = now() - lastAttemptAt > REFRESH_INTERVAL_MS;
			if (stale && !refreshInFlight) {
				refreshInFlight = refresh().finally(() => {
					refreshInFlight = undefined;
				});
			}
			/*
			 * This is genuine stale-while-revalidate: even the first request gets
			 * the seed immediately. No public request waits on npm or GitHub.
			 */
			return snapshot;
		}
	};
}

/** Process-lifetime cache. `adapter-node` keeps this warm across requests. */
const registryStore = _createRegistryStore(fetchJson);

/**
 * Return the current registry snapshot, kicking off a background refresh when
 * the cache is stale. Registry I/O is never on the request's critical path.
 */
export async function getRegistry(): Promise<SchemdRegistry> {
	if (building || process.env.SCHEMD_REGISTRY_OFFLINE === '1') return SEED_REGISTRY;
	return registryStore.read();
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
