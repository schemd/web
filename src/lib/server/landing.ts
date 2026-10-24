/**
 * Everything the landing sheet draws, compiled by the engine it advertises.
 *
 * The hero is one real circuit shown three ways — source, drawing and
 * netlist — linked line to wire through the compiler's own source map. The
 * family strip and the routing figures are compiled the same way, so a
 * routing change in the compiler shows up here without anyone redrawing a
 * picture. Only the 0.8 comparison is a recording, because the site runs one
 * compiler.
 */
import { buildNetlist, compileSchematic, verifyNetlist } from '@schemd/core';
import { highlightLineHtml } from '#lib/tokenizer.ts';

/** A canonical source with the fence it compiles under. */
interface Spec {
	readonly id: string;
	readonly title: string;
	readonly width: number;
	readonly height: number;
	readonly source: string;
}

export const HERO_SPEC: Spec = {
	id: 'filter',
	title: 'Active low-pass filter',
	width: 840,
	height: 600,
	source: `source:VIN "V_{in}" at (100, 230) #blue [type=voltage-ac orientation=up]
resistor:R1 "10 k\\Omega" at (240, 160) #amber
junction:N1 "V_{c}" at (360, 160) #amber
capacitor:C1 "1 nF" at (360, 260) #cyan [orientation=down]
amplifier:U1 "OPA192" at (560, 173) #purple [type=opamp]
junction:FB "V_{fb}" at (460, 290) #purple
resistor:RF "100 k\\Omega" at (620, 290) #amber
resistor:RG "10 k\\Omega" at (460, 360) #amber [orientation=down]
junction:VOUT "V_{out}" at (740, 173) #emerald
ground:G "0 V" at (360, 460) #slate
ground:G2 "0 V" at (460, 510) #slate
VIN.positive -> R1.in #blue [ortho]
R1.out -> N1.node #amber [ortho]
N1.node -> U1.positive #amber [ortho]
N1.node -> C1.in #cyan [ortho]
U1.negative -> FB.node #purple [ortho]
FB.node -> RF.in #purple [ortho]
RF.out -> VOUT.node #emerald [ortho]
U1.out -> VOUT.node #emerald [ortho]
FB.node -> RG.in #purple [ortho]
RG.out -> G2.in #slate [ortho]
C1.out -> G.in #slate [ortho]
VIN.negative -> G.in #slate [ortho]`
};

/** One drawing per family; the hero is the electrical one. */
export const FAMILY_SPECS: readonly (Spec & { readonly family: string; readonly line: string })[] =
	[
		{
			id: 'logic',
			family: 'Digital',
			title: 'Registered inverter',
			width: 660,
			height: 300,
			line: 'flipflop:FF "D-FF" at (260, 140) #purple [type=d]',
			source: `port:D "D" at (70, 110) #blue
clock:CLK "CLK" at (70, 220) #amber
flipflop:FF "D-FF" at (260, 140) #purple [type=d]
not:INV "NOT" at (430, 110) #cyan
port:Q "Q" at (590, 110) #emerald
D.out -> FF.d #blue [digital ortho]
CLK.out -> FF.clock #amber [digital ortho]
FF.q -> INV.in #purple [digital ortho]
INV.out -> Q.in #emerald [digital ortho]`
		},
		{
			id: 'quantum',
			family: 'Quantum',
			title: 'Bell pair',
			width: 660,
			height: 300,
			line: 'prepare:Q0 "|0\\rangle" at (70, 90) #blue',
			source: `prepare:Q0 "|0\\rangle" at (70, 90) #blue
prepare:Q1 "|0\\rangle" at (70, 210) #blue
hadamard:H "H" at (220, 90) #cyan
cnot:CX "CX" at (380, 150) #purple [fit=wires]
measure:M0 "M" at (560, 90) #emerald
measure:M1 "M" at (560, 210) #emerald
Q0.out -> H.in #blue [quantum]
H.out -> CX.in1 #cyan [quantum]
Q1.out -> CX.in2 #blue [quantum]
CX.out1 -> M0.in #purple [quantum]
CX.out2 -> M1.in #purple [quantum]`
		},
		{
			id: 'uml',
			family: 'UML',
			title: 'Compiler and netlist',
			width: 680,
			height: 300,
			line: 'API.right -> NET.left #slate [ortho association label="builds"]',
			source: `class:API "Compiler" at (170, 150) #blue [stereotype="entry" attributes="- limits: Limits" operations="+ compile(src): Svg;+ diagnose(src): List"]
class:NET "Netlist" at (500, 150) #emerald [attributes="- nets: Net[];- nodes: Node[]" operations="+ verify(): Report"]
API.right -> NET.left #slate [ortho association label="builds"]`
		}
	];

