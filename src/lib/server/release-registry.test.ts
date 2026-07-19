import { describe, expect, test, vi } from 'vitest';
import { getReleaseRegistry } from './release-registry';

describe('release registry cache', () => {
	test('coalesces concurrent refreshes into one bounded npm/GitHub pair', async () => {
		const npmPayload = {
			'dist-tags': { latest: '0.2.1' },
			versions: {
				'0.2.1': {
					gitHead: 'abcdef1234567',
					dist: {
						tarball: 'https://registry.npmjs.org/@schemd/core/-/core-0.2.1.tgz',
						unpackedSize: 12_345
					}
				}
			},
			time: { '0.2.1': '2026-07-17T19:15:34-07:00' }
		};
		const githubPayload = [
			{
				tag_name: 'v0.2.1',
				draft: false,
				prerelease: false,
				published_at: '2026-07-17T19:15:34-07:00',
				html_url: 'https://github.com/schemd/core/releases/tag/v0.2.1',
				target_commitish: 'abcdef1234567',
				assets: []
			}
		];
		const fetcher = vi.fn(
			async (input: RequestInfo | URL): Promise<Response> =>
				new Response(
					JSON.stringify(
						String(input).startsWith('https://registry.npmjs.org') ? npmPayload : githubPayload
					),
					{ headers: { 'content-type': 'application/json' } }
				)
		);

		const [first, second] = await Promise.all([
			getReleaseRegistry(fetcher, 1_000),
			getReleaseRegistry(fetcher, 1_000)
		]);

		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(first).toBe(second);
		expect(first.source).toBe('network');
		expect(first.releases[0]).toMatchObject({
			version: '0.2.1',
			npmUnpackedBytes: 12_345,
			gitHash: 'abcdef1234567'
		});
	});

	test('uses a verified finite fallback after the stale window', async () => {
		const offline = vi.fn(async (): Promise<Response> => {
			throw new Error('offline');
		});
		const result = await getReleaseRegistry(offline, 100_000_000);

		expect(offline).toHaveBeenCalledTimes(2);
		expect(result.source).toBe('fallback');
		expect(result.registryLatest).toBe('0.2.1');
		expect(result.releases).toHaveLength(6);
	});
});
