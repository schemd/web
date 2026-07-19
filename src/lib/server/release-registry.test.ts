import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	fetchReleaseRegistry,
	githubReleases,
	githubLatestVersion,
	npmLatestVersion,
	npmReleases,
	releaseSnapshot,
	RELEASE_LINKS
} from './release-registry';

afterEach(() => vi.unstubAllGlobals());

describe('release registry boundary', () => {
	it('reads npm and GitHub release payloads defensively', () => {
		expect(npmLatestVersion({ 'dist-tags': { latest: '0.2.1' } })).toBe('0.2.1');
		expect(npmLatestVersion(null)).toBeUndefined();
		expect(npmLatestVersion({ 'dist-tags': null })).toBeUndefined();
		expect(npmLatestVersion({ 'dist-tags': { latest: 2 } })).toBeUndefined();
		expect(
			githubLatestVersion([
				{ draft: true, tag_name: 'v9' },
				{ prerelease: true, tag_name: 'v8' },
				{ tag_name: 'v0.2.1' }
			])
		).toBe('0.2.1');
		expect(githubLatestVersion({})).toBeUndefined();
		expect(githubLatestVersion([null, { tag_name: 2 }])).toBeUndefined();
	});

	it('distinguishes network, fallback, and forward compatibility states', () => {
		expect(releaseSnapshot({ 'dist-tags': { latest: '0.2.1' } }, undefined)).toEqual({
			registryLatest: '0.2.1',
			supportedLatest: '0.2.1',
			source: 'network',
			releases: []
		});
		expect(releaseSnapshot(undefined, undefined)).toEqual({
			registryLatest: '0.2.1',
			supportedLatest: '0.2.1',
			source: 'verified-fallback',
			releases: []
		});
		expect(releaseSnapshot({ 'dist-tags': { latest: '0.3.0' } }, undefined)).toEqual({
			registryLatest: '0.3.0',
			supportedLatest: '0.2.1',
			source: 'network',
			releases: [],
			compatibilityNotice:
				'Registry 0.3.0 is newer than the reproducible 0.2.1 documentation artifact.'
		});
		expect(RELEASE_LINKS.npm).toContain('npmjs.com');
		expect(RELEASE_LINKS.github).toContain('github.com');
	});

	it('normalises, validates, merges, and bounds registry release assets', () => {
		const npm = npmReleases({
			versions: {
				'0.2.1': {
					dist: {
						tarball: 'https://registry.npmjs.org/core/-/core-0.2.1.tgz',
						unpackedSize: 12_345
					}
				},
				'0.2.0': { dist: { tarball: 'http://insecure.example/core.tgz', unpackedSize: -1 } },
				'0.1.0': {},
				broken: null
			},
			time: { '0.2.1': '2026-07-17T00:00:00.000Z' }
		});
		expect(npm).toEqual([
			{
				version: '0.2.1',
				publishedAt: '2026-07-17T00:00:00.000Z',
				npmTarball: 'https://registry.npmjs.org/core/-/core-0.2.1.tgz',
				npmUnpackedBytes: 12_345,
				assets: []
			},
			{ version: '0.2.0', assets: [] },
			{ version: '0.1.0', assets: [] }
		]);
		expect(npmReleases(null)).toEqual([]);
		expect(npmReleases({ versions: null })).toEqual([]);

		const github = githubReleases([
			{
				tag_name: 'v0.2.1',
				published_at: '2026-07-18T00:00:00.000Z',
				html_url: 'https://github.com/schemd/core/releases/tag/v0.2.1',
				assets: [
					{
						name: 'core.tgz',
						browser_download_url: 'https://github.com/schemd/core/core.tgz',
						size: 4_096
					},
					{ name: 'unsafe', browser_download_url: 'javascript:alert(1)', size: 1 },
					{ name: 'malformed', browser_download_url: 'not a url', size: 1 },
					null
				]
			},
			{ tag_name: 'v0.3.0', draft: true },
			{ tag_name: 2 },
			null
		]);
		expect(github).toEqual([
			{
				version: '0.2.1',
				publishedAt: '2026-07-18T00:00:00.000Z',
				githubUrl: 'https://github.com/schemd/core/releases/tag/v0.2.1',
				assets: [
					{
						name: 'core.tgz',
						url: 'https://github.com/schemd/core/core.tgz',
						bytes: 4_096
					}
				]
			}
		]);
		expect(githubReleases({})).toEqual([]);

		const merged = releaseSnapshot(
			{
				'dist-tags': { latest: '0.2.1' },
				versions: {
					'0.2.1': {
						dist: {
							tarball: 'https://registry.npmjs.org/core/-/core.tgz',
							unpackedSize: 10
						}
					}
				},
				time: { '0.2.1': '2026-07-17T00:00:00.000Z' }
			},
			[
				{
					tag_name: 'v0.2.1',
					html_url: 'https://github.com/schemd/core/releases/tag/v0.2.1',
					assets: []
				}
			]
		);
		expect(merged.releases).toEqual([
			{
				version: '0.2.1',
				publishedAt: '2026-07-17T00:00:00.000Z',
				npmTarball: 'https://registry.npmjs.org/core/-/core.tgz',
				npmUnpackedBytes: 10,
				githubUrl: 'https://github.com/schemd/core/releases/tag/v0.2.1',
				assets: []
			}
		]);

		const manyVersions = Object.fromEntries(
			Array.from({ length: 25 }, (_, index) => [`0.0.${index}`, { dist: {} }])
		);
		expect(releaseSnapshot({ versions: manyVersions }, undefined).releases).toHaveLength(20);
	});

	it('fetches both registries and falls back when either boundary fails', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ 'dist-tags': { latest: '0.2.1' } }), { status: 200 })
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ tag_name: 'v0.2.1' }]), { status: 200 })
			);
		vi.stubGlobal('fetch', fetchMock);
		expect((await fetchReleaseRegistry()).source).toBe('network');
		expect(fetchMock).toHaveBeenCalledTimes(2);

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('unavailable', { status: 503 })));
		expect(await fetchReleaseRegistry()).toEqual({
			registryLatest: '0.2.1',
			supportedLatest: '0.2.1',
			source: 'verified-fallback',
			releases: []
		});
	});
});
