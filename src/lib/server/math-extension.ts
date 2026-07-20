/**
 * KaTeX math extension for `marked`.
 *
 * Server-side only: `$…$` renders inline and `$$…$$` (on its own lines) renders
 * a display block, both compiled to static HTML by KaTeX so no TeX runtime ever
 * ships to the client. Mirrors the portfolio's blog math pipeline.
 */
import katex, { type KatexOptions } from 'katex';
import type { MarkedExtension, TokenizerAndRendererExtension, Tokens } from 'marked';

interface MathToken {
	type: 'inlineKatex' | 'blockKatex';
	raw: string;
	text: string;
	displayMode: boolean;
}

const INLINE_MATH = /^\$(?!\$)((?:\\.|[^\\$\n])+?)\$/;
const BLOCK_MATH = /^\$\$[ \t]*\n([\s\S]+?)\n\$\$(?:\n|$)/;

function asMathToken(token: Tokens.Generic): MathToken {
	return token as unknown as MathToken;
}

function renderMath(token: Tokens.Generic, options: KatexOptions, newline = false): string {
	const math = asMathToken(token);
	const html = katex.renderToString(math.text, {
		throwOnError: false,
		output: 'mathml',
		...options,
		displayMode: math.displayMode
	});
	return newline ? `${html}\n` : html;
}

function inlineKatex(options: KatexOptions): TokenizerAndRendererExtension {
	return {
		name: 'inlineKatex',
		level: 'inline',
		start(src: string) {
			for (let index = src.indexOf('$'); index >= 0; index = src.indexOf('$', index + 1)) {
				if (INLINE_MATH.test(src.slice(index))) return index;
			}
		},
		tokenizer(src: string) {
			const match = INLINE_MATH.exec(src);
			if (!match) return undefined;
			return { type: 'inlineKatex', raw: match[0], text: match[1]!.trim(), displayMode: false };
		},
		renderer(token: Tokens.Generic) {
			return renderMath(token, options);
		}
	};
}

function blockKatex(options: KatexOptions): TokenizerAndRendererExtension {
	return {
		name: 'blockKatex',
		level: 'block',
		tokenizer(src: string) {
			const match = BLOCK_MATH.exec(src);
			if (!match) return undefined;
			return { type: 'blockKatex', raw: match[0], text: match[1]!.trim(), displayMode: true };
		},
		renderer(token: Tokens.Generic) {
			return renderMath(token, options, true);
		}
	};
}

export default function mathExtension(options: KatexOptions = {}): MarkedExtension {
	return { extensions: [inlineKatex(options), blockKatex(options)] };
}
