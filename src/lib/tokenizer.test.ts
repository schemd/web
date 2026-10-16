import { describe, expect, test } from 'vitest';

import { highlightLineHtml, tokenizeLine } from './tokenizer';

/** The source text survives tokenizing byte for byte, whatever the classification. */
function roundTrips(line: string): void {
	expect(
		tokenizeLine(line)
			.tokens.map((token) => token.text)
			.join('')
	).toBe(line);
}

describe('sub-circuit syntax (0.8)', () => {
	test('a header names the block and keeps its parameters as options', () => {
		const line = 'subcircuit divider [top="10 k" bottom] {';
		roundTrips(line);
		expect(highlightLineHtml(line)).toBe(
			'<span class="tok-keyword">subcircuit</span> <span class="tok-kind">divider</span> <span class="tok-punct">[</span><span class="tok-option">top=</span><span class="tok-string">"10 k"</span> <span class="tok-option">bottom</span><span class="tok-punct">]</span> <span class="tok-punct">{</span>'
		);
	});

	test('an instance reads like a component without a label', () => {
		const line = '  divider:U1 at (200, 100) [top="22 k"]';
		roundTrips(line);
		const { tokens, kind } = tokenizeLine(line);
		expect(kind).toBe('component');
		expect(
			tokens.filter((token) => token.cls !== undefined).map((token) => [token.cls, token.text])
		).toEqual([
			['kind', 'divider'],
			['punct', ':'],
			['id', 'U1'],
			['keyword', 'at'],
			['punct', '('],
			['number', '200'],
			['punct', ','],
			['number', '100'],
			['punct', ')'],
			['punct', '['],
			['option', 'top='],
			['string', '"22 k"'],
			['punct', ']']
		]);
	});

	test('an exposed terminal and a closing brace are classified', () => {
		const exposure = '  expose mid = RT.out';
		roundTrips(exposure);
		expect(highlightLineHtml(exposure)).toBe(
			'  <span class="tok-keyword">expose</span> <span class="tok-kind">mid</span> <span class="tok-punct">=</span> <span class="tok-id">RT</span><span class="tok-punct">.</span><span class="tok-kind">out</span>'
		);
		roundTrips('}');
		expect(highlightLineHtml('}')).toBe('<span class="tok-punct">}</span>');
	});

	test('a component line with a label is still a component, not an instance', () => {
		const line = 'resistor:R1 "1 k" at (10, 20) #amber';
		roundTrips(line);
		expect(tokenizeLine(line).tokens[2]).toEqual({ text: 'R1', cls: 'id' });
	});
});
