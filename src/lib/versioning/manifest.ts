export const SITE_ORIGIN = 'https://schemd.johnowolabiidogun.dev';
export const CORE_REPOSITORY = 'https://github.com/schemd/core';
export const NPM_PACKAGE_URL = 'https://www.npmjs.com/package/@schemd/core';

export interface SchemdVersion {
	readonly id: `v${string}`;
	readonly packageVersion: string;
	readonly channel: 'stable';
	readonly releasedAt: string;
	readonly docsRoot: string;
	readonly playgroundPath: string;
	readonly simulationsPath: string;
	readonly apiUrl: string;
	readonly compatibility: string;
}

export const VERSIONS = Object.freeze([
	Object.freeze({
		id: 'v0.2.1',
		packageVersion: '0.2.1',
		channel: 'stable',
		releasedAt: '2026-07-17',
		docsRoot: '/docs/v0.2.1',
		playgroundPath: '/playground/v0.2.1',
		simulationsPath: '/simulations/v0.2.1',
		apiUrl: 'https://github.com/schemd/core/tree/v0.2.1',
		compatibility: 'Node.js 24 or newer; browsers through a host bundler.'
	})
] as const satisfies readonly SchemdVersion[]);

export type VersionId = (typeof VERSIONS)[number]['id'];
export const LATEST_VERSION: (typeof VERSIONS)[number] = VERSIONS[0];

export function isVersionId(value: string): value is VersionId {
	return VERSIONS.some((version) => version.id === value);
}

export function getVersion(value: string): (typeof VERSIONS)[number] | undefined {
	return VERSIONS.find((version) => version.id === value);
}

export function versionedPath(
	area: 'docs' | 'playground' | 'simulations',
	version: VersionId
): string {
	return `/${area}/${version}`;
}
