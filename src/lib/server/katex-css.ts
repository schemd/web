import type { Plugin } from 'vite';

const LEGACY_FONT_SOURCE = /,url\([^)]+\.(?:woff|ttf)\) format\("(?:woff|truetype)"\)/g;

/** Keep the modern WOFF2 source and remove two redundant legacy payloads per font. */
export function optimizeKatexCss(source: string): string {
	return source.replace(LEGACY_FONT_SOURCE, '').replace(/font-display:block/g, 'font-display:swap');
}

/** Vite transform applied before CSS URL discovery, preventing legacy fonts from entering the graph. */
export function katexModernFonts(): Plugin {
	return {
		name: 'schemd-katex-modern-fonts',
		enforce: 'pre',
		transform(source, id) {
			const path = id.split('?', 1)[0]!.replace(/\\/g, '/');
			if (!path.endsWith('/katex/dist/katex.min.css')) return;
			return { code: optimizeKatexCss(source), map: null };
		}
	};
}