/** The routing explainers: three wires meeting at a junction, and a net crossing itself. */
export const FIGURE_SPECS: readonly Spec[] = [
	{
		id: 'junction',
		title: 'Wires meet at the junction',
		width: 700,
		height: 360,
		source: `resistor:R1 "a" at (200, 160) #amber
junction:N1 "V_{x}" at (360, 160) #amber
resistor:R2 "b" at (520, 160) #amber
capacitor:C1 "c" at (360, 280) #cyan [orientation=down]
R1.out -> N1.node #amber [ortho]
N1.node -> R2.in #amber [ortho]
N1.node -> C1.in #amber [ortho]`
	},
	{
		id: 'crossing',
		title: 'Bridges and dots',
		width: 720,
		height: 460,
		source: `port:A "A" at (100, 170) #amber
port:B "B" at (620, 170) #amber
port:C "C" at (100, 270) #amber
port:D "D" at (620, 270) #amber
port:T "T" at (360, 70) #amber [orientation=down]
port:U "U" at (360, 380) #amber [orientation=up]
port:S "S" at (470, 70) #blue [orientation=down]
port:Z "Z" at (470, 380) #blue [orientation=up]
A.out -> B.in #amber [ortho net=N]
C.out -> D.in #amber [ortho net=N]
T.out -> U.out #amber [ortho net=N]
S.out -> Z.out #blue [ortho]`
	}
];

export interface HeroLine {
	readonly n: number;
	readonly html: string;
}

export interface HeroNet {
	readonly id: string;
	readonly terminals: readonly string[];
	readonly lines: readonly number[];
}

export interface LandingFigures {
	readonly hero: {
		readonly title: string;
		readonly svg: string;
		readonly lines: readonly HeroLine[];
		readonly nets: readonly HeroNet[];
		readonly issues: number;
		readonly components: number;
		readonly svgBytes: number;
		/** Median of repeated warm compiles, in milliseconds. */
		readonly ms: number;
		readonly svgHead: string;
	};
	readonly families: readonly {
		readonly id: string;
		readonly family: string;
		readonly title: string;
		readonly line: string;
		readonly svg: string;
	}[];
	readonly figures: Readonly<Record<string, string>>;
}

function compile(spec: Spec, mode: 'default' | 'full') {
	return compileSchematic(spec.source, {
		bounds: { width: spec.width, height: spec.height },
		title: spec.title,
		mode,
		idPrefix: `landing-${spec.id}`
	});
}

/** The first lines of the SVG a reader would get, for the "SVG out" view. */
function svgHead(svg: string): string {
	const tags = svg.replace(/></g, '>\n<').split('\n');
	return [...tags.slice(0, 12), '…'].join('\n');
}

let cache: LandingFigures | undefined;

/** Compile every landing figure once per process; the compiler is deterministic. */
export function landingFigures(): LandingFigures {
	if (cache) return cache;
	const result = compile(HERO_SPEC, 'full');
	const timings: number[] = [];
	for (let run = 0; run < 15; run += 1) {
		const startedAt = performance.now();
		compile(HERO_SPEC, 'full');
		timings.push(performance.now() - startedAt);
	}
	timings.sort((left, right) => left - right);
	const netlist = buildNetlist(result.document);
	cache = {
		hero: {
			title: HERO_SPEC.title,
			/* Cropped to the drawn area for display; the fence keeps its margins. */
			svg: result.svg.replace(
				/viewBox="0 0 840 600" width="840" height="600"/,
				'viewBox="40 92 800 500"'
			),
			lines: HERO_SPEC.source
				.split('\n')
				.map((line, index) => ({ n: index + 1, html: highlightLineHtml(line) })),
			nets: netlist.nets.map((net) => ({
				id: net.id,
				terminals: net.terminals.map((terminal) => `${terminal.componentId}.${terminal.port}`),
				lines: [...net.lines]
			})),
			issues: verifyNetlist(netlist).length,
			components: result.metrics.components,
			svgBytes: result.metrics.svgBytes,
			ms: Math.round(timings[Math.floor(timings.length / 2)]! * 100) / 100,
			svgHead: svgHead(compile(HERO_SPEC, 'default').svg)
		},
		families: FAMILY_SPECS.map((spec) => ({
			id: spec.id,
			family: spec.family,
			title: spec.title,
			line: spec.line,
			svg: compile(spec, 'default').svg
		})),
		figures: Object.fromEntries(FIGURE_SPECS.map((spec) => [spec.id, compile(spec, 'default').svg]))
	};
	return cache;
}
