/**
 * Syntax highlighting for the non-`schemd` fences in the documentation.
 *
 * The site has always highlighted `schemd` source — `tokenizer.ts` does that,
 * and the playground needs it in a live editor — while every other fence shipped
 * as escaped text with no token markup at all. That asymmetry was a dependency
 * gap rather than a decision: there was no general-purpose highlighter here.
 *
 * Three constraints shaped this module:
 *
 * - **Synchronous.** `renderMarkdownDoc` is sync and is called from a sync
 *   loader, so the async highlighter would have forced that whole path to
 *   become async for a cosmetic feature. `createHighlighterCoreSync` with the
 *   JavaScript regex engine avoids the WASM load that makes Shiki async.
 * - **Server only.** This module lives under `$lib/server`, so SvelteKit
 *   refuses to bundle it into the client, and the build budget already asserts
 *   no server module reaches a visitor. Grammars are megabytes; none of it
 *   ships.
 * - **Only the languages the corpus uses.** Loading Shiki's full bundle would
 *   pull hundreds of grammars to serve four. The set below is derived from the
 *   corpus and asserted by a test, so a doc that introduces a fifth language
 *   fails loudly instead of silently rendering flat.
 */
import { createHighlighterCoreSync, type HighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';

import css from 'shiki/langs/css.mjs';
import bash from 'shiki/langs/bash.mjs';
import python from 'shiki/langs/python.mjs';
import typescript from 'shiki/langs/typescript.mjs';

import vitesseDark from 'shiki/themes/vitesse-dark.mjs';
import nord from 'shiki/themes/nord.mjs';
import vitesseLight from 'shiki/themes/vitesse-light.mjs';

/**
 * Fence language → Shiki grammar.
 *
 * `text` is deliberately absent. A plain-text fence has nothing to tokenize,
 * and running it through a highlighter would wrap every line in spans that
 * carry no meaning.
 */
const GRAMMARS: Readonly<Record<string, string>> = {
	ts: 'typescript',
	typescript: 'typescript',
	js: 'typescript',
	sh: 'bash',
	bash: 'bash',
	shell: 'bash',
	css: 'css',
	python: 'python',
	py: 'python'
};

/**
 * One theme per blueprint mode, keyed by the mode's own name.
 *
 * `defaultColor: false` makes Shiki emit a CSS custom property per theme
 * instead of baking one colour in, so a single rendering serves all three modes
 * and the toggle stays instant — no re-highlight, no second copy of the markup.
 * `app.css` maps `--shiki-hud`/`--shiki-cyanotype`/`--shiki-iso` per mode. The
 * keys are the mode names from `BLUEPRINT_MODES`, not descriptions of them —
 * the light mode is called `iso`, and naming its variable `light` produced a
 * rule that matched nothing while looking correct.
 */
const THEMES = { hud: 'vitesse-dark', cyanotype: 'nord', iso: 'vitesse-light' } as const;

/** Languages a fence may use and expect to be highlighted. */
export const HIGHLIGHTED_LANGUAGES: readonly string[] = Object.freeze(Object.keys(GRAMMARS));

let highlighter: HighlighterCore | undefined;

/** Build the highlighter once per process, on first use. */
function get(): HighlighterCore {
	highlighter ??= createHighlighterCoreSync({
		themes: [vitesseDark, nord, vitesseLight],
		langs: [typescript, bash, css, python],
		engine: createJavaScriptRegexEngine()
	});
	return highlighter;
}

/** Shiki wraps its output in its own `<pre><code>`; we want only the tokens. */
const INNER = /<code[^>]*>([\s\S]*)<\/code>/;

/**
 * Highlight one fence, or return `undefined` when the language has no grammar.
 *
 * Returning `undefined` rather than throwing keeps an unknown language a
 * cosmetic outcome: the caller falls back to escaped text, which is exactly
 * what every fence rendered before this module existed.
 */
export function highlightCodeHtml(text: string, lang: string | undefined): string | undefined {
	const grammar = lang === undefined ? undefined : GRAMMARS[lang.toLowerCase()];
	if (!grammar) return undefined;

	try {
		const html = get().codeToHtml(text, {
			lang: grammar,
			themes: THEMES,
			defaultColor: false
		});
		return INNER.exec(html)?.[1];
	} catch {
		/* A grammar that fails on an edge case must not take the page down; the
		   fence renders as plain escaped text, which is still readable. */
		return undefined;
	}
}
