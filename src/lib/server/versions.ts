/**
 * Documentation-line discovery — the single source of truth for which
 * `@schemd/core` release lines this site documents.
 *
 * Docs are keyed by **minor line** (`content/schemd/0.3/*.md`), not by patch,
 * because patches within a line share one grammar and one corpus. Publishing a
 * new minor is a content operation: drop a `content/schemd/x.y/` folder and the
 * docs, gallery, coverage report, and every default redirect follow
 * automatically — while older lines stay served as history.
 *
 * Any requested version resolves to a documented line: an exact line match
 * serves that line, anything newer than the newest line serves the newest,
 * anything older than the oldest serves the oldest, and everything between
 * snaps to the nearest documented line at or below it. Nothing 404s just
 * because npm lists a release this site never wrote a corpus for.
 */

/** Raw markdown for every documented line, keyed by absolute module path. */
const versionedSources = import.meta.glob<string>('$lib/content/schemd/*/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

/** Extract the `x.y` segment from a `.../schemd/x.y/slug.md` path. */
const LINE_SEGMENT = /\/schemd\/(\d+\.\d+)\//;

/** Compare dotted version strings newest-first (numeric, not lexicographic). */
export function compareVersionsDesc(left: string, right: string): number {
	const a = left.split('.').map(Number);
	const b = right.split('.').map(Number);
	for (let index = 0; index < 3; index += 1) {
		if ((a[index] ?? 0) !== (b[index] ?? 0)) return (b[index] ?? 0) - (a[index] ?? 0);
	}
	return 0;
}

function discover(): Map<string, Record<string, string>> {
	const byLine = new Map<string, Record<string, string>>();
	for (const [path, raw] of Object.entries(versionedSources)) {
		const match = LINE_SEGMENT.exec(path);
		if (!match) continue;
		const line = match[1]!;
		const bucket = byLine.get(line) ?? {};
		bucket[path] = raw;
		byLine.set(line, bucket);
	}
	return byLine;
}

const CORPORA = discover();

/** Every documented line, newest first. */
export const DOCUMENTED_VERSIONS: readonly string[] = [...CORPORA.keys()].sort(compareVersionsDesc);

/* A build must never ship without at least one documented line. */
if (DOCUMENTED_VERSIONS.length === 0) {
	throw new Error('No documented lines found under content/schemd/<major.minor>/.');
}

/** The newest documented line — the site-wide docs default. */
export const LATEST_DOCUMENTED_VERSION = DOCUMENTED_VERSIONS[0]!;

/** The oldest documented line, retained for legacy deep links. */
export const OLDEST_DOCUMENTED_VERSION = DOCUMENTED_VERSIONS[DOCUMENTED_VERSIONS.length - 1]!;

/** Whether a path parameter names a documented line exactly. */
export function isDocumentedVersion(version: string): boolean {
	return CORPORA.has(version);
}

/**
 * Resolve any requested docs version — line, patch, alias, or a release this
 * site never documented — to the documented line that should serve it.
 * Returns `undefined` only for parameters that are not versions at all.
 */
export function resolveDocVersion(parameter: string): string | undefined {
	if (parameter === 'latest') return LATEST_DOCUMENTED_VERSION;
	if (CORPORA.has(parameter)) return parameter;
	if (!/^\d+(\.\d+){0,2}$/.test(parameter)) return undefined;
	/* Snap to the nearest documented line at or below the request. */
	for (const line of DOCUMENTED_VERSIONS) {
		if (compareVersionsDesc(line, parameter) >= 0) return line;
	}
	/* Older than everything documented: serve the oldest history we keep. */
	return OLDEST_DOCUMENTED_VERSION;
}

/** Raw markdown sources for one documented line, or `undefined`. */
export function versionedRawSources(version: string): Record<string, string> | undefined {
	return CORPORA.get(version);
}

/** Raw markdown sources for the latest documented line. */
export function latestRawSources(): Record<string, string> {
	return CORPORA.get(LATEST_DOCUMENTED_VERSION)!;
}
