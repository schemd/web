/**
 * Example gallery: every `schemd` fence in the documentation, compiled once per
 * process into a static thumbnail with a deep link that reopens it in the
 * playground. A browsable, SEO-friendly index of what the language can draw.
 */
import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { encodeWorkspaceState } from '$lib/state-uri';

export interface GalleryItem {
	readonly id: string;
	readonly title: string;
	readonly doc: string;
	readonly source: string;
	readonly svg: string;
	readonly code: string;
	readonly width: number;
	readonly height: number;
}

const SCHEMD_FENCE = /```(schemd[^\n]*)\n([\s\S]*?)\n```/g;
const BOUNDS = /bounds="(\d+)x(\d+)"/;

const docSources = import.meta.glob<string>('$lib/content/schemd/0.3.0/*.md', {
	query: '?raw',
	import: 'default',
	eager: true
});

function docSlug(path: string): string {
	return path.split('/').pop()!.replace(/\.md$/, '');
}

let cache: readonly GalleryItem[] | undefined;

/** Compile every documentation fence into a gallery thumbnail (cached). */
export function loadGallery(): readonly GalleryItem[] {
	if (cache) return cache;

	const items: GalleryItem[] = [];
	for (const [path, raw] of Object.entries(docSources)) {
		const slug = docSlug(path);
		if (slug === 'tone1' || slug === 'tone2') continue;
		let index = 0;
		for (const match of raw.matchAll(SCHEMD_FENCE)) {
			const fence = parseSchematicFence(match[1]!.trim());
			if (!fence) continue;
			const source = match[2]!.trim();
			index += 1;
			const id = `${slug}-${index}`;
			try {
				const compiled = compileSchematic(source, { ...fence, mode: 'default', idPrefix: id });
				const bounds = BOUNDS.exec(match[1]!);
				items.push({
					id,
					title: fence.title,
					doc: slug,
					source,
					svg: compiled.svg,
					code: encodeWorkspaceState(source),
					width: Number(bounds?.[1] ?? 640),
					height: Number(bounds?.[2] ?? 320)
				});
			} catch {
				/* A doc fence that fails to compile is caught by the docs build; skip here. */
			}
		}
	}
	cache = items;
	return cache;
}
