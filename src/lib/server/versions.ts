/**
 * Version discovery — the single source of truth for which `@schemd/core`
 * releases this site documents.
 *
 * Every versioned documentation corpus lives in `content/schemd/<version>/*.md`.
 * This module globs those folders once at load and derives the ordered version
 * list and the latest documented release from the filesystem itself. Publishing
 * a new release is therefore a content operation: drop a `content/schemd/x.y.z/`
 * folder (and bump the `@schemd/core` dependency) and the docs, gallery,
 * coverage report, and every default-version redirect follow automatically —
 * while older folders stay served as history.
 */

/** Raw markdown for every versioned corpus, keyed by absolute module path. */
const versionedSources = import.meta.glob<string>('$lib/content/schemd/*/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

/** Extract the `x.y.z` segment from a `.../schemd/x.y.z/slug.md` path. */
const VERSION_SEGMENT = /\/schemd\/(\d+\.\d+\.\d+)\//;

/** Compare semver strings newest-first (numeric, not lexicographic). */
export function compareVersionsDesc(left: string, right: string): number {
	const a = left.split('.').map(Number);
	const b = right.split('.').map(Number);
	for (let index = 0; index < 3; index += 1) {
		if (a[index] !== b[index]) return (b[index] ?? 0) - (a[index] ?? 0);
	}
	return 0;
}

function discover(): Map<string, Record<string, string>> {
	const byVersion = new Map<string, Record<string, string>>();
	for (const [path, raw] of Object.entries(versionedSources)) {
		const match = VERSION_SEGMENT.exec(path);
		if (!match) continue;
		const version = match[1]!;
		const bucket = byVersion.get(version) ?? {};
		bucket[path] = raw;
		byVersion.set(version, bucket);
	}
	return byVersion;
}

const CORPORA = discover();

/** Every documented version, newest first. */
export const DOCUMENTED_VERSIONS: readonly string[] = [...CORPORA.keys()].sort(compareVersionsDesc);

/* A build must never ship without at least one documented version. */
if (DOCUMENTED_VERSIONS.length === 0) {
	throw new Error('No documented versions found under content/schemd/<version>/.');
}

/** The newest documented release — the site-wide default everywhere. */
export const LATEST_DOCUMENTED_VERSION = DOCUMENTED_VERSIONS[0]!;

/** The oldest documented release, retained for legacy deep links. */
export const OLDEST_DOCUMENTED_VERSION = DOCUMENTED_VERSIONS[DOCUMENTED_VERSIONS.length - 1]!;

/** Whether a path parameter names a real documented corpus. */
export function isDocumentedVersion(version: string): boolean {
	return CORPORA.has(version);
}

/**
 * Resolve a docs `[version]` parameter against the documented folders — not the
 * npm registry — so historical docs stay reachable regardless of what npm
 * currently lists, and `latest` always means the newest documented corpus.
 */
export function resolveDocVersion(parameter: string): string | undefined {
	if (parameter === 'latest') return LATEST_DOCUMENTED_VERSION;
	return isDocumentedVersion(parameter) ? parameter : undefined;
}

/** Raw markdown sources for one documented version, or `undefined`. */
export function versionedRawSources(version: string): Record<string, string> | undefined {
	return CORPORA.get(version);
}

/** Raw markdown sources for the latest documented version. */
export function latestRawSources(): Record<string, string> {
	return CORPORA.get(LATEST_DOCUMENTED_VERSION)!;
}
