import { describe, expect, test } from 'vitest';
import { decodeWorkspaceState, encodeWorkspaceState } from './state-uri';

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
});
