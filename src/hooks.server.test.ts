import { describe, expect, test } from 'vitest';
import { legacyTarget, supersededDocsTarget } from './hooks.server';
import { WEBSITE_CORE_VERSION } from '$lib/server/registry';

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

describe('superseded patch documentation mapping', () => {
	test('maps 0.3.0 docs paths onto the current corpus with the tail preserved', () => {
		expect(supersededDocsTarget('/docs/0.3.0')).toBe(`/docs/${WEBSITE_CORE_VERSION}`);
		expect(supersededDocsTarget('/docs/0.3.0/grammar')).toBe(
			`/docs/${WEBSITE_CORE_VERSION}/grammar`
		);
	});

	test('leaves current, historical, and non-docs paths untouched', () => {
		expect(supersededDocsTarget(`/docs/${WEBSITE_CORE_VERSION}/grammar`)).toBeUndefined();
		expect(supersededDocsTarget('/docs/0.2.1/overview')).toBeUndefined();
		expect(supersededDocsTarget('/playground/0.3.0')).toBeUndefined();
	});
});
