/** Reviewed starting points for core 1.3 and later. Each is compiled in CI. */
import { compileSchematic } from '@schemd/core';
import { translator, type Locale } from '#lib/i18n/index.ts';
import { messagesFor } from './message-catalog.ts';
import { writeWorkspaceQuery } from '#lib/state-uri.ts';

export const TEMPLATE_CORE_LINE = '1.3';
export const STARTER_TEMPLATES = [
	{
		id: 'rc-ladder',
		family: 'electrical',
		title: 'RC ladder',
		description: 'Two passive RC stages with supply and return.',
		width: 980,
		height: 480,
		source:
			'port:VIN "V_{in}" at (90, 120) #blue\nresistor:R1 "1 k\\Omega" at (250, 120) #amber\njunction:N1 at (400, 120) #cyan\ncapacitor:C1 "100 nF" at (400, 260) #cyan [orientation=down]\nresistor:R2 "10 k\\Omega" at (560, 120) #amber\njunction:N2 at (710, 120) #cyan\ncapacitor:C2 "10 nF" at (710, 260) #cyan [orientation=down]\nport:VOUT "V_{out}" at (880, 120) #emerald\nground:G1 at (560, 400) #slate\n\nVIN.out -> R1.in #blue [ortho]\nR1.out -> N1.node #amber [ortho]\nN1.node -> C1.in #cyan [ortho]\nN1.node -> R2.in #cyan [ortho]\nR2.out -> N2.node #amber [ortho]\nN2.node -> C2.in #cyan [ortho]\nN2.node -> VOUT.in #emerald [ortho marker-end=arrow]\nC1.out -> G1.in #slate [ortho]\nC2.out -> G1.in #slate [ortho]'
	},
	{
		id: 'zener-reference',
		family: 'electrical',
		title: 'Zener reference',
		description: 'A vertical Zener reference.',
		width: 800,
		height: 720,
		source:
			'source:VS "9 V" at (380, 90) #blue [type=voltage-dc orientation=down]\nresistor:RZ "1 k\\Omega" at (380, 240) #amber [orientation=down]\njunction:JZ at (380, 360) #cyan\ndiode:DZ "5.1 V" at (380, 490) #rose [type=zener orientation=up]\nport:REF "V_{ref}" at (660, 360) #emerald\nground:GZ at (380, 640) #slate\n\nVS.positive -> RZ.in #blue [ortho]\nRZ.out -> JZ.node #amber [ortho]\nJZ.node -> DZ.cathode #rose [ortho]\nJZ.node -> REF.in #emerald [ortho marker-end=arrow]\nDZ.anode -> GZ.in #slate [ortho]'
	},
	{
		id: 'lc-filter',
		family: 'electrical',
		title: 'LC filter',
		description:
			'Two LC stages are declared as reusable subcircuits, so each stage can be placed and connected independently.',
		width: 900,
		height: 540,
		source:
			'subcircuit lc [l="10 \\mu H" c="100 nF"] {\n  inductor:L "{{l}}" at (0, 0) #purple\n  junction:N right-of L by 50 #cyan\n  capacitor:C "{{c}}" below N by 50 aligned-x with N #cyan [orientation=down]\n  L.out -> N.node #purple [ortho]\n  N.node -> C.in #cyan [ortho]\n  expose in = L.in\n  expose out = N.node\n  expose gnd = C.out\n}\n\nsource:SW "V_{sw}" at (90, 160) #blue [type=voltage-pulse]\nlc:F1 at (260, 160)\nlc:F2 at (540, 160) [l="4.7 \\mu H" c="47 nF"]\nport:VF "V_{f}" at (820, 160) #emerald\nground:GND "0 V" at (420, 450) #slate\n\nSW.positive -> F1.in #blue [ortho]\nF1.out -> F2.in #cyan [ortho]\nF2.out -> VF.in #emerald [ortho]\nSW.negative -> GND.in #slate [ortho]\nF1.gnd -> GND.in #slate [ortho]\nF2.gnd -> GND.in #slate [ortho]'
	},
	{
		id: 'high-pass',
		family: 'electrical',
		title: 'High-pass filter',
		description: 'A capacitor and resistor form a high-pass signal path.',
		width: 840,
		height: 380,
		source:
			'source:SRC5 "AC" at (80, 120) #blue [type=voltage-ac]\ncapacitor:CS5 "C" at (280, 120) #cyan\njunction:JN5 at (460, 120) #cyan\nresistor:RS5 "R" at (460, 240) #amber [orientation=down]\nport:VO5 "out" at (720, 120) #emerald\n\nSRC5.positive -> CS5.in #blue [ortho]\nCS5.out -> JN5.node #cyan [ortho]\nJN5.node -> RS5.in #amber [ortho]\nJN5.node -> VO5.in #emerald [ortho]'
	},
	{
		id: 'counter',
		family: 'digital',
		title: 'Counter datapath',
		description: 'Digital blocks connected through named terminals.',
		width: 1140,
		height: 460,
		source:
			'port:PULSE "pulses" at (80, 130) #blue\nbuffer:SH7 "clean" at (280, 130) #cyan [type=schmitt]\ncounter:CT7 "count" at (500, 150) #amber\nport:LIM "limit" at (80, 330) #amber\ncomparator:CM7 "N = limit" at (760, 250) #purple\nport:DONE "batch done" at (1040, 250) #emerald\n\nPULSE.out -> SH7.in1 #blue [digital ortho]\nSH7.out1 -> CT7.clock #cyan [digital ortho]\nCT7.out1 -> CM7.in1 #amber [digital ortho]\nLIM.out -> CM7.in2 #amber [digital ortho]\nCM7.eq -> DONE.in #emerald [digital ortho marker-end=arrow]'
	},
	{
		id: 'quantum-control',
		family: 'quantum',
		title: 'Controlled phase',
		description: 'A quantum circuit with control, phase and readout.',
		width: 1000,
		height: 400,
		source:
			'prepare:P0 "|+\\rangle" at (80, 120) #blue\nprepare:P1 "|1\\rangle" at (80, 280) #blue\ncphase:CP7 "CP" at (400, 200) #purple [fit=wires]\nmeasure:MX7 "M_x" at (680, 120) #cyan\nclassical-bit:CB7 "c_0" at (880, 120) #emerald\n\nP0.out -> CP7.in1 #blue [quantum ortho]\nP1.out -> CP7.in2 #blue [quantum ortho]\nCP7.out1 -> MX7.in #purple [quantum ortho]\nMX7.classical -> CB7.in #cyan [classical line marker-end=arrow]'
	},
	{
		id: 'fitted-cnot',
		family: 'quantum',
		title: 'Fitted CNOT',
		description:
			'A two-qubit CNOT gate is aligned with both input wires, which enter at different heights; the compiler computes the gate span from those connections.',
		width: 920,
		height: 360,
		source:
			'prepare:HC "|1\\rangle" at (100, 100) #blue\nprepare:HT "|1\\rangle" at (100, 270) #blue\ncnot:CX at (460, 185) #purple [fit=wires]\nport:HOC "control out" at (790, 100) #emerald\nport:HOT "target out" at (790, 270) #emerald\n\nHC.out -> CX.in1 #blue [quantum ortho]\nHT.out -> CX.in2 #blue [quantum ortho]\nCX.out1 -> HOC.in #purple [quantum ortho]\nCX.out2 -> HOT.in #purple [quantum ortho marker-end=arrow]'
	},
	{
		id: 'sequence',
		family: 'uml',
		title: 'Deploy interaction',
		description: 'Lifelines and messages for a documentation deployment.',
		width: 1000,
		height: 540,
		source:
			'lifeline:CI7 "CI runner" at (220, 270) #cyan [width=170 height=400]\nlifeline:PG7 "Pages host" at (620, 270) #amber [width=170 height=400]\nartifact:ST7 "site/" at (880, 420) #emerald [width=170 height=80]\n\nCI7.right90 -> PG7.left90 #cyan [line synchronous label="deploy(1.3.0)"]\nPG7.left180 -> CI7.right180 #amber [line return dashed label="200 OK"]\nCI7.right270 -> PG7.left270 #cyan [line asynchronous label="invalidate cache"]\nST7.left -> PG7.right350 #emerald [ortho dependency label="build output"]'
	}
] as const;

export function templateHref(
	template: (typeof STARTER_TEMPLATES)[number],
	version: string
): string {
	const target = writeWorkspaceQuery(new URL(`/playground/${version}`, 'https://schemd.invalid'), {
		source: template.source,
		title: template.title,
		width: template.width,
		height: template.height,
		mode: 'default'
	});
	return target.pathname + target.search;
}
export function templateGallery(version: string, locale: Locale = 'en') {
	const t = translator(messagesFor('/templates', locale));
	return STARTER_TEMPLATES.map((template) => {
		const markup = compileSchematic(template.source, {
			bounds: { width: template.width, height: template.height },
			title: t(template.title),
			idPrefix: `template-${template.id}`
		}).svg;
		const svg = markup
			.slice(markup.indexOf('<svg'), markup.indexOf('</svg>') + '</svg>'.length)
			.replace(
				/(\d+) components and (\d+) connections\./,
				(_, components: string, connections: string) =>
					t('{0} components and {1} connections.', [components, connections])
			);
		return { ...template, href: templateHref(template, version), svg };
	});
}
