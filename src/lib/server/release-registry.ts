import { CORE_REPOSITORY, CURRENT_SEMVER, NPM_PACKAGE_URL, PACKAGE_NAME } from '$lib/platform';

const NPM_REGISTRY_URL = 'https://registry.npmjs.org/@schemd%2Fcore';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/schemd/core/releases?per_page=20';
const NETWORK_CACHE_MILLISECONDS = 15 * 60 * 1_000;
const FALLBACK_CACHE_MILLISECONDS = 60 * 1_000;
const STALE_CACHE_MILLISECONDS = 24 * 60 * 60 * 1_000;
const REQUEST_TIMEOUT_MILLISECONDS = 1_800;
const MAX_RESPONSE_BYTES = 2_500_000;
const MAX_RELEASES = 20;
const MAX_ASSETS_PER_RELEASE = 8;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u;
const HASH_PATTERN = /^[0-9a-f]{7,64}$/iu;

export interface ReleaseAsset {
	readonly name: string;
	readonly url: string;
	readonly bytes: number;
}

export interface RegistryRelease {
	readonly version: string;
	readonly publishedAt: string | null;
	readonly npmTarball: string | null;
	readonly npmUnpackedBytes: number | null;
	readonly gitHash: string | null;
	readonly githubUrl: string | null;
	readonly assets: readonly ReleaseAsset[];
}

export type ReleaseRegistrySource = 'network' | 'partial-network' | 'stale' | 'fallback';

export interface ReleaseRegistrySnapshot {
	readonly packageName: string;
	readonly registryLatest: string;
	readonly supportedLatest: string;
	readonly generatedAt: string;
	readonly source: ReleaseRegistrySource;
	readonly releases: readonly RegistryRelease[];
	readonly compatibilityNotice: string | null;
}

interface CacheEntry {
	readonly snapshot: ReleaseRegistrySnapshot;
	readonly expiresAt: number;
	readonly staleUntil: number;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

let cacheEntry: CacheEntry | undefined;
let refreshPromise: Promise<ReleaseRegistrySnapshot> | undefined;

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function secureUrl(value: unknown): string | null {
	if (typeof value !== 'string' || value.length > 2_048) return null;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' ? url.href : null;
	} catch {
		return null;
	}
}

function version(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const normalized = value.replace(/^v/u, '');
	return VERSION_PATTERN.test(normalized) ? normalized : null;
}

function timestamp(value: unknown): string | null {
	if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) return null;
	return value;
}

