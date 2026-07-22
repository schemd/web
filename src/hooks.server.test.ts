import { describe, expect, test } from 'vitest';
import { applySecurityHeaders, canonicalDocsTarget, legacyTarget } from './hooks.server';
import { LATEST_DOCUMENTED_VERSION, OLDEST_DOCUMENTED_VERSION } from '$lib/server/versions';

describe('standalone legacy route mapping', () => {
	test.each([
		['/tools/schemd', '/'],
		['/tools/schemd/', '/'],
		['/tools/schemd/docs', `/docs/${OLDEST_DOCUMENTED_VERSION}/overview`],
		['/tools/schemd/docs/grammar', `/docs/${OLDEST_DOCUMENTED_VERSION}/grammar`],
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

describe('canonical docs-line mapping', () => {
	test.each([
		['/docs/0.3.2/grammar', `/docs/${LATEST_DOCUMENTED_VERSION}/grammar`],
		['/docs/0.3.0', `/docs/${LATEST_DOCUMENTED_VERSION}`],
		['/docs/0.2.1/overview', `/docs/${OLDEST_DOCUMENTED_VERSION}/overview`],
		['/docs/0.1.0/grammar', `/docs/${OLDEST_DOCUMENTED_VERSION}/grammar`],
		['/docs/9.9.9/grammar', `/docs/${LATEST_DOCUMENTED_VERSION}/grammar`],
		['/docs/latest/overview', `/docs/${LATEST_DOCUMENTED_VERSION}/overview`]
	])('canonicalizes %s to %s', (source, target) => {
		expect(canonicalDocsTarget(source)).toBe(target);
	});

	test('leaves documented lines and non-version paths untouched', () => {
		expect(canonicalDocsTarget(`/docs/${LATEST_DOCUMENTED_VERSION}/grammar`)).toBeUndefined();
		expect(canonicalDocsTarget(`/docs/${OLDEST_DOCUMENTED_VERSION}/overview`)).toBeUndefined();
		expect(canonicalDocsTarget('/docs/not-a-version')).toBeUndefined();
		expect(canonicalDocsTarget('/playground/0.3.0')).toBeUndefined();
	});
});

describe('response hardening', () => {
	test('sets browser isolation and capability headers without blocking embeds', () => {
		const response = applySecurityHeaders(new Response('ok'), true);
		expect(response.headers.get('x-content-type-options')).toBe('nosniff');
		expect(response.headers.get('permissions-policy')).toContain('camera=()');
		expect(response.headers.get('cross-origin-opener-policy')).toBe('same-origin');
		expect(response.headers.get('strict-transport-security')).toContain('includeSubDomains');
		expect(response.headers.has('x-frame-options')).toBe(false);
		expect(response.headers.has('cross-origin-resource-policy')).toBe(false);
	});

	test('does not emit HSTS over an insecure local response', () => {
		const response = applySecurityHeaders(new Response('ok'), false);
		expect(response.headers.has('strict-transport-security')).toBe(false);
	});
});
