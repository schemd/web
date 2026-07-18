import { describe, expect, it } from 'vitest';
import {
	DocumentationSyntaxError,
	documentationPlainText,
	documentationToc,
	escapeHtml,
	parseDocumentation,
	renderDocumentation,
	tokenizeCode
} from './parser';

const completeDocument = `<!-- schemd-doc: id=sample; label=Sample; title=Sample document; summary=A parser fixture.; category=Test; order=2 -->

<!-- schemd-section: id=syntax; eyebrow=01 / Syntax; title=Every supported block -->

Plain <unsafe> & text with \`inline\`, **strong**, *emphasis*, [internal](/docs), [anchor](#part), [mail](mailto:test@example.com), [external](https://example.com), and [unsafe](javascript:alert(1)).

### Repeated heading

### Repeated heading

- First
- Second with \`code\`

1. Ordered one
2. Ordered two

> A concise **callout**.

| Name | Value |
| :--- | ---: |
| Resistor | \`10 kΩ\` |

\`\`\`ts
import { value } from 'module';
// comment
const answer = 42;
\`\`\`

\`\`\`schemd bounds="640x240" title="Fixture"
port:IN "Input" at (60, 120) #blue
port:OUT "Output" at (580, 120) #emerald
IN.out -> OUT.in #blue [line]
\`\`\`

<!-- /schemd-section -->`;