function byteCount(value: unknown): number | null {
	return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function gitHash(value: unknown): string | null {
	return typeof value === 'string' && HASH_PATTERN.test(value)
		? value.toLocaleLowerCase('en-US')
		: null;
}

async function boundedJson(response: Response): Promise<unknown> {
	if (!response.ok) throw new Error(`Registry endpoint returned HTTP ${response.status}.`);
	const declaredLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
		throw new Error('Registry response exceeded the transfer budget.');
	}
	if (response.body === null) {
		const text = await response.text();
		if (text.length > MAX_RESPONSE_BYTES) throw new Error('Registry response exceeded the budget.');
		const payload: unknown = JSON.parse(text);
		return payload;
	}
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (true) {
		const read = await reader.read();
		if (read.done) break;
		total += read.value.byteLength;
		if (total > MAX_RESPONSE_BYTES) {
			await reader.cancel('Registry response exceeded the transfer budget.');
			throw new Error('Registry response exceeded the transfer budget.');
		}
		chunks.push(read.value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
	return payload;
}

async function fetchJson(fetcher: Fetcher, url: string, accept: string): Promise<unknown> {
	const response = await fetcher(url, {
		headers: { accept },
		signal: AbortSignal.timeout(REQUEST_TIMEOUT_MILLISECONDS)
	});
	return boundedJson(response);
}

function npmLatest(payload: unknown): string | null {
	if (!isRecord(payload)) return null;
	const tags = payload['dist-tags'];
	if (!isRecord(tags)) return null;
	return version(tags.latest);
}

function npmReleases(payload: unknown): readonly RegistryRelease[] {
	if (!isRecord(payload) || !isRecord(payload.versions)) return [];
	const times = isRecord(payload.time) ? payload.time : {};
	const candidates = Object.keys(payload.versions).slice(-64);
	const releases: RegistryRelease[] = [];
	for (const candidate of candidates) {
		const normalizedVersion = version(candidate);
		const metadata = payload.versions[candidate];
		if (normalizedVersion === null || !isRecord(metadata)) continue;
		const distribution = isRecord(metadata.dist) ? metadata.dist : {};
		releases.push({
			version: normalizedVersion,
			publishedAt: timestamp(times[candidate]),
			npmTarball: secureUrl(distribution.tarball),
			npmUnpackedBytes: byteCount(distribution.unpackedSize),
			gitHash: gitHash(metadata.gitHead),
			githubUrl: null,
			assets: []
		});
	}
	return releases;
}

function githubLatest(payload: unknown): string | null {
	if (!Array.isArray(payload)) return null;
	for (const candidate of payload.slice(0, MAX_RELEASES)) {
		if (!isRecord(candidate) || candidate.draft === true || candidate.prerelease === true) continue;
		const normalizedVersion = version(candidate.tag_name);
		if (normalizedVersion !== null) return normalizedVersion;
	}
	return null;
}

function githubReleases(payload: unknown): readonly RegistryRelease[] {
	if (!Array.isArray(payload)) return [];
	const releases: RegistryRelease[] = [];
	for (const candidate of payload.slice(0, MAX_RELEASES)) {
		if (!isRecord(candidate) || candidate.draft === true) continue;
		const normalizedVersion = version(candidate.tag_name);
		if (normalizedVersion === null) continue;
		const assets: ReleaseAsset[] = [];
		if (Array.isArray(candidate.assets)) {
			for (const value of candidate.assets.slice(0, MAX_ASSETS_PER_RELEASE)) {
				if (!isRecord(value) || typeof value.name !== 'string' || value.name.length > 256) continue;
				const url = secureUrl(value.browser_download_url);
				const bytes = byteCount(value.size);
				if (url === null || bytes === null) continue;
				assets.push({ name: value.name, url, bytes });
			}
		}
		releases.push({
			version: normalizedVersion,
			publishedAt: timestamp(candidate.published_at),
			npmTarball: null,
			npmUnpackedBytes: null,
			gitHash: gitHash(candidate.target_commitish),
			githubUrl: secureUrl(candidate.html_url),
			assets: Object.freeze(assets)
		});
	}
	return releases;
}

function compareVersions(left: string, right: string): number {
	const leftParts = left.split(/[.+-]/u);
	const rightParts = right.split(/[.+-]/u);
	for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
		const leftPart = leftParts[index] ?? '';
		const rightPart = rightParts[index] ?? '';
		const leftNumber = Number(leftPart);
		const rightNumber = Number(rightPart);
		const bothNumeric = Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber);
		if (bothNumeric && leftNumber !== rightNumber) return rightNumber - leftNumber;
		if (!bothNumeric && leftPart !== rightPart) return rightPart.localeCompare(leftPart);
	}
	return 0;
}

function mergeReleases(
	npm: readonly RegistryRelease[],
	github: readonly RegistryRelease[]
): readonly RegistryRelease[] {
	const byVersion = new Map<string, RegistryRelease>();
	for (const release of [...npm, ...github]) {
		const previous = byVersion.get(release.version);
		byVersion.set(release.version, {
			version: release.version,
			publishedAt: release.publishedAt ?? previous?.publishedAt ?? null,
			npmTarball: release.npmTarball ?? previous?.npmTarball ?? null,
			npmUnpackedBytes: release.npmUnpackedBytes ?? previous?.npmUnpackedBytes ?? null,
			gitHash: release.gitHash ?? previous?.gitHash ?? null,
			githubUrl: release.githubUrl ?? previous?.githubUrl ?? null,
			assets: release.assets.length > 0 ? release.assets : (previous?.assets ?? [])
		});
	}
	return Object.freeze(
		[...byVersion.values()]
			.sort((left, right) => compareVersions(left.version, right.version))
			.slice(0, MAX_RELEASES)
			.map((release) => Object.freeze({ ...release, assets: Object.freeze([...release.assets]) }))
	);
}

