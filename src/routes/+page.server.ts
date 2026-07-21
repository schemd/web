import type { PageServerLoad } from './$types';
import { compileSchematic, parseSchematicFence, SCHEMATIC_LIMITS } from '@schemd/core';
import { getRegistry } from '$lib/server/registry';
import { highlightSourceHtml } from '$lib/tokenizer';

/** One compiled hero specimen — proof the same grammar spans every domain. */
interface HeroSpec {
	readonly id: string;
	readonly domain: string;
	readonly title: string;
	readonly bounds: string;
	readonly source: string;
}

export const _HERO_SPECS: readonly HeroSpec[] = [
	{
		id: 'circuit',
		domain: 'Analog',
		title: 'Mixed-signal input stage',
		bounds: '760x440',
		source: `// Native source + junction + physically rotated shunt capacitor
source:VIN "V_{in}" at (80, 120) #blue [type=voltage-ac]
initial:P1 "V" at (34, 310) #red 
resistor:R1 "10 k\Omega" at (260, 120) #amber
junction:VOUT "output node" at (440, 120) #cyan
capacitor:C1 "100 nF" at (440, 250) #cyan [orientation=down]
ground:GND "0 V" at (220, 350) #slate
port:OUT "V_{out}" at (680, 120) #emerald

VIN.positive -> R1.in #blue [line]
VIN.negative -> P1.in #slate [ortho]
P1.out -> GND.in #silver [ortho]
R1.out -> VOUT.node #amber [line]
VOUT.node -> C1.in #cyan [ortho]
C1.out -> GND.in #cyan [ortho]
VOUT.node -> OUT.in #emerald [line marker-end=arrow]`
	},
	{
		id: 'logic',
		domain: 'Digital',
		title: 'Half adder',
		bounds: '620x340',
		source: `// A half adder — sum and carry from two bits
port:A "A" at (60, 80) #blue
port:B "B" at (60, 240) #blue
xor:X1 "XOR" at (300, 110) #cyan [inputs=2 outputs=1]
and:A1 "AND" at (300, 250) #amber [inputs=2 outputs=1]
port:S "Sum" at (540, 110) #emerald
port:C "Carry" at (540, 250) #emerald

A.out -> X1.in1 #blue [ortho]
B.out -> X1.in2 #blue [ortho]
A.out -> A1.in1 #blue [ortho]
B.out -> A1.in2 #blue [ortho]
X1.out -> S.in #cyan [line marker-end=arrow]
A1.out -> C.in #amber [line marker-end=arrow]`
	},
	{
		id: 'quantum',
		domain: 'Quantum',
		title: 'Bell-state preparation',
		bounds: '780x320',
		source: `// Bell-state preparation: H then CNOT
port:Q0 "q_0 = |0〉" at (70, 90) #blue
port:Q1 "q_1 = |0〉" at (70, 240) #blue
hadamard:H1 "H" at (300, 90) #purple
cnot:CX "CNOT" at (500, 165) #cyan
port:M0 "|\\Phi^+〉" at (700, 90) #emerald
port:M1 "meter" at (700, 240) #emerald

Q0.out -> H1.in #blue [line]
H1.out -> CX.control #purple [ortho]
Q1.out -> CX.target #blue [ortho]
CX.out -> M0.in #cyan [ortho marker-end=arrow]
CX.out -> M1.in #cyan [ortho]`
	},
	{
		id: 'uml',
		domain: 'UML',
		title: 'Order model',
		bounds: '820x420',
		source: `// The same grammar describes structure, too
class:Order "Order" at (150, 150) #blue [attributes="- id: UUID; - total: Money" operations="+ submit(): void"]
class:LineItem "LineItem" at (580, 150) #emerald [attributes="- quantity: number"]
note:Rule "An order owns its items" at (360, 330) #amber [width=200]

Order.right -> LineItem.left #emerald [ortho composition label="contains"]
Rule.top -> Order.bottom #amber [ortho dependency]`
	}
];

export interface CompiledHero {
	readonly id: string;
	readonly domain: string;
	readonly title: string;
	readonly svg: string;
	readonly sourceHtml: string;
	readonly metrics: Record<string, number>;
	readonly ms: number;
}

/** Cache the compiled heroes per process — the compiler is deterministic. */
let heroesCache: readonly CompiledHero[] | undefined;

export function _compileHeroes(): readonly CompiledHero[] {
	if (heroesCache) return heroesCache;
	heroesCache = _HERO_SPECS.map((spec) => {
		const fence = parseSchematicFence(`schemd bounds="${spec.bounds}" title="${spec.title}"`);
		if (!fence) throw new Error(`Unreachable: canonical hero fence for ${spec.id}.`);
		const startedAt = performance.now();
		const compiled = compileSchematic(spec.source, {
			...fence,
			mode: 'full',
			idPrefix: `hero-${spec.id}`
		});
		return {
			id: spec.id,
			domain: spec.domain,
			title: spec.title,
			svg: compiled.svg,
			sourceHtml: highlightSourceHtml(spec.source),
			metrics: { ...compiled.metrics },
			ms: Math.max(1, Math.round(performance.now() - startedAt))
		};
	});
	return heroesCache;
}

export const load: PageServerLoad = async () => {
	const registry = await getRegistry();
	return {
		heroes: _compileHeroes(),
		limits: { ...SCHEMATIC_LIMITS },
		latest: registry.latest,
		releaseCount: registry.releases.length
	};
};
