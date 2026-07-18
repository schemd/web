import { describe, expect, it } from 'vitest';
import { insertIndent, tokenizeWorkspaceLine, workspaceLines } from './workspace';

describe('playground workspace rendering', () => {
	it('tokenizes Schemd source without interpreting it as HTML', () => {
		const tokens = tokenizeWorkspaceLine(
			'resistor:R1 "10 k\\Omega" at (240, 90) #amber [value=10]'
		);
		expect(tokens.map((token) => token.kind)).toContain('kind');
		expect(tokens.map((token) => token.kind)).toContain('identifier');
		expect(tokens.map((token) => token.kind)).toContain('string');
		expect(tokens.map((token) => token.kind)).toContain('number');
		expect(tokens.map((token) => token.kind)).toContain('attribute');
		expect(tokens.map((token) => token.value).join('')).toBe(
			'resistor:R1 "10 k\\Omega" at (240, 90) #amber [value=10]'
		);
		expect(tokenizeWorkspaceLine('  // comment')).toEqual([
			{ kind: 'comment', value: '  // comment' }
		]);
		expect(tokenizeWorkspaceLine('# comment')).toEqual([{ kind: 'comment', value: '# comment' }]);
		expect(tokenizeWorkspaceLine('A.out -> B.in')).toContainEqual({
			kind: 'operator',
			value: '->'
		});
		expect(tokenizeWorkspaceLine('port:A "unterminated')).toContainEqual({
			kind: 'string',
			value: '"unterminated'
		});
	});

	it('builds stable one-based lines including an empty final line', () => {
		expect(workspaceLines('A\n')).toEqual([
			{ number: 1, tokens: [{ kind: 'kind', value: 'A' }] },
			{ number: 2, tokens: [] }
		]);
	});

	it('inserts a bounded indentation and rejects invalid selections', () => {
		expect(insertIndent('abcd', 1, 3)).toEqual({
			source: 'a  d',
			selectionStart: 3,
			selectionEnd: 3
		});
		expect(insertIndent('ab', 1, 1, 4)).toEqual({
			source: 'a    b',
			selectionStart: 5,
			selectionEnd: 5
		});
		expect(() => insertIndent('a', -1, 0)).toThrowError('valid source range');
		expect(() => insertIndent('a', 1, 0)).toThrowError('valid source range');
		expect(() => insertIndent('a', 0, 2)).toThrowError('valid source range');
		expect(() => insertIndent('a', 0.5, 1)).toThrowError('valid source range');
		expect(() => insertIndent('a', 0, 0, 0)).toThrowError('1 through 8');
		expect(() => insertIndent('a', 0, 0, 9)).toThrowError('1 through 8');
	});
});
