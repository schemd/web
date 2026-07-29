/**
 * Regenerate the offline release snapshot.
 *
 * The site used to carry a hand-written map of every release's notes and
 * unpacked size. That map was the reason a publish needed a website commit:
 * npm and GitHub already knew all of it, and a human was retyping it.
 *
 * This reads both registries and writes what they said into
 * `src/lib/server/release-snapshot.json`, which the runtime uses as its
 * deterministic seed before (and instead of, when the network is unreachable)
 * a live refresh. Run it from CI on a schedule; the diff it produces is the
 * review.
 *
 *   bun scripts/sync-release-snapshot.ts [--check]
 *
 * `--check` writes nothing and exits non-zero when the committed snapshot is
 * stale, which is what makes the scheduled job able to say "nothing to do".
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const NPM_PACKAGE_URL = 'https://registry.npmjs.org/@schemd/core';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/schemd/core/releases?per_page=100';
/* The compiler's own changelog is the prose of record. GitHub Releases are cut
 * from it, so this is both the fallback when none have been published yet and
 * the check that the two never drift. */
const CHANGELOG_URL = 'https://raw.githubusercontent.com/schemd/core/main/CHANGELOG.md';
const SNAPSHOT_PATH = join(process.cwd(), 'src/lib/server/release-snapshot.json');
const FETCH_TIMEOUT_MS = 15_000;

interface SnapshotRelease {
	version: string;
	publishedAt: string;
	unpackedSize?: number;
	fileCount?: number;
	gitHead?: string;
	notes?: string;
}