const FALLBACK_RELEASES: readonly RegistryRelease[] = Object.freeze([
	{
		version: '0.2.1',
		publishedAt: '2026-07-17T19:15:34-07:00',
		npmTarball: null,
		npmUnpackedBytes: null,
		gitHash: '5b2b68213a467fcbf08825aeff2b41c07307140d',
		githubUrl: `${CORE_REPOSITORY}/releases/tag/v0.2.1`,
		assets: []
	},
	{
		version: '0.2.0',
		publishedAt: '2026-07-17T03:09:37-07:00',
		npmTarball: null,
		npmUnpackedBytes: null,
		gitHash: '31cd0daab849fd8edee1944e4521614b6756362b',
		githubUrl: `${CORE_REPOSITORY}/releases/tag/v0.2.0`,
		assets: []
	},
	{
		version: '0.1.6',
		publishedAt: '2026-07-15T21:23:05-07:00',
		npmTarball: null,
		npmUnpackedBytes: null,
		gitHash: '3a71d85290a997bdf21c3990d5d80a2c37b20f53',
		githubUrl: `${CORE_REPOSITORY}/releases/tag/v0.1.6`,
		assets: []
	},
	{
		version: '0.1.2',
		publishedAt: '2026-07-16T20:42:58-07:00',
		npmTarball: null,
		npmUnpackedBytes: null,
		gitHash: 'ddfc9fb674cff7ed16485c5065935c44b602e6c9',
		githubUrl: `${CORE_REPOSITORY}/releases/tag/v0.1.2`,
		assets: []
	},
	{
		version: '0.1.1',
		publishedAt: '2026-07-16T16:38:19-07:00',
		npmTarball: null,
		npmUnpackedBytes: null,
		gitHash: 'd74e29fa33f49945c34de09552553c9f6f57dc0e',
		githubUrl: `${CORE_REPOSITORY}/releases/tag/v0.1.1`,
		assets: []
	},
	{
		version: '0.1.0',
		publishedAt: '2026-07-16T16:01:47-07:00',
		npmTarball: null,
		npmUnpackedBytes: null,
		gitHash: '203258bed98c6aff09cb4d8de459ae510993708f',
		githubUrl: `${CORE_REPOSITORY}/releases/tag/v0.1.0`,
		assets: []
	}
]);

function snapshot(
	source: ReleaseRegistrySource,
	registryLatest: string,
	releases: readonly RegistryRelease[]
): ReleaseRegistrySnapshot {
	return Object.freeze({
		packageName: PACKAGE_NAME,
		registryLatest,
		supportedLatest: CURRENT_SEMVER,
		generatedAt: new Date().toISOString(),
		source,
		releases,
		compatibilityNotice:
			registryLatest === CURRENT_SEMVER
				? null
				: `Registry ${registryLatest} is newer than the reproducible ${CURRENT_SEMVER} website artifact.`
	});
}

async function loadRegistry(fetcher: Fetcher): Promise<ReleaseRegistrySnapshot> {
	const [npmResult, githubResult] = await Promise.allSettled([
		fetchJson(fetcher, NPM_REGISTRY_URL, 'application/vnd.npm.install-v1+json'),
		fetchJson(fetcher, GITHUB_RELEASES_URL, 'application/vnd.github+json')
	]);
	const npmPayload = npmResult.status === 'fulfilled' ? npmResult.value : undefined;
	const githubPayload = githubResult.status === 'fulfilled' ? githubResult.value : undefined;
	const npm = npmReleases(npmPayload);
	const github = githubReleases(githubPayload);
	// Registry install metadata omits publish dates and git heads on some mirrors.
	// Seed known releases first, then let live npm/GitHub fields replace them.
	const merged = mergeReleases([...FALLBACK_RELEASES, ...npm], github);
	const latest = npmLatest(npmPayload) ?? githubLatest(githubPayload);
	if (latest === null || merged.length === 0) {
		return snapshot('fallback', CURRENT_SEMVER, FALLBACK_RELEASES);
	}
	return snapshot(
		npmResult.status === 'fulfilled' && githubResult.status === 'fulfilled'
			? 'network'
			: 'partial-network',
		latest,
		merged
	);
}

export async function getReleaseRegistry(
	fetcher: Fetcher = globalThis.fetch,
	now = Date.now()
): Promise<ReleaseRegistrySnapshot> {
	if (cacheEntry !== undefined && now < cacheEntry.expiresAt) return cacheEntry.snapshot;
	if (refreshPromise !== undefined) return refreshPromise;
	refreshPromise = loadRegistry(fetcher)
		.then((fresh) => {
			const previous = cacheEntry;
			let result = fresh;
			if (
				fresh.source === 'fallback' &&
				previous !== undefined &&
				previous.snapshot.source !== 'fallback' &&
				now < previous.staleUntil
			) {
				const staleSnapshot: ReleaseRegistrySnapshot = Object.freeze({
					...previous.snapshot,
					source: 'stale'
				});
				result = staleSnapshot;
			}
			const ttl =
				result.source === 'network' || result.source === 'partial-network'
					? NETWORK_CACHE_MILLISECONDS
					: FALLBACK_CACHE_MILLISECONDS;
			cacheEntry = {
				snapshot: result,
				expiresAt: now + ttl,
				staleUntil: now + STALE_CACHE_MILLISECONDS
			};
			return result;
		})
		.finally(() => {
			refreshPromise = undefined;
		});
	return refreshPromise;
}

export const RELEASE_LINKS = Object.freeze({
	npm: NPM_PACKAGE_URL,
	github: CORE_REPOSITORY
});
