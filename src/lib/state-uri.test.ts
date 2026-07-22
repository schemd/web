import { describe, expect, test } from 'vitest';
import {
	decodeWorkspaceState,
	encodeWorkspaceState,
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
});
