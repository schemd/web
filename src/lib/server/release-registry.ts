import { LATEST_VERSION, NPM_PACKAGE_URL, CORE_REPOSITORY } from '$lib/versioning/manifest';

export interface ReleaseRegistrySnapshot {
	readonly registryLatest: string;
	readonly supportedLatest: string;
	readonly source: 'network' | 'verified-fallback';
	readonly compatibilityNotice?: string;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
	return typeof value === 'object' && value !== null;
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
		if (typeof release.tag_name === 'string') return release.tag_name.replace(/^v/u, '');
	}
	return undefined;
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
