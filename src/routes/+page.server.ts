import type { PageServerLoad } from './$types';
import { compileSchematic, parseSchematicFence, SCHEMATIC_LIMITS } from '@schemd/core';
import { getRegistry } from '$lib/server/registry';
import { highlightSourceHtml } from '$lib/tokenizer';

/** The hero schematic — compiled live by @schemd/core on every cold start. */
const HERO_SOURCE = `// A mixed-signal input stage, written as text
port:VIN "V_{in}" at (60, 90) #blue
resistor:R1 "10 k\\Omega" at (220, 90) #amber
capacitor:C1 "100 nF" at (380, 90) #cyan
nand:N1 "N1" at (560, 150) #purple
port:OUT "Q" at (700, 150) #emerald
ground:G1 "0 V" at (380, 220) #slate

VIN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> N1.in1 #cyan [ortho]
C1.out -> G1.in #slate [ortho]
N1.out -> OUT.in #purple [ortho arrow]`;

/** Cache the compiled hero per process — the compiler is deterministic. */
let heroCache:
	| { svg: string; sourceHtml: string; metrics: Record<string, number>; ms: number }
	| undefined;

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	if (!heroCache) {
		const fence = parseSchematicFence('schemd bounds="760x340" title="Mixed-signal input stage"');
		if (!fence) throw new Error('Unreachable: hero fence is canonical.');
		const startedAt = performance.now();
		const compiled = compileSchematic(HERO_SOURCE, {
			...fence,
			mode: 'full',
			idPrefix: 'hero'
		});
		heroCache = {
			svg: compiled.svg,
			sourceHtml: highlightSourceHtml(HERO_SOURCE),
			metrics: { ...compiled.metrics },
			ms: Math.max(1, Math.round(performance.now() - startedAt))
		};
	}
	return {
		hero: heroCache,
		limits: { ...SCHEMATIC_LIMITS },
		latest: registry.latest,
		releaseCount: registry.releases.length
	};
};
