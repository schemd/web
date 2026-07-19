import { LATEST_VERSION, NPM_PACKAGE_URL, CORE_REPOSITORY } from '$lib/versioning/manifest';

export interface ReleaseAsset {
	readonly name: string;
	readonly url: string;
	readonly bytes: number;
}

export interface RegistryRelease {
	readonly version: string;
	readonly publishedAt?: string;
	readonly npmTarball?: string;
	readonly npmUnpackedBytes?: number;
	readonly githubUrl?: string;
	readonly assets: readonly ReleaseAsset[];
}

export interface ReleaseRegistrySnapshot {
	readonly registryLatest: string;
	readonly supportedLatest: string;
	readonly source: 'network' | 'verified-fallback';
	readonly releases: readonly RegistryRelease[];
	readonly compatibilityNotice?: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null;
}

function isSecureUrl(value: unknown): value is string {
	if (typeof value !== 'string') return false;
	try {
		return new URL(value).protocol === 'https:';
	} catch {
		return false;
	}
}

function normaliseVersion(value: string): string {
	return value.replace(/^v/u, '');
}

export function npmLatestVersion(payload: unknown): string | undefined {
	if (!isRecord(payload)) return undefined;
	const tags = payload['dist-tags'];
	if (!isRecord(tags)) return undefined;
	return typeof tags.latest === 'string' ? tags.latest : undefined;
}

export function githubLatestVersion(payload: unknown): string | undefined {
	if (!Array.isArray(payload)) return undefined;
	for (const release of payload) {
		if (!isRecord(release) || release.draft === true || release.prerelease === true) continue;
		if (typeof release.tag_name === 'string') return normaliseVersion(release.tag_name);
	}
	return undefined;
}

export function npmReleases(payload: unknown): readonly RegistryRelease[] {
	if (!isRecord(payload) || !isRecord(payload.versions)) return [];
	const times = isRecord(payload.time) ? payload.time : {};
	const releases: RegistryRelease[] = [];
	for (const [version, metadata] of Object.entries(payload.versions)) {
		if (!isRecord(metadata)) continue;
		const distribution = isRecord(metadata.dist) ? metadata.dist : {};
		const npmTarball = isSecureUrl(distribution.tarball) ? distribution.tarball : undefined;
		const npmUnpackedBytes =
			typeof distribution.unpackedSize === 'number' &&
			Number.isSafeInteger(distribution.unpackedSize) &&
			distribution.unpackedSize >= 0
				? distribution.unpackedSize
				: undefined;
		const publishedAt = typeof times[version] === 'string' ? times[version] : undefined;
		releases.push({
			version: normaliseVersion(version),
			...(publishedAt === undefined ? {} : { publishedAt }),
			...(npmTarball === undefined ? {} : { npmTarball }),
			...(npmUnpackedBytes === undefined ? {} : { npmUnpackedBytes }),
			assets: []
		});
	}
	return releases;
}

export function githubReleases(payload: unknown): readonly RegistryRelease[] {
	if (!Array.isArray(payload)) return [];
	const releases: RegistryRelease[] = [];
	for (const value of payload) {
		if (!isRecord(value) || value.draft === true || typeof value.tag_name !== 'string') continue;
		const assets: ReleaseAsset[] = [];
		if (Array.isArray(value.assets)) {
			for (const asset of value.assets) {
				if (
					!isRecord(asset) ||
					typeof asset.name !== 'string' ||
					!isSecureUrl(asset.browser_download_url) ||
					typeof asset.size !== 'number' ||
					!Number.isSafeInteger(asset.size) ||
					asset.size < 0
				)
					continue;
				assets.push({
					name: asset.name,
					url: asset.browser_download_url,
					bytes: asset.size
				});
			}
		}
		const publishedAt = typeof value.published_at === 'string' ? value.published_at : undefined;
		const githubUrl = isSecureUrl(value.html_url) ? value.html_url : undefined;
		releases.push({
			version: normaliseVersion(value.tag_name),
			...(publishedAt === undefined ? {} : { publishedAt }),
			...(githubUrl === undefined ? {} : { githubUrl }),
			assets
		});
	}
	return releases;
}

function mergeReleases(
	npm: readonly RegistryRelease[],
	github: readonly RegistryRelease[]
): readonly RegistryRelease[] {
	const versions = new Map<string, RegistryRelease>();
	for (const release of [...npm, ...github]) {
		const previous = versions.get(release.version);
		versions.set(release.version, {
			version: release.version,
			...((release.publishedAt ?? previous?.publishedAt)
				? { publishedAt: release.publishedAt ?? previous?.publishedAt }
				: {}),
			...((release.npmTarball ?? previous?.npmTarball)
				? { npmTarball: release.npmTarball ?? previous?.npmTarball }
				: {}),
			...((release.npmUnpackedBytes ?? previous?.npmUnpackedBytes)
				? { npmUnpackedBytes: release.npmUnpackedBytes ?? previous?.npmUnpackedBytes }
				: {}),
			...(release.githubUrl ? { githubUrl: release.githubUrl } : {}),
			assets: release.assets
		});
	}
	return [...versions.values()]
		.sort((left, right) => right.version.localeCompare(left.version, undefined, { numeric: true }))
		.slice(0, 20);
}

export function releaseSnapshot(
	npmPayload: unknown,
	githubPayload: unknown
): ReleaseRegistrySnapshot {
	const supported = LATEST_VERSION.id.replace(/^v/u, '');
	const registryLatest =
		npmLatestVersion(npmPayload) ?? githubLatestVersion(githubPayload) ?? supported;
	return {
		registryLatest,
		supportedLatest: supported,
		source:
			registryLatest === supported &&
			npmLatestVersion(npmPayload) === undefined &&
			githubLatestVersion(githubPayload) === undefined
				? 'verified-fallback'
				: 'network',
		releases: mergeReleases(npmReleases(npmPayload), githubReleases(githubPayload)),
		...(registryLatest === supported
			? {}
			: {
					compatibilityNotice: `Registry ${registryLatest} is newer than the reproducible ${supported} documentation artifact.`
				})
	};
}

async function fetchJson(url: string, accept: string): Promise<unknown> {
	const response = await fetch(url, {
		headers: { accept },
		signal: AbortSignal.timeout(1_500)
	});
	if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}.`);
	const payload: unknown = await response.json();
	return payload;
}

export async function fetchReleaseRegistry(): Promise<ReleaseRegistrySnapshot> {
	const [npm, github] = await Promise.allSettled([
		fetchJson('https://registry.npmjs.org/@schemd%2Fcore', 'application/vnd.npm.install-v1+json'),
		fetchJson('https://api.github.com/repos/schemd/core/releases', 'application/vnd.github+json')
	]);
	return releaseSnapshot(
		npm.status === 'fulfilled' ? npm.value : undefined,
		github.status === 'fulfilled' ? github.value : undefined
	);
}

export const RELEASE_LINKS = Object.freeze({ npm: NPM_PACKAGE_URL, github: CORE_REPOSITORY });
