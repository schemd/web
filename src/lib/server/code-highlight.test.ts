import { describe, expect, it } from 'vitest';

import { highlightCodeHtml, HIGHLIGHTED_LANGUAGES } from './code-highlight';
import { versionedRawSources, DOCUMENTED_VERSIONS } from './versions';

describe('highlighting', () => {
	it('tokenizes TypeScript into styled spans', () => {
		const html = highlightCodeHtml('const total: number = 1;', 'ts')!;
		expect(html).toContain('<span');
		expect(html).toContain('const');
		expect(html).toContain('total');
	});

	/*
	 * The whole reason for `defaultColor: false`: one rendering has to serve
	 * three blueprint modes, because the toggle is instant and re-highlighting
	 * on the client would mean shipping the grammars to the browser.
	 */
	it('emits one custom property per blueprint mode, not a baked colour', () => {
		/* Keyed by the mode names in `BLUEPRINT_MODES`. The light mode is `iso`;
		   calling its variable `light` once produced CSS that matched nothing. */
		const html = highlightCodeHtml('const x = 1;', 'ts')!;
		expect(html).toContain('--shiki-hud');
		expect(html).toContain('--shiki-cyanotype');
		expect(html).toContain('--shiki-iso');
	});

	it('returns only the tokens, never Shiki’s own wrapper', () => {
		const html = highlightCodeHtml('body { color: red; }', 'css')!;
		expect(html).not.toContain('<pre');
		expect(html).not.toContain('<code');
	});

	it('handles every language the corpus actually uses', () => {
		for (const lang of ['ts', 'sh', 'css', 'python']) {
			expect(highlightCodeHtml('x', lang), lang).toBeTruthy();
		}
	});

	/*
	 * `text` has nothing to tokenize, and an unknown language must fall back to
	 * escaped plain text rather than throwing — that is what every fence did
	 * before this module existed, so the failure mode is "no colour", never "no
	 * page".
	 */
	it('declines plain text and unknown languages', () => {
		expect(highlightCodeHtml('plain', 'text')).toBeUndefined();
		expect(highlightCodeHtml('x', 'brainfuck')).toBeUndefined();
		expect(highlightCodeHtml('x', undefined)).toBeUndefined();
	});
});

/*
 * The grammar set is derived from the corpus, so it can drift the moment a doc
 * introduces a language nobody registered. This is the test that makes that
 * loud: a new fence language either gets a grammar or gets added to the known
 * plain-text list on purpose.
 */
describe('the corpus stays within the registered grammars', () => {
	const PLAIN = new Set(['schemd', 'text']);

	it('uses no fence language without a grammar', () => {
		const languages = new Set<string>();
		for (const version of DOCUMENTED_VERSIONS) {
			for (const raw of Object.values(versionedRawSources(version) ?? {})) {
				for (const [, lang] of raw.matchAll(/^```([a-z]+)/gm)) languages.add(lang!);
			}
		}
		expect(languages.size).toBeGreaterThan(0);
		const unhighlighted = [...languages].filter(
			(lang) => !PLAIN.has(lang) && !HIGHLIGHTED_LANGUAGES.includes(lang)
		);
		expect(unhighlighted, 'fence languages with no registered grammar').toEqual([]);
	});
});
