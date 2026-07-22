import { describe, expect, test } from 'vitest';
import { optimizeKatexCss } from './katex-css';

describe('KaTeX delivery transform', () => {
	test('ships WOFF2 only and avoids invisible block text', () => {
		const css =
			'@font-face{font-display:block;src:url(a.woff2) format("woff2"),url(a.woff) format("woff"),url(a.ttf) format("truetype")}';
		const optimized = optimizeKatexCss(css);
		expect(optimized).toContain('url(a.woff2)');
		expect(optimized).not.toContain('.woff)');
		expect(optimized).not.toContain('.ttf)');
		expect(optimized).toContain('font-display:swap');
	});
});
