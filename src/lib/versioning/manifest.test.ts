import { describe, expect, it } from 'vitest';
import { getVersion, isVersionId, LATEST_VERSION, versionedPath, VERSIONS } from './manifest';

describe('version manifest', () => {
	it('resolves only the reproducible stable version', () => {
		expect(VERSIONS).toHaveLength(1);
		expect(LATEST_VERSION.id).toBe('v0.2.1');
		expect(isVersionId('v0.2.1')).toBe(true);
		expect(isVersionId('v0.2.0')).toBe(false);
		expect(getVersion('v0.2.1')?.packageVersion).toBe('0.2.1');
		expect(getVersion('latest')).toBeUndefined();
	});

	it('builds canonical paths for every versioned area', () => {
		expect(versionedPath('docs', 'v0.2.1')).toBe('/docs/v0.2.1');
		expect(versionedPath('playground', 'v0.2.1')).toBe('/playground/v0.2.1');
		expect(versionedPath('simulations', 'v0.2.1')).toBe('/simulations/v0.2.1');
	});
});
