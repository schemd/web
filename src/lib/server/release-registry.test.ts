import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	fetchReleaseRegistry,
	githubLatestVersion,
	npmLatestVersion,
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
			source: 'network'
		});
		expect(releaseSnapshot(undefined, undefined)).toEqual({
			registryLatest: '0.2.1',
			supportedLatest: '0.2.1',
			source: 'verified-fallback'
		});
		expect(releaseSnapshot({ 'dist-tags': { latest: '0.3.0' } }, undefined)).toEqual({
			registryLatest: '0.3.0',
			supportedLatest: '0.2.1',
			source: 'network',
			compatibilityNotice:
				'Registry 0.3.0 is newer than the reproducible 0.2.1 documentation artifact.'
		});
		expect(RELEASE_LINKS.npm).toContain('npmjs.com');
		expect(RELEASE_LINKS.github).toContain('github.com');
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
			source: 'verified-fallback'
		});
	});
});