describe('documentation parser', () => {
	it('builds a typed document, stable toc, plain-text index, and escaped HTML', () => {
		const ast = parseDocumentation(completeDocument, 'fixture.md');
		expect(ast.metadata).toEqual({
			id: 'sample',
			label: 'Sample',
			title: 'Sample document',
			summary: 'A parser fixture.',
			category: 'Test',
			order: 2
		});
		expect(ast.sections).toHaveLength(1);
		expect(documentationToc(ast)).toEqual([
			{ id: 'syntax', title: 'Every supported block', depth: 2 },
			{ id: 'repeated-heading', title: 'Repeated heading', depth: 3 },
			{ id: 'repeated-heading-2', title: 'Repeated heading', depth: 3 }
		]);
		const plain = documentationPlainText(ast);
		expect(plain).toContain('Sample document');
		expect(plain).toContain('Resistor 10 kΩ');
		expect(plain).toContain('port:IN');

		const html = renderDocumentation(ast, {
			renderSchemd: (block) => `<svg data-id="${block.id}"></svg>`
		});
		expect(html).toContain('&lt;unsafe&gt; &amp; text');
		expect(html).toContain('<strong>strong</strong>');
		expect(html).toContain('<em>emphasis</em>');
		expect(html).toContain('href="https://example.com" rel="noreferrer"');
		expect(html).toContain('[unsafe link removed]');
		expect(html).toContain('<ol>');
		expect(html).toContain('<aside class="doc-callout">');
		expect(html).toContain('<table>');
		expect(html).toContain('class="tok-keyword">import</span>');
		expect(html).toContain('<svg data-id="syntax-example-2"></svg>');
	});

	it('renders Schemd as ordinary code without a compiler callback', () => {
		const html = renderDocumentation(parseDocumentation(completeDocument));
		expect(html).not.toContain('<figure class="doc-diagram">');
		expect(html).toContain('language-schemd');
	});

	it('normalizes CRLF and preserves unmatched inline punctuation as text', () => {
		const source = `<!-- schemd-doc: id=x; label=X; title=X; summary=X; category=X; order=0 -->\r\n<!-- schemd-section: id=a; eyebrow=A; title=A -->\r\nUnmatched \`code [loose [link](no-end **strong *em.\r\n<!-- /schemd-section -->`;
		const html = renderDocumentation(parseDocumentation(source));
		expect(html).toContain('Unmatched `code [loose [link](no-end **strong *em.');
	});

	it.each([
		['missing document metadata', 'Text', 'Document must begin'],
		['malformed metadata', '<!-- schemd-doc: id -->', 'Malformed metadata field'],
		['empty metadata value', '<!-- schemd-doc: id= -->', 'requires a value'],
		['duplicate metadata', '<!-- schemd-doc: id=a; id=b -->', 'Duplicate metadata'],
		[
			'missing field',
			'<!-- schemd-doc: id=a; label=A; title=A; summary=A; order=0 -->',
			'Missing required metadata field "category"'
		],
		[
			'bad order',
			'<!-- schemd-doc: id=a; label=A; title=A; summary=A; category=A; order=-1 -->',
			'non-negative integer'
		],
		[
			'expected section',
			'<!-- schemd-doc: id=a; label=A; title=A; summary=A; category=A; order=0 -->\ntext',
			'Expected a schemd-section'
		],
		[
			'no sections',
			'<!-- schemd-doc: id=a; label=A; title=A; summary=A; category=A; order=0 -->',
			'at least one section'
		]
	])('reports %s with a source position', (_name, source, message) => {
		expect(() => parseDocumentation(source, 'broken.md')).toThrowError(message);
		try {
			parseDocumentation(source, 'broken.md');
		} catch (error) {
			expect(error).toBeInstanceOf(DocumentationSyntaxError);
			if (error instanceof DocumentationSyntaxError) {
				expect(error.sourceName).toBe('broken.md');
				expect(error.position.line).toBeGreaterThan(0);
			}
		}
	});

	it.each(['-bad', 'bad-', 'bad--id', 'Bad', 'bad_id'])('rejects invalid identifier %s', (id) => {
		const source = `<!-- schemd-doc: id=${id}; label=A; title=A; summary=A; category=A; order=0 -->`;
		expect(() => parseDocumentation(source)).toThrowError('lowercase kebab-case');
	});

	it('rejects documents beyond the allocation ceiling', () => {
		expect(() => parseDocumentation('x'.repeat(131_073))).toThrowError('exceeds 131072 characters');
		expect(() => parseDocumentation('\n\n')).toThrowError('Document must begin');
		expect(() => parseDocumentation('<!-- schemd-doc: id=a')).toThrowError('Document must begin');
	});

	it('rejects duplicate, unclosed, empty, and malformed sections', () => {
		const prefix = '<!-- schemd-doc: id=a; label=A; title=A; summary=A; category=A; order=0 -->\n';
		expect(() =>
			parseDocumentation(
				`${prefix}<!-- schemd-section: id=s; eyebrow=A; title=A -->\nText\n<!-- /schemd-section -->\n<!-- schemd-section: id=s; eyebrow=B; title=B -->\nText\n<!-- /schemd-section -->`
			)
		).toThrowError('Duplicate section id');
		expect(() =>
			parseDocumentation(`${prefix}<!-- schemd-section: id=s; eyebrow=A; title=A -->\nText`)
		).toThrowError('missing its closing comment');
		expect(() =>
			parseDocumentation(
				`${prefix}<!-- schemd-section: id=s; eyebrow=A; title=A -->\n\n<!-- /schemd-section -->`
			)
		).toThrowError('must contain content');
		expect(() =>
			parseDocumentation(
				`${prefix}<!-- schemd-section: id=s; title=A -->\nText\n<!-- /schemd-section -->`
			)
		).toThrowError('Missing required metadata field "eyebrow"');
	});

	it('rejects raw HTML, empty-language and unclosed code fences', () => {
		const wrap = (body: string) =>
			`<!-- schemd-doc: id=a; label=A; title=A; summary=A; category=A; order=0 -->\n<!-- schemd-section: id=s; eyebrow=A; title=A -->\n${body}\n<!-- /schemd-section -->`;
		expect(() => parseDocumentation(wrap('<script>alert(1)</script>'))).toThrowError('Raw HTML');
		expect(() => parseDocumentation(wrap('Text\n<script>alert(1)</script>'))).toThrowError(
			'Raw HTML'
		);
		expect(() => parseDocumentation(wrap('```\nvalue\n```'))).toThrowError('language identifier');
		expect(() => parseDocumentation(wrap('```ts\nvalue'))).toThrowError('Unclosed code fence');
	});

	it('rejects malformed tables', () => {
		const wrap = (body: string) =>
			`<!-- schemd-doc: id=a; label=A; title=A; summary=A; category=A; order=0 -->\n<!-- schemd-section: id=s; eyebrow=A; title=A -->\n${body}\n<!-- /schemd-section -->`;
		expect(() => parseDocumentation(wrap('| A | B |\n| --- |\n| x | y |'))).toThrowError(
			'divider must match'
		);
		expect(() => parseDocumentation(wrap('| A | B |\n| --- | --- |\n| x |'))).toThrowError(
			'row must match'
		);
		const prose = parseDocumentation(wrap('| A |\n| === |'));
		expect(documentationPlainText(prose)).toContain('| === |');
	});

	it('accepts empty metadata separators, boundary-less tables, mixed lists, and punctuation headings', () => {
		const source = `<!-- schemd-doc: ; id=a;; label=A; title=A; summary=A; category=A; order=0; -->
<!-- schemd-section: id=s; eyebrow=A; title=A -->
### !!!
**Starts strong** and continues.

- unordered
1. ordered

A | B
--- | ---
x | y
<!-- /schemd-section -->`;
		const ast = parseDocumentation(source);
		expect(documentationToc(ast)[1]?.id).toBe('section');
		const html = renderDocumentation(ast);
		expect(html).toContain('<ul><li>unordered</li></ul><ol><li>ordered</li></ol>');
		expect(html).toContain('<th scope="col">A</th>');
		const trailing = parseDocumentation(
			`<!-- schemd-doc: id=b; label=B; title=B; summary=B; category=B; order=0 -->\n<!-- schemd-section: id=t; eyebrow=T; title=T -->\n[loose trailing | pipe\n<!-- /schemd-section -->`
		);
		expect(documentationPlainText(trailing)).toContain('[loose trailing | pipe');
	});

	it('escapes all HTML-sensitive characters', () => {
		expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
	});

	it('tokenizes strings, escaped quotes, numbers, comments, keywords, punctuation, and plain text', () => {
		const tokens = tokenizeCode(`const value = "a\\"b"; 12.5 // note\n# comment\nplain @`);
		expect(tokens.map((token) => token.kind)).toContain('keyword');
		expect(tokens.map((token) => token.kind)).toContain('string');
		expect(tokens.map((token) => token.kind)).toContain('number');
		expect(tokens.filter((token) => token.kind === 'comment')).toHaveLength(2);
		expect(tokens.map((token) => token.kind)).toContain('punctuation');
		expect(tokens.map((token) => token.value).join('')).toBe(
			`const value = "a\\"b"; 12.5 // note\n# comment\nplain @`
		);
		expect(tokenizeCode('"unterminated')).toEqual([{ kind: 'string', value: '"unterminated' }]);
		expect(tokenizeCode('// trailing')).toEqual([{ kind: 'comment', value: '// trailing' }]);
	});
});
