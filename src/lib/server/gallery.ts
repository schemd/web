/**
 * Example gallery: every `schemd` fence in the documentation, compiled once per
 * process into a static thumbnail with a deep link that reopens it in the
 * playground. A browsable, SEO-friendly index of what the language can draw.
 */
import { compileSchematic, parseSchematicFence } from '@schemd/core';
import { encodeWorkspaceState } from '$lib/state-uri';
import { latestRawSources } from './versions';
import { fencedDiagrams } from '$lib/schemd-fence';
import { describedDiagram } from './schemd-figure';

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

const BOUNDS = /bounds="(\d+)x(\d+)"/;

/** Always build the gallery from the latest documented corpus. */
const docSources = latestRawSources();

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
		for (const { spec, source, ordinal } of fencedDiagrams(raw)) {
			const fence = parseSchematicFence(spec);
			if (!fence) continue;
			const id = `${slug}-${ordinal}`;
			try {
				const compiled = compileSchematic(source, { ...fence, mode: 'default', idPrefix: id });
				const bounds = BOUNDS.exec(spec);
				items.push({
					id,
					title: fence.title,
					doc: slug,
					source,
					svg: describedDiagram(compiled),
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
