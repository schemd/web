import { describe, expect, test } from 'vitest';
import { legacyTarget } from './hooks.server';

describe('standalone legacy route mapping', () => {
	test.each([
		['/tools/schemd', '/'],
		['/tools/schemd/', '/'],
		['/tools/schemd/docs', '/docs/0.2.1/overview'],
		['/tools/schemd/docs/grammar', '/docs/0.2.1/grammar'],
		['/tools/schemd/playground', '/playground/0.2.1'],
		['/tools/schemd/simulations', '/simulations/0.2.1']
	])('maps %s to %s', (source, target) => {
		expect(legacyTarget(source)).toBe(target);
	});

	test('does not swallow unknown legacy descendants', () => {
		expect(legacyTarget('/tools/schemd/unknown')).toBeUndefined();
		expect(legacyTarget('/tools/schemd/docs/grammar/child')).toBeUndefined();
	});
});