interface Snapshot {
	/** How the file was produced, for whoever opens it wondering. */
	readonly source: string;
	readonly latest: string;
	readonly releases: readonly SnapshotRelease[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Newest first, by semver precedence rather than string order. */
function compareDesc(a: string, b: string): number {
	const parse = (value: string): number[] => value.split('.').map(Number);
	const left = parse(a);
	const right = parse(b);
	for (let index = 0; index < 3; index += 1) {
		const delta = (right[index] ?? 0) - (left[index] ?? 0);
		if (delta !== 0) return delta;
	}
	return 0;
}

async function fetchJson(url: string, token?: string): Promise<unknown> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, {
			signal: controller.signal,
			headers: {
				accept: 'application/json',
				...(token ? { authorization: `Bearer ${token}` } : {})
			}
		});
		if (!response.ok) throw new Error(`${url} responded ${response.status}`);
		return (await response.json()) as unknown;
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Collapse a GitHub release body into one paragraph.
 *
 * Release bodies carry headings, bullet lists, and trailing changelog links.
 * The changelog page renders one prose block per release, so the markdown
 * scaffolding is stripped and the prose is joined — anything longer than a
 * screen is cut at a sentence boundary rather than mid-word.
 */
export function summarizeNotes(body: string | undefined, limit = 900): string | undefined {
	if (!body) return undefined;
	const prose = body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/^\s*#{1,6}\s+.*$/gm, ' ')
		.replace(/^\s*[-*+]\s+/gm, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/[*_`>]/g, '')
		.replace(/\r/g, '')
		.replace(/\s*\n\s*/g, ' ')
		.replace(/\s{2,}/g, ' ')
		.trim();
	if (prose === '') return undefined;
	if (prose.length <= limit) return prose;
	const cut = prose.slice(0, limit);
	const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
	return `${lastStop > limit * 0.5 ? cut.slice(0, lastStop + 1) : `${cut.trimEnd()}…`}`;
}

async function fetchText(url: string): Promise<string> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) throw new Error(`${url} responded ${response.status}`);
		return await response.text();
	} finally {
		clearTimeout(timer);
	}
}

/**
 * Split a Keep-a-Changelog document into `version → prose`.
 *
 * Sections are `## [0.4.0] - 07/26/2026`, each carrying `### Fixed` / `###
 * Added` subheadings. The subheadings are dropped and the entries joined,
 * because the changelog page renders one paragraph per release, not a nested
 * document. An `Unreleased` section names no version and is skipped.
 */
export function parseChangelog(markdown: string): ReadonlyMap<string, string> {
	const notes = new Map<string, string>();
	const sections = markdown.split(/^## +/m).slice(1);
	for (const section of sections) {
		const heading = section.slice(0, section.indexOf('\n'));
		const version = /\[?(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)\]?/.exec(heading)?.[1];
		if (!version) continue;
		const body = summarizeNotes(section.slice(heading.length));
		if (body) notes.set(version, body);
	}
	return notes;
}

/** Build the snapshot from the registry payloads. Pure, so it is testable. */
export function buildSnapshot(
	packument: unknown,
	githubReleases: unknown,
	changelog?: string
): Snapshot {
	if (!isRecord(packument)) throw new Error('npm returned a packument that is not an object');
	const versions = isRecord(packument['versions']) ? packument['versions'] : undefined;
	const time = isRecord(packument['time']) ? packument['time'] : {};
	if (!versions) throw new Error('npm packument carries no versions map');

	/* Changelog first, then GitHub over the top: a published release body is
	 * the more deliberate text where one exists, and the changelog covers every
	 * version whether or not a release was ever cut for it. */
	const notesByTag = new Map(changelog ? parseChangelog(changelog) : []);
	if (Array.isArray(githubReleases)) {
		for (const entry of githubReleases) {
			if (!isRecord(entry)) continue;
			const tag = asString(entry['tag_name'])?.replace(/^v/, '');
			const notes = summarizeNotes(asString(entry['body']) ?? undefined);
			if (tag && notes) notesByTag.set(tag, notes);
		}
	}

	const releases: SnapshotRelease[] = [];
	for (const [version, manifest] of Object.entries(versions)) {
		if (!isRecord(manifest) || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) continue;
		const dist = isRecord(manifest['dist']) ? manifest['dist'] : undefined;
		const release: SnapshotRelease = {
			version,
			publishedAt: asString(time[version]) ?? new Date(0).toISOString()
		};
		const unpackedSize = dist ? asNumber(dist['unpackedSize']) : undefined;
		const fileCount = dist ? asNumber(dist['fileCount']) : undefined;
		const gitHead = asString(manifest['gitHead'])?.slice(0, 12);
		const notes = notesByTag.get(version);
		/* Absent fields are omitted rather than written as null: the snapshot is
		 * read as "what the registry actually reported". */
		if (unpackedSize !== undefined) release.unpackedSize = unpackedSize;
		if (fileCount !== undefined) release.fileCount = fileCount;
		if (gitHead !== undefined) release.gitHead = gitHead;
		if (notes !== undefined) release.notes = notes;
		releases.push(release);
	}
	if (releases.length === 0) throw new Error('npm reported no publishable releases');
	releases.sort((left, right) => compareDesc(left.version, right.version));

	const distTags = isRecord(packument['dist-tags']) ? packument['dist-tags'] : undefined;
	const tagged = asString(distTags?.['latest']);
	const latest =
		tagged && releases.some((release) => release.version === tagged)
			? tagged
			: releases[0]!.version;

	return {
		source:
			'Generated by scripts/sync-release-snapshot.ts from registry.npmjs.org and the GitHub releases API. Do not edit by hand.',
		latest,
		releases
	};
}

async function main(): Promise<void> {
	const check = process.argv.includes('--check');
	const token = process.env.GITHUB_TOKEN;
	const [packument, githubReleases, changelog] = await Promise.all([
		fetchJson(NPM_PACKAGE_URL),
		/* GitHub is optional enrichment: a rate limit must not fail the sync. */
		fetchJson(GITHUB_RELEASES_URL, token).catch(() => undefined),
		fetchText(CHANGELOG_URL).catch(() => undefined)
	]);
	const snapshot = buildSnapshot(packument, githubReleases, changelog);
	const next = `${JSON.stringify(snapshot, null, '\t')}\n`;
	const current = await readFile(SNAPSHOT_PATH, 'utf8').catch(() => '');

	if (current === next) {
		console.info(`Release snapshot already current: ${snapshot.releases.length} releases.`);
		return;
	}
	if (check) {
		console.error('Release snapshot is stale. Run `bun scripts/sync-release-snapshot.ts`.');
		process.exitCode = 1;
		return;
	}
	await writeFile(SNAPSHOT_PATH, next, 'utf8');
	console.info(
		`Wrote ${snapshot.releases.length} releases (latest v${snapshot.latest}) to the release snapshot.`
	);
}

if (import.meta.main) await main();
