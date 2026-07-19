import { compileSchematic } from '@schemd/core';
import type { PageServerLoad } from './$types';

const HERO_SOURCE = `port:VIN "sensor" at (74, 240) #blue
resistor:R1 "10 k\\Omega" at (230, 240) #amber
capacitor:C1 "100 nF" at (400, 240) #cyan
nand:G1 "threshold" at (585, 240) #purple
cnot:Q1 "control" at (755, 240) #emerald

VIN.out -> R1.in #blue [ortho]
R1.out -> C1.in #amber [ortho]
C1.out -> G1.in1 #cyan [ortho]
G1.out -> Q1.control #purple [ortho]`;

export const load: PageServerLoad = () => {
	const compilation = compileSchematic(HERO_SOURCE, {
		bounds: { width: 920, height: 480 },
		title: 'Cross-domain signal pipeline',
		mode: 'embedded-css',
		idPrefix: 'landing-signal'
	});

	return {
		hero: {
			source: HERO_SOURCE,
			svg: compilation.svg,
			metrics: compilation.metrics
		}
	};
};
