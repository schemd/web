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
 * network round-trip completes and when the registry is unreachable. The
 * version pinned here matches the workspace's installed `@schemd/core`.
 */
/**
 * Editorial notes per known release, shown when the npm registry is
 * unreachable. Their keys have no authority over the executable engine
 * version; that comes only from the installed `@schemd/core` manifest.
 * Documentation lines are discovered separately from content folders.
 */
const RELEASE_NOTES: Readonly<Record<string, { unpackedSize?: number; notes?: string }>> = {
	'0.4.0': {
		notes:
			'Diagram size stops being a product limit. The 512-component and 2,048-connection ceilings are gone — the compiler is linear in both, and sixty-four thousand components compile in about a second — and the budgets that remain are configurable per compilation through a `limits` option, so a host compiling a fence it did not write rejects an oversized document at the declaration that crosses it. Five defects found by audit are fixed: compounded traces no longer swallow every endpoint marker but one, a reversal bus routes where a four-wire crossbar used to fail, port aliases resolve to one canonical terminal across topology, netlist and design rules, integrated-circuit pins serialize at the documented precision, and a terminal can no longer be wired to itself.'
	},
	'0.3.8': {
		notes:
			'Geometry diagnostics became actionable: overlap and bounds errors name the offending coordinate and an origin that clears the collision or overhang. The documentation also states the structural, routing, hierarchy, and verification limits that a clean compile does not remove.'
	},
	'0.3.7': {
		notes:
			'The netlist and description modules gained the package exports their earlier releases promised. An installed-package test now checks every public subpath instead of assuming source-level imports prove the tarball boundary.'
	},
	'0.3.6': {
		notes:
			'Deterministic accessible descriptions summarize component inventory and proven connectivity without guessing a circuit archetype. The description module stays outside the main compiler entry so hosts that only compile do not ship it.'
	},
	'0.3.5': {
		notes:
			'Orthogonal routing moved from an x-only obstacle index to a two-axis spatial hash, removing the height-dependent quadratic term while preserving byte-identical output across the regression corpus.'
	},
	'0.3.4': {
		notes:
			'Connectivity became a first-class artifact. `buildNetlist` returns the nodes, nets, and edges behind a validated document, `verifyNetlist` checks seven design rules against them — shorted supply rails, conflicting bus widths, mixed signal domains, unconnected components, duplicate connections, contended digital drivers, disconnected subcircuits — and `inspectSchematic` does both. Orthogonal routing resolves obstacle participation once per route instead of once per segment query, and every component sheds the duplicated label paint it used to carry.'
	},
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

/** Every known release, newest first; always include the installed engine. */
const KNOWN_RELEASE_VERSIONS: readonly string[] = [
	...new Set([...Object.keys(RELEASE_NOTES), WEBSITE_CORE_VERSION])
].sort((a, b) => compareVersionsDesc(a, b));
/** The oldest release kept alive for legacy playground/simulation deep links. */
export const HISTORICAL_CORE_VERSION = KNOWN_RELEASE_VERSIONS[KNOWN_RELEASE_VERSIONS.length - 1]!;
/** Documented docs lines (newest first), re-exported for route/test callers. */
export const DOCUMENTATION_VERSIONS: readonly string[] = DOCUMENTED_VERSIONS;

/**
 * Seed every known release so routes resolve offline. The installed build is
 * the local candidate (`released: false`) until npm confirms publication;
 * newer editorial notes cannot change that status.
 */
const SEED_RELEASES: readonly SchemdRelease[] = KNOWN_RELEASE_VERSIONS.map((version) => ({
	version,
	publishedAt: new Date(0).toISOString(),
	unpackedSize: RELEASE_NOTES[version]?.unpackedSize,
	fileCount: RELEASE_NOTES[version]?.unpackedSize === undefined ? undefined : 24,
	gitHead: undefined,
	notes: RELEASE_NOTES[version]?.notes,
	released: version !== WEBSITE_CORE_VERSION
}));

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
	const releases = [...releasesByVersion.values()];
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
