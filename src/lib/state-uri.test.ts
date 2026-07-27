import { describe, expect, test } from 'vitest';
import {
	decodeWorkspaceState,
	encodeWorkspaceState,
	MAX_WORKSPACE_STATE_CHARACTERS,
	MAX_WORKSPACE_URL_CHARACTERS,
	shareableWorkspaceUrl,
	workspaceOutputMode,
	writeWorkspaceQuery
} from './state-uri';

describe('workspace URI state', () => {
	test('round-trips Unicode, plus signs, rotations, and embedded newlines', () => {
		const source = `amplifier:A "Ω + ψ" at (120,120) #cyan [orientation=down]\nA.v+ -> A.v- #blue`;
		const token = encodeWorkspaceState(source);
		expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
		expect(decodeWorkspaceState(token)).toBe(source);
	});

	test('rejects malformed base64 and invalid UTF-8', () => {
		expect(decodeWorkspaceState('%%%')).toBeUndefined();
		expect(decodeWorkspaceState('_w')).toBeUndefined();
		expect(decodeWorkspaceState('A'.repeat(180_000))).toBeUndefined();
	});

	test('enforces the compiler character limit without rejecting valid multibyte source', () => {
		const multibyte = 'ψ'.repeat(70_000);
		expect(decodeWorkspaceState(encodeWorkspaceState(multibyte))).toBe(multibyte);
		expect(
			decodeWorkspaceState(encodeWorkspaceState('x'.repeat(MAX_WORKSPACE_STATE_CHARACTERS + 1)))
		).toBeUndefined();
	});

	test('serializes every state field needed to reproduce a workspace', () => {
		const url = writeWorkspaceQuery(new URL('https://schemd.test/playground/0.3.3'), {
			source: 'port:A "A" at (80,80)',
			width: 560,
			height: 220,
			title: 'Compact CNOT',
			mode: 'embedded-css'
		});
		expect(url.searchParams.get('w')).toBe('560');
		expect(url.searchParams.get('h')).toBe('220');
		expect(url.searchParams.get('t')).toBe('Compact CNOT');
		expect(url.searchParams.get('m')).toBe('embedded-css');
		expect(decodeWorkspaceState(url.searchParams.get('code')!)).toBe('port:A "A" at (80,80)');
	});

	test('rejects unknown output modes from shared URLs', () => {
		expect(workspaceOutputMode('full')).toBe('full');
		expect(workspaceOutputMode('exploit')).toBe('full');
	});

	test('refuses brittle mega-URLs without weakening the local editor limit', () => {
		const base = new URL('https://schemd.test/playground/0.4.0?keep=1');
		const state = {
			source: 'x'.repeat(MAX_WORKSPACE_URL_CHARACTERS),
			width: 760,
			height: 440,
			title: 'Large local model',
			mode: 'full' as const
		};
		expect(shareableWorkspaceUrl(base, state)).toBeUndefined();
		expect(base.searchParams.get('keep')).toBe('1');
		expect(decodeWorkspaceState(encodeWorkspaceState(state.source))).toBe(state.source);
	});

	test('replaces stale workspace fields before applying the URL budget', () => {
		const base = new URL('https://schemd.test/playground/0.4.0?keep=1');
		base.searchParams.set('code', 'x'.repeat(MAX_WORKSPACE_URL_CHARACTERS));
		const shared = shareableWorkspaceUrl(base, {
			source: 'port:A "A" at (80,80)',
			width: 560,
			height: 220,
			title: 'Small replacement',
			mode: 'full'
		});
		expect(shared).toBeDefined();
		expect(shared?.searchParams.get('keep')).toBe('1');
		expect(decodeWorkspaceState(shared!.searchParams.get('code')!)).toBe('port:A "A" at (80,80)');
		expect(base.searchParams.get('code')).toHaveLength(MAX_WORKSPACE_URL_CHARACTERS);
	});
});
