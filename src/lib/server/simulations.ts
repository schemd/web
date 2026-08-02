/**
 * Simulation-lab schematic sources, compiled once per process in `full` mode
 * so every node, port, and wire carries the compiler's delegation attributes.
 * The client never draws a schematic — it only toggles the state classes
 * (`is-active`, `is-degraded`, `is-selected`) that `@schemd/core` styles.
 *
 * This module is the single source of truth for both the environment selector
 * (`/simulations/[version]`) and each standalone laboratory
 * (`/simulations/[version]/[env]`): the selector reads {@link SIM_ENVIRONMENTS}
 * metadata without paying for a compile, while a laboratory route resolves the
 * one compiled document it needs through {@link getSimulation}.
 */
import { compileSchematic, parseSchematicFence } from '@schemd/core';
import katex from 'katex';
import { RC_FILTER_BOUNDS, RC_FILTER_SOURCE } from '$lib/diagrams';

/**
 * Pre-render a LaTeX governing model to static KaTeX HTML at module load.
 *
 * The formulas use real LaTeX (`\dfrac`, `\oplus`, bra-kets), so KaTeX — already
 * a dependency of the docs pipeline — is required to typeset them; escaping the
 * raw source only prints backslash commands. `throwOnError: false` degrades a
 * malformed formula to a visible error span instead of failing the build.
 */
function renderFormula(tex: string): string {
	return katex.renderToString(tex, { throwOnError: false, displayMode: false });
}

/** Escape HTML-significant characters in author prose before decoration. */
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Light inline decoration on already-escaped prose. */
function decorate(escaped: string): string {
	return escaped
		.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
		.replace(/\*([^*]+)\*/g, '<em>$1</em>')
		.replace(/`([^`]+)`/g, '<code>$1</code>');
}

/**
 * Render author pedagogy prose to premium HTML at module load.
 *
 * The narrative voice writes math the way the docs do — `$…$` inline and
 * `$$…$$` display — so the same KaTeX pass that typesets the docs typesets the
 * "aha" here. Text outside math is escaped, then given minimal `**bold**` /
 * `` `code` `` decoration. Zero client runtime: every string is baked once.
 */
function renderProse(text: string): string {
	const pattern = /\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g;
	const renderedMath: string[] = [];
	const tokenized = text.replace(pattern, (_match, displayTex?: string, inlineTex?: string) => {
		const display = displayTex !== undefined;
		const html = katex.renderToString(display ? displayTex : (inlineTex ?? ''), {
			throwOnError: false,
			displayMode: display
		});
		const index = renderedMath.push(html) - 1;
		return `\u{e000}${index}\u{e001}`;
	});
	return decorate(escapeHtml(tokenized)).replace(
		/\u{e000}(\d+)\u{e001}/gu,
		(_match, index: string) => renderedMath[Number(index)] ?? ''
	);
}

export type PedagogyActionEvent = 'click' | 'input' | 'change';

/**
 * Machine-checkable contract between one teaching step and the live control
 * that can produce its evidence. This is intentionally data, not a callback,
 * so it remains serializable across the SvelteKit server boundary.
 */
export interface PedagogyAction {
	readonly kind: 'control' | 'fault';
	readonly selector: string;
	/** Optional ordered selectors for a compound interaction such as A then B. */
	readonly sequence?: readonly string[];
	readonly event: PedagogyActionEvent;
	readonly occurrences: number;
	readonly instruction: string;
	/** Optional semantic result that must be reported by the physical model. */
	readonly outcome?: string;
}

/** One guided lab action that produces the intended realization. */
export interface PedagogyStep {
	/** Imperative headline, e.g. "Toggle bit 0." */
	readonly label: string;
	/** Headline with every inline equation pre-rendered by KaTeX. */
	readonly labelHtml: string;
	/** Pre-rendered explanation of what the reader should now see and why. */
	readonly detailHtml: string;
	/** Exact live interaction required to complete this step. */
	readonly action: PedagogyAction;
}

/** One answer in the required commit-before-reveal prediction. */
export interface PredictionChoice {
	/** Stable persistence key; deliberately separate from translated copy. */
	readonly id: string;
	/** Human-readable answer. */
	readonly label: string;
	/** Answer with inline notation pre-rendered by KaTeX. */
	readonly labelHtml: string;
	/** Whether the physical model supports this prediction. */
	readonly correct: boolean;
	/** Evidence-led response shown only after the learner commits. */
	readonly feedbackHtml: string;
}

/** A productive-failure prompt answered before the explanation is revealed. */
export interface Prediction {
	readonly prompt: string;
	readonly promptHtml: string;
	readonly choices: readonly PredictionChoice[];
}

/** The "aha" teaching layer attached to every environment, rendered once. */
export interface Pedagogy {
	/** The single realization the lab is built to deliver. */
	readonly aha: string;
	/** The realization with inline notation pre-rendered by KaTeX. */
	readonly ahaHtml: string;
	/** Voice-driven principle paragraph with typeset math. */
	readonly principleHtml: string;
	/** Commit-before-reveal experiment prompt. */
	readonly prediction: Prediction;
	/** Guided walk-through that earns the aha through direct interaction. */
	readonly steps: readonly PedagogyStep[];
	/** Transfer task that asks for a diagnosis before naming the injected fault. */
	readonly diagnosisPrompt: string;
	readonly diagnosisPromptHtml: string;
}

/** Author-supplied pedagogy before KaTeX prose rendering. */
interface PedagogyRaw {
	readonly aha: string;
	readonly principle: string;
	readonly steps: readonly { readonly label: string; readonly detail: string }[];
}

/** Explicit curricular position; tiers alone are not a learning sequence. */
export interface SimulationCurriculum {
	/** Recommended traversal order, independent of catalogue filtering. */
	readonly order: number;
	/** Labs whose ideas this laboratory assumes. */
	readonly prerequisites: readonly string[];
	/** Observable outcome used in the catalogue and completion summary. */
	readonly objective: string;
}

/** Static, compile-free descriptor powering the selector cards and lab headers. */
export interface SimEnvironment {
	/** Stable route segment, e.g. `adder`. */
	readonly id: string;
	/** Two-digit lab index used in the terminal chrome, e.g. `01`. */
	readonly index: string;
	/** Human-readable environment title. */
	readonly title: string;
	/** Engineering domain tag, e.g. `Digital`. */
	readonly domain: string;
	/** Collection tier used by the catalogue filters. */
	readonly tier: 'Core' | 'Advanced' | 'Frontier';
	/** Short description of the numerical / behavioural engine. */
	readonly model: string;
	/** One-line summary shown under the card title. */
	readonly tagline: string;
	/** Longer technical description of the behavioural model. */
	readonly summary: string;
	/** The governing equation as LaTeX source. */
	readonly formula: string;
	/** The governing equation pre-rendered to static KaTeX HTML. */
	readonly formulaHtml: string;
	/** Hardware nodes instantiated by the compiled schematic. */
	readonly inventory: readonly string[];
	/** Mathematical / range boundaries the model enforces. */
	readonly boundaries: readonly string[];
	/** The one fault this environment's switchboard can inject. */
	readonly fault: string;
	/** The "aha"-first teaching layer shown above the live laboratory. */
	readonly pedagogy: Pedagogy;
	/** Prerequisite graph and intended learning outcome. */
	readonly curriculum: SimulationCurriculum;
}

/** A resolved environment plus its compiled `full`-mode SVG document. */
export interface CompiledSimulation extends SimEnvironment {
	readonly svg: string;
	readonly components: number;
	readonly connections: number;
	/** Detail-only technical prose, rendered server-side with KaTeX. */
	readonly summaryHtml: string;
	readonly modelHtml: string;
	readonly inventoryHtml: readonly string[];
	readonly boundariesHtml: readonly string[];
	readonly faultHtml: string;
}

/**
 * Generate the 8-bit ripple-carry adder DSL programmatically.
 *
 * Bits are stacked **vertically** — one full-adder cell per row, LSB (bit 0)
 * at the top — so the carry ripples straight down from C_in to C_out. Every
 * cell keeps identical column roles, so the client's logic pass can address
 * nodes by `<role>_<bit>` regardless of geometry.
 */
function adderSource(): { source: string; width: number; height: number } {
	const lines: string[] = ['// 8-bit ripple-carry adder — vertical stack, carry ripples downward'];
	const bits = 8;
	const rowHeight = 250;
	const top = 130;
	/* Fixed column x-positions by gate role — generous gaps keep labels clear. */
	const xInput = 80; /* A / B ports */
	const xFirst = 320; /* X1 (sum XOR) + N1 (AND) */
	const xSecond = 560; /* X2 (carry XOR) + N2 (AND) */
	const xCarry = 790; /* O1 (carry OR) */
	const xSum = 980; /* S output port */

	lines.push(`port:CIN "C_{in}" at (${xSecond}, 55) #slate`);
	for (let bit = 0; bit < bits; bit += 1) {
		const y = top + bit * rowHeight;
		lines.push(
			`port:A${bit} "A_${bit}" at (${xInput}, ${y}) #blue`,
			`port:B${bit} "B_${bit}" at (${xInput}, ${y + 85}) #blue`,
			`xor:X1_${bit} "X" at (${xFirst}, ${y + 5}) #cyan`,
			`and:N1_${bit} "A" at (${xFirst}, ${y + 115}) #amber`,
			`xor:X2_${bit} "X" at (${xSecond}, ${y + 40}) #cyan`,
			`and:N2_${bit} "A" at (${xSecond}, ${y + 145}) #amber`,
			`or:O1_${bit} "O" at (${xCarry}, ${y + 120}) #purple`,
			`port:S${bit} "S_${bit}" at (${xSum}, ${y + 20}) #emerald`
		);
	}
	lines.push(`port:COUT "C_{out}" at (${xCarry}, ${top + bits * rowHeight - 10}) #emerald`);
	for (let bit = 0; bit < bits; bit += 1) {
		const carry = bit === 0 ? 'CIN.out' : `O1_${bit - 1}.out`;
		lines.push(
			`A${bit}.out -> X1_${bit}.in1 #blue [ortho]`,
			`B${bit}.out -> X1_${bit}.in2 #blue [ortho]`,
			`A${bit}.out -> N1_${bit}.in1 #blue [ortho]`,
			`B${bit}.out -> N1_${bit}.in2 #blue [ortho]`,
			`X1_${bit}.out -> X2_${bit}.in1 #cyan [ortho]`,
			`${carry} -> X2_${bit}.in2 #slate [ortho]`,
			`X1_${bit}.out -> N2_${bit}.in1 #cyan [ortho]`,
			`${carry} -> N2_${bit}.in2 #slate [ortho]`,
			`N1_${bit}.out -> O1_${bit}.in1 #amber [ortho]`,
			`N2_${bit}.out -> O1_${bit}.in2 #amber [ortho]`,
			`X2_${bit}.out -> S${bit}.in #emerald [ortho]`
		);
	}
	lines.push(`O1_${bits - 1}.out -> COUT.in #purple [ortho]`);
	return { source: lines.join('\n'), width: 1080, height: top + bits * rowHeight + 60 };
}

/** Re-exported so existing importers keep one name for one diagram. */
export const RC_SOURCE = RC_FILTER_SOURCE;

const BELL_SOURCE = `// Bell-state preparation: H then CNOT
prepare:Q0 "q_0 = |0⟩" at (80, 90) #blue
prepare:Q1 "q_1 = |0⟩" at (80, 210) #blue
hadamard:H1 "H" at (280, 90) #cyan
cnot:CX1 "CNOT" at (460, 150) #purple
measure:M0 "M_0" at (640, 90) #emerald
measure:M1 "M_1" at (640, 210) #emerald

Q0.out -> H1.in #blue [line]
H1.out -> CX1.in1 #cyan [line]
Q1.out -> CX1.in2 #blue [line]
CX1.out1 -> M0.in #purple [line]
CX1.out2 -> M1.in #purple [line]`;

const TIMER_SOURCE = `// 555 timer, astable configuration
ic:U1 "555" at (360, 220) [left="tr,th,dis" right="q,rst" top="vcc" bottom="gnd"]
port:VCC "V_{cc}" at (360, 60) #amber
resistor:RA "R_A" at (150, 120) #amber
resistor:RB "R_B" at (150, 220) #amber
capacitor:CT "C_T" at (150, 330) #cyan
diode:LED "LED" at (580, 160) #emerald [type=led]
resistor:RL "330 \\Omega" at (580, 300) #slate
ground:G1 "0 V" at (360, 370) #slate

VCC.out -> U1.vcc #amber [ortho]
VCC.out -> RA.in #amber [ortho]
RA.out -> RB.in #amber [ortho]
RB.in -> U1.dis #amber [ortho]
RB.out -> CT.in #cyan [ortho]
RB.out -> U1.th #cyan [ortho]
CT.in -> U1.tr #cyan [ortho]
U1.q -> LED.anode #emerald [ortho]
LED.cathode -> RL.in #slate [ortho]
U1.gnd -> G1.in #slate [ortho]`;

const TELEPORT_SOURCE = `// Quantum teleportation protocol register
prepare:PSI "|ψ⟩" at (70, 80) #purple
prepare:A "|0⟩" at (70, 200) #blue
prepare:B "|0⟩" at (70, 320) #blue
hadamard:H1 "H" at (210, 200) #cyan
cnot:CX1 "CNOT" at (340, 260) #blue
cnot:CX2 "CNOT" at (470, 140) #purple
hadamard:H2 "H" at (600, 80) #cyan
measure:MZ1 "M_Z" at (720, 80) #amber
measure:MZ2 "M_Z" at (720, 200) #amber
qgate:XC "X^{m_2}" at (720, 320) #emerald
qgate:ZC "Z^{m_1}" at (840, 320) #emerald
port:OUT "|ψ⟩" at (950, 320) #purple

PSI.out -> CX2.in1 #purple [line]
A.out -> H1.in #blue [line]
H1.out -> CX1.in1 #cyan [line]
B.out -> CX1.in2 #blue [line]
CX1.out1 -> CX2.in2 #blue [line]
CX2.out1 -> H2.in #purple [line]
H2.out -> MZ1.in #cyan [line]
CX2.out2 -> MZ2.in #purple [line]
CX1.out2 -> XC.in #blue [line]
XC.out -> ZC.in #emerald [line]
ZC.out -> OUT.in #emerald [line]`;

const BUCK_SOURCE = `// Closed-loop synchronous buck converter power stage
source:VIN "V_{in}" at (70, 120) #amber [type=voltage-dc]
ic:CTRL "PWM" at (200, 300) #purple [right="gate,fb"]
transistor:QH "Q_H" at (260, 120) #purple [type=pmos]
junction:SW "switch node" at (390, 120) #amber
diode:D1 "D_{free}" at (390, 270) #blue [type=schottky orientation=down]
inductor:L1 "L" at (520, 120) #cyan
junction:VOUT_NODE "regulated rail" at (650, 120) #emerald
testpoint:VOUT_PROBE "V_{out}" at (780, 120) #emerald
capacitor:COUT "C_{out}" at (650, 280) #cyan [type=polarized orientation=down]
resistor:RLOAD "R_{load}" at (820, 280) #slate [orientation=down]
junction:RETURN "power return" at (650, 420) #slate
ground:GND "0 V" at (650, 500) #slate

VIN.positive -> QH.source #amber [ortho]
CTRL.gate -> QH.gate #purple [ortho]
QH.drain -> SW.node #amber [ortho]
SW.node -> L1.in #amber [ortho]
L1.out -> VOUT_NODE.node #cyan [ortho marker-end=arrow label="i_L"]
VOUT_NODE.node -> VOUT_PROBE.node #emerald [ortho]
VOUT_PROBE.node -> CTRL.fb #emerald [ortho]
VOUT_NODE.node -> COUT.in #cyan [ortho]
VOUT_NODE.node -> RLOAD.in #slate [ortho]
SW.node -> D1.cathode #blue [ortho]
D1.anode -> RETURN.node #blue [ortho]
COUT.out -> RETURN.node #cyan [ortho]
RLOAD.out -> RETURN.node #slate [ortho]
VIN.negative -> RETURN.node #slate [ortho]
RETURN.node -> GND.in #slate [ortho]`;

const STATECHART_SOURCE = `// Traffic-signal controller — an executable UML state machine
initial:START "start" at (100, 120) #slate
state:RED "Red" at (330, 120) #f2555a
state:GREEN "Green" at (640, 120) #emerald
state:YELLOW "Yellow" at (640, 380) #amber

START.right -> RED.left #slate [ortho label="power" marker-end=arrow]
RED.right -> GREEN.left #emerald [ortho label="t > T_red" marker-end=arrow]
GREEN.bottom -> YELLOW.top #amber [ortho label="t > T_green" marker-end=arrow]
YELLOW.left -> RED.bottom #f2555a [ortho label="t > T_yellow" marker-end=arrow]`;

const QEC_SOURCE = `// 3-qubit bit-flip code — encode, inject an error, extract a syndrome, correct
prepare:PSI "|ψ⟩" at (80, 120) #purple
ic:ENC "Encode" at (320, 240) #cyan [left="d" right="o0,o1,o2"]
ic:ERR "Channel" at (600, 240) #f2555a [left="i0,i1,i2" right="o0,o1,o2"]
ic:SYN "Syndrome" at (880, 240) #amber [left="i0,i1,i2" right="o0,o1,o2,s0,s1"]
ic:COR "Correct" at (1160, 240) #emerald [left="i0,i1,i2,s0,s1" right="d"]
measure:MOUT "|ψ⟩" at (1300, 120) #purple

PSI.out -> ENC.d #purple [ortho]
ENC.o0 -> ERR.i0 #cyan [line]
ENC.o1 -> ERR.i1 #cyan [line]
ENC.o2 -> ERR.i2 #cyan [line]
ERR.o0 -> SYN.i0 #blue [line]
ERR.o1 -> SYN.i1 #blue [line]
ERR.o2 -> SYN.i2 #blue [line]
SYN.o0 -> COR.i0 #amber [line]
SYN.o1 -> COR.i1 #amber [line]
SYN.o2 -> COR.i2 #amber [line]
SYN.s0 -> COR.s0 #slate [line]
SYN.s1 -> COR.s1 #slate [line]
COR.d -> MOUT.in #emerald [ortho]`;

const WIEN_SOURCE = `// Wien-bridge oscillator — op-amp with an RC frequency-selective positive-feedback network
amplifier:U1 "A" at (470, 250) #purple [type=opamp]
resistor:RF "R_f" at (330, 150) #amber [orientation=down]
resistor:RG "R_g" at (150, 250) #amber [orientation=down]
junction:VN "v_-" at (330, 250) #amber
junction:VOUT "v_o" at (700, 250) #purple
resistor:RS "R" at (760, 110) #cyan
capacitor:CS "C" at (890, 110) #cyan
junction:VP "v_+" at (280, 400) #cyan
resistor:RP "R" at (620, 470) #emerald
capacitor:CP "C" at (470, 470) #emerald [orientation=down]
port:OUT "v_o" at (1000, 250) #emerald
ground:GND "0 V" at (150, 470) #slate

U1.out -> VOUT.node #purple [line]
VOUT.node -> OUT.in #purple [ortho]
VOUT.node -> RS.in #cyan [ortho]
RS.out -> CS.in #cyan [line]
CS.out -> VP.node #cyan [ortho]
VP.node -> U1.positive #cyan [ortho]
VP.node -> RP.in #emerald [ortho]
RP.out -> GND.in #emerald [ortho]
VP.node -> CP.in #emerald [ortho]
CP.out -> GND.in #emerald [line]
VOUT.node -> RF.in #amber [ortho]
RF.out -> VN.node #amber [ortho]
VN.node -> U1.negative #amber [ortho]
VN.node -> RG.in #amber [ortho]
RG.out -> GND.in #amber [ortho]`;

const LFSR_SOURCE = `// 4-bit Fibonacci LFSR — maximal-length m-sequence, taps at stages 3 and 4
clock:CLK "clk" at (110, 300) #amber
xor:FB "XOR" at (1090, 80) #purple [inputs=2]
flipflop:Q1 "D1" at (360, 300) #blue [type=d]
flipflop:Q2 "D2" at (560, 300) #cyan [type=d]
flipflop:Q3 "D3" at (760, 300) #emerald [type=d]
flipflop:Q4 "D4" at (960, 300) #amber [type=d]
port:OUT "seq" at (1120, 300) #emerald

Q3.q -> FB.in1 #purple [ortho]
Q4.q -> FB.in2 #purple [ortho]
FB.out -> Q1.d #purple [ortho]
CLK.out -> Q1.clock #amber [ortho]
CLK.out -> Q2.clock #amber [ortho]
CLK.out -> Q3.clock #amber [ortho]
CLK.out -> Q4.clock #amber [ortho]
Q1.q -> Q2.d #blue [line]
Q2.q -> Q3.d #cyan [line]
Q3.q -> Q4.d #emerald [line]
Q4.q -> OUT.in #emerald [line]`;

const GROVER_SOURCE = `// Grover 3-qubit search — uniform superposition, oracle marking, amplitude amplification
port:Q0 "q_0" at (80, 130) #blue
port:Q1 "q_1" at (80, 230) #blue
port:Q2 "q_2" at (80, 330) #blue
hadamard:H0 "H" at (240, 130) #cyan
hadamard:H1 "H" at (240, 230) #cyan
hadamard:H2 "H" at (240, 330) #cyan
ic:ORACLE "U_f" at (470, 230) #purple [left="i0,i1,i2" right="o0,o1,o2"]
ic:DIFF "diffuse" at (760, 230) #amber [left="i0,i1,i2" right="o0,o1,o2"]
measure:M0 "M" at (1000, 130) #emerald
measure:M1 "M" at (1000, 230) #emerald
measure:M2 "M" at (1000, 330) #emerald

Q0.out -> H0.in #blue [line]
Q1.out -> H1.in #blue [line]
Q2.out -> H2.in #blue [line]
H0.out -> ORACLE.i0 #cyan [ortho]
H1.out -> ORACLE.i1 #cyan [line]
H2.out -> ORACLE.i2 #cyan [ortho]
ORACLE.o0 -> DIFF.i0 #purple [line]
ORACLE.o1 -> DIFF.i1 #purple [line]
ORACLE.o2 -> DIFF.i2 #purple [line]
DIFF.o0 -> M0.in #amber [ortho]
DIFF.o1 -> M1.in #amber [line]
DIFF.o2 -> M2.in #amber [ortho]`;

/** Bounds + generated DSL keyed by environment id. */
const SOURCES: Record<string, { source: string; width: number; height: number }> = {
	adder: adderSource(),
	rc: { source: RC_FILTER_SOURCE, ...RC_FILTER_BOUNDS },
	bell: { source: BELL_SOURCE, width: 760, height: 300 },
	timer: { source: TIMER_SOURCE, width: 700, height: 480 },
	teleport: { source: TELEPORT_SOURCE, width: 1020, height: 400 },
	buck: { source: BUCK_SOURCE, width: 920, height: 640 },
	statechart: { source: STATECHART_SOURCE, width: 980, height: 560 },
	qec: { source: QEC_SOURCE, width: 1400, height: 480 },
	wien: { source: WIEN_SOURCE, width: 1080, height: 560 },
	lfsr: { source: LFSR_SOURCE, width: 1180, height: 460 },
	grover: { source: GROVER_SOURCE, width: 1240, height: 460 }
};

/**
 * Public environment registry. The order here is the order the selector paints
 * its cards, and each `index` mirrors that ordering for the terminal chrome.
 */
const SIM_ENVIRONMENTS_RAW: readonly (Omit<
	SimEnvironment,
	'formulaHtml' | 'pedagogy' | 'curriculum'
> & {
	readonly pedagogy: PedagogyRaw;
})[] = [
	{
		id: 'adder',
		index: '01',
		title: '8-Bit Digital Adder',
		domain: 'Digital',
		tier: 'Core',
		model: 'event-driven Boolean solver',
		tagline: 'Cascading ripple-carry gate matrix with a live combinational pass.',
		summary:
			'Eight full-adder cells built from XOR/AND/OR primitives. Changing an operand or carry input dispatches one synchronous logic pass; high nets glow as the carry ripples left to right.',
		formula:
			'S_i = A_i \\oplus B_i \\oplus C_i \\;\\cdot\\; C_{i+1} = A_iB_i + C_i(A_i \\oplus B_i)',
		inventory: [
			'8× full-adder cell',
			'16× XOR + 16× AND',
			'8× OR carry merge',
			'A/B/Cᵢₙ + Sum ports'
		],
		boundaries: [
			'8-bit operands · 0–255',
			'sum 0–511 with carry-out',
			'per-gate propagation delay'
		],
		fault: 'carry chain stuck-at-0',
		pedagogy: {
			aha: 'Addition is fast, but the carry is a rumour — and a rumour has to travel.',
			principle:
				'Each bit of the answer needs two facts: the sum $S_i = A_i \\oplus B_i \\oplus C_i$ and the carry it hands upward, $C_{i+1} = A_iB_i + C_i(A_i \\oplus B_i)$. The $\\oplus$ (XOR) tells you the bit; the AND/OR pair tells you whether a $1$ spilled over. Here is the catch a newcomer never sees on paper: **bit $i$ cannot finish until bit $i-1$ has decided its carry.** So the truth does not appear everywhere at once — it *ripples*, one cell at a time, from the least significant bit to the most. That travel time is exactly why real processors abandon this circuit for carry-lookahead.',
			steps: [
				{
					label: 'Type two numbers and watch the front move.',
					detail:
						'Set $A$ and $B$, then watch the glow: the low bits settle first and a bright carry front climbs upward. You are literally watching information propagate.'
				},
				{
					label: 'Toggle carry-in with an all-ones operand.',
					detail:
						'Set $A = 11111111$ and $B = 0$, then toggle $C_{in}$. A single carry sweeps all the way to $C_{out}$ — one bit of input, eight cells of consequence. This is the worst case, $t \\propto n$.'
				},
				{
					label: 'Diagnose a missing overflow before inspecting the relay.',
					detail:
						'Inject the disturbance, predict the correct nine-bit result, then follow the last active carry. Name the failed information path from evidence before reading the relay label.'
				}
			]
		}
	},
	{
		id: 'rc',
		index: '02',
		title: 'Dynamic RC Low-Pass Filter',
		domain: 'Analog',
		tier: 'Core',
		model: 'frequency-domain transfer function',
		tagline: 'Sweep R, C, and frequency; watch the pole attenuate the output trace.',
		summary:
			'A first-order shunt-capacitor filter. The cutoff and the |H(jω)| magnitude are derived live; the output wire fades its opacity and stretches its dash pattern to visualise physical damping, and both channels drive the oscilloscope.',
		formula:
			'f_c = \\dfrac{1}{2\\pi RC} \\;\\cdot\\; |H(j\\omega)| = \\dfrac{1}{\\sqrt{1 + (f/f_c)^2}}',
		inventory: ['input source node', 'series resistor R', 'shunt capacitor C', 'reference ground'],
		boundaries: ['R 100 Ω – 1 MΩ', 'C 1 nF – 10 µF', 'sweep 10 Hz – 100 kHz'],
		fault: 'capacitor branch open',
		pedagogy: {
			aha: 'A capacitor is a bucket. Slow signals fill it; fast ones wiggle away before it can respond.',
			principle:
				'The capacitor needs time to charge through $R$, and that time sets a verdict. Below the cutoff $f_c = \\frac{1}{2\\pi RC}$ the bucket keeps up and the output follows the input. Above it, the signal reverses before the bucket fills, so the amplitude collapses as $|H(j\\omega)| = \\frac{1}{\\sqrt{1 + (f/f_c)^2}}$. At $f = f_c$ exactly, the output has dropped to $\\frac{1}{\\sqrt 2} \\approx 0.707$ of the input — the famous **−3 dB point**, the frequency where the filter says *"this is where I start giving up."*',
			steps: [
				{
					label: 'Sweep the frequency slider past the cutoff.',
					detail:
						'Watch the output trace fade and its dash-pattern stretch as $f$ climbs past $f_c$ — the fading *is* the attenuation, drawn in real physical proportion.'
				},
				{
					label: 'Halve C and watch the cutoff move.',
					detail:
						'Smaller bucket, faster response: $f_c$ doubles. The filter now passes signals it used to block — you moved the verdict by changing one component.'
				},
				{
					label: 'Diagnose why attenuation disappears.',
					detail:
						'Inject the disturbance and sweep frequency. If the output tracks the input everywhere, use the missing pole—not the switch label—to identify which energy-storage path stopped participating.'
				}
			]
		}
	},
	{
		id: 'bell',
		index: '03',
		title: 'Bell-State Entanglement Visualizer',
		domain: 'Quantum',
		tier: 'Advanced',
		model: 'state-vector + Born sampler',
		tagline: 'Prepare the four Bell states; sample the ⟨Z⊗Z⟩ correlation.',
		summary:
			'H on q₀ followed by CNOT(q₀→q₁). Toggling the initialization ports selects which Bell pair is prepared; amplitudes and the correlation index are derived, and a measure button accumulates real Born-rule shots.',
		formula:
			'|\\Phi^+\\rangle = \\dfrac{|00\\rangle + |11\\rangle}{\\sqrt{2}} \\;\\cdot\\; \\langle Z \\otimes Z \\rangle \\in [-1, +1]',
		inventory: [
			'2× qubit register line',
			'Hadamard gate',
			'CNOT control/target',
			'measurement ports'
		],
		boundaries: ['4 Bell states', 'amplitudes ±1/√2', 'CHSH witness S ∈ [0, 2√2]'],
		fault: 'CNOT entangler offline',
		pedagogy: {
			aha: 'Measure one qubit and you instantly know the other — not because a signal raced across, but because they were never really two things.',
			principle:
				'Start with $|00\\rangle$, apply $H$ to the first qubit, then a CNOT, and you reach $|\\Phi^+\\rangle = \\frac{|00\\rangle + |11\\rangle}{\\sqrt 2}$. Notice what is missing: there is **no** $|01\\rangle$ and **no** $|10\\rangle$. The two qubits have no state of their own — only the *pair* has a state. A skeptic says "they were secretly agreed in advance," like two gloves in sealed boxes. Quantum mechanics answers with the CHSH test: local hidden agreements can never push the correlation witness $S$ above $2$, yet this state reaches $S = 2\\sqrt 2 \\approx 2.83$. Watching $S$ climb past $2$ is watching local realism fail in front of you.',
			steps: [
				{
					label: 'Prepare $|\\Phi^+\\rangle$ and measure ×64 repeatedly.',
					detail:
						'Only $00$ and $11$ ever appear, roughly half each — perfectly correlated outcomes from a state with no definite value beforehand.'
				},
				{
					label: 'Run the CHSH witness.',
					detail:
						'The empirical $S$ settles near $2\\sqrt 2$. Any glove-in-a-box explanation is capped at $2$; you are past it. That gap is the whole of quantum non-locality.'
				},
				{
					label: 'Diagnose the loss of non-classical correlation.',
					detail:
						'Inject the disturbance, sample again, and compare both the forbidden outcomes and CHSH witness. Infer which stage failed to turn a product state into an entangled one.'
				}
			]
		}
	},
	{
		id: 'timer',
		index: '04',
		title: '555 Astable Multivibrator',
		domain: 'Mixed-signal',
		tier: 'Core',
		model: 'hybrid charge/discharge integrator',
		tagline: 'A real charge/discharge loop clocking an output LED.',
		summary:
			'The timing capacitor integrates between ⅓·V_cc and ⅔·V_cc. The timing-branch stroke weight scales with instantaneous V_C, and the LED node flashes in sync with the calculated frequency (time-scaled for visibility).',
		formula: 'f = \\dfrac{1.44}{(R_A + 2R_B)\\,C} \\;\\cdot\\; D = \\dfrac{R_A + R_B}{R_A + 2R_B}',
		inventory: [
			'8-pin 555 IC block',
			'R_A + R_B timing pair',
			'timing capacitor C_T',
			'output LED + limiter'
		],
		boundaries: ['V_cc = 5 V', 'threshold ⅔ · trigger ⅓', 'astable + monostable modes'],
		fault: 'THRES shorted to ground',
		pedagogy: {
			aha: 'A clock is just a capacitor climbing between two lines, forever losing its patience at the top and giving up at the bottom.',
			principle:
				'The 555 watches one voltage: the charge on $C_T$. It charges through $R_A + R_B$ until it touches $\\tfrac{2}{3}V_{cc}$, then discharges through $R_B$ until it sags to $\\tfrac{1}{3}V_{cc}$, then repeats — a triangle wave feeding two comparators. Because the RC climb is **exponential**, not linear, the high and low times are unequal, giving $f = \\frac{1.44}{(R_A + 2R_B)\\,C}$ and a duty always above 50%. Flip to **monostable** mode and the same climb happens exactly once per trigger: one pulse of width $t = 1.1\\,R_A C$ — a circuit that holds its breath for a precise, tunable moment.',
			steps: [
				{
					label: 'Watch $V_C$ ride between the two thresholds.',
					detail:
						'The timing wire thickens with the instantaneous capacitor voltage. It is not a metaphor — that stroke *is* $V_C(t)$ sweeping from $\\tfrac{1}{3}$ to $\\tfrac{2}{3}V_{cc}$.'
				},
				{
					label: 'Grow $R_B$ and watch the duty cycle approach 50%.',
					detail:
						'Charging goes through $R_A + R_B$ but discharging only through $R_B$. As $R_B$ dominates, the two times become more alike, so duty approaches—but never reaches—$50\\%$ in this topology.'
				},
				{
					label: 'Switch to monostable and fire a single shot.',
					detail:
						'One trigger, one clean pulse of width $1.1\\,R_A C$, then silence until the next trigger. The astable clock became a stopwatch.'
				}
			]
		}
	},
	{
		id: 'teleport',
		index: '05',
		title: 'Quantum Teleportation Protocol',
		domain: 'Advanced quantum',
		tier: 'Advanced',
		model: 'stepped three-qubit protocol',
		tagline: 'Step a three-qubit register through the full teleportation script.',
		summary:
			'Alice’s state |ψ⟩ is parameterised on the Bloch angles. Stepped playback advances the register through entanglement, Bell measurement, and the classically controlled X^{m₂}/Z^{m₁} corrections; hovering any gate reveals its action in Dirac notation.',
		formula:
			'|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle \\;\\cdot\\; \\alpha = \\cos\\tfrac{\\theta}{2},\\ \\beta = e^{i\\phi}\\sin\\tfrac{\\theta}{2}',
		inventory: [
			'3× qubit trace (ψ, A, B)',
			'H + CNOT preparation',
			'Bell-basis measurement',
			'X/Z correction gates'
		],
		boundaries: ['Bloch θ ∈ [0, π], φ ∈ [0, 2π]', '6-step protocol', 'fidelity F = |⟨ψ|ψ_out⟩|²'],
		fault: 'classical correction link cut',
		pedagogy: {
			aha: 'You never move the qubit. You move its *description* — and the original is destroyed in the act.',
			principle:
				'The no-cloning theorem forbids copying an unknown $|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle$, so teleportation does something stranger. Alice entangles her mystery qubit with half of a shared Bell pair and measures both in the Bell basis. Her measurement **destroys** the original and yields two classical bits $m_1, m_2$ — pure randomness that says nothing about $\\alpha, \\beta$. She phones those two bits to Bob, who applies $X^{m_2}Z^{m_1}$ to his half, and the exact state re-materialises on his side. Nothing carrying $\\alpha$ and $\\beta$ ever crossed the gap; the entanglement was pre-laid, and two classical bits finished the job. Fidelity $F = |\\langle\\psi|\\psi_{out}\\rangle|^2 = 1$ — bit-for-bit, provably the same state.',
			steps: [
				{
					label: 'Dial an arbitrary $|\\psi\\rangle$ on the Bloch sphere.',
					detail:
						'Pick any $\\theta, \\phi$. This is Alice’s unknown state — and neither she nor Bob is allowed to read it.'
				},
				{
					label: 'Step through the protocol and read the fidelity.',
					detail:
						'After the Bell measurement and Bob’s $X^{m_2}Z^{m_1}$ correction, the output fidelity locks to $F = 1$. The state arrived, exactly, on two classical bits of help.'
				},
				{
					label: 'Diagnose why Bob’s fidelity no longer reaches one.',
					detail:
						'Inject the disturbance, preserve Alice’s measurement record, and compare it with Bob’s applied corrections. Infer the missing dependency before inspecting the relay.'
				}
			]
		}
	},
	{
		id: 'buck',
		index: '06',
		title: 'Closed-Loop Buck Converter',
		domain: 'Power electronics',
		tier: 'Frontier',
		model: 'continuous-time averaged state space',
		tagline: 'Drive a PWM power stage across CCM, boundary, and discontinuous conduction.',
		summary:
			'A synchronous step-down converter with a continuous-time L–C state solver and switching-ripple reconstruction. Sweep duty cycle, source voltage, load, inductance, capacitance, and carrier frequency; the laboratory identifies conduction mode, efficiency, ripple, and transient settling in real time.',
		formula: '\\dot i_L = \\dfrac{D V_{in}-v_o}{L},\\quad \\dot v_o = \\dfrac{i_L-v_o/R}{C}',
		inventory: [
			'PWM feedback controller',
			'PMOS high-side switch',
			'Schottky freewheel diode',
			'L–C output network'
		],
		boundaries: ['V_in 5–36 V', 'f_sw 20–500 kHz', 'CCM / BCM / DCM classification'],
		fault: 'high-side MOSFET gate drive lost',
		pedagogy: {
			aha: 'Chop a voltage fast enough, and an inductor plus a capacitor remember only its average.',
			principle:
				'A resistor divider would burn the excess voltage as heat. A buck converter refuses to waste it: the switch turns the input fully on and fully off at high frequency, and the $L$–$C$ pair acts as a flywheel that averages the chopping. Sit in continuous conduction and the average obeys the beautifully simple $v_o = D\\,V_{in}$ — the output is just the input scaled by the fraction of time the switch is closed. The governing pair $\\dot i_L = \\frac{DV_{in}-v_o}{L},\\ \\dot v_o = \\frac{i_L - v_o/R}{C}$ shows the inductor current and output voltage chasing each other toward that average, with efficiency the divider could never touch.',
			steps: [
				{
					label: 'Sweep the duty cycle $D$.',
					detail:
						'The regulated rail tracks $D\\,V_{in}$ almost exactly — you are setting an output voltage by setting a *fraction of time*, not by dissipating the difference.'
				},
				{
					label: 'Drop the load current until conduction goes discontinuous.',
					detail:
						'Watch the classifier flip CCM → BCM → DCM as the inductor current hits zero each cycle. The simple $D\\,V_{in}$ law quietly stops holding.'
				},
				{
					label: 'Diagnose an output rail that coasts to zero.',
					detail:
						'Inject the disturbance and compare commanded duty, switch-node activity, inductor current, and output voltage. Locate where energy stops entering the averaging network.'
				}
			]
		}
	},

	{
		id: 'statechart',
		index: '07',
		title: 'Live State Machine',
		domain: 'UML statechart',
		tier: 'Advanced',
		model: 'event-driven finite-state executor',
		tagline: 'Fire events and watch a token walk the transitions of a running UML machine.',
		summary:
			'A traffic-signal controller drawn as a genuine UML state machine — initial pseudostate, three states, four guarded transitions. Firing an event (or letting the timer run) moves a live token: the active state glows, the taken transition pulses, and an event-trace log records the run. The diagram is not a picture of the machine; it *is* the machine.',
		formula:
			'\\delta : S \\times \\Sigma \\rightarrow S \\;\\cdot\\; (s, e) \\mapsto s_{\\text{next}} \\text{ if guard}(e)',
		inventory: [
			'initial pseudostate',
			'Red / Green / Yellow states',
			'4 guarded transitions',
			'event queue + trace log'
		],
		boundaries: ['deterministic δ', 'one active state', 'guarded, timed transitions'],
		fault: 'transition guard inverted (deadlock)',
		pedagogy: {
			aha: 'The boxes-and-arrows diagram is not documentation of the machine — run an event through it and it *is* the machine.',
			principle:
				'A finite-state machine is a transition function $\\delta : S \\times \\Sigma \\rightarrow S$: given the current state $s$ and an event $e$, it names exactly one next state — but only if the transition’s **guard** is satisfied. That is the whole of it. A traffic light is $S = \\{\\text{Red}, \\text{Green}, \\text{Yellow}\\}$ and the events are timer expiries. What schemd lets you see, that a textbook cannot, is that the *drawing* and the *behaviour* are the same object: the token sitting on Red is the machine’s state, and firing $t > T_{red}$ literally advances $\\delta$ along the arrow you drew. Composability, unreachable states, and deadlocks stop being abstractions — they are places the token can or cannot go.',
			steps: [
				{
					label: 'Fire the timer events in sequence.',
					detail:
						'Red → Green → Yellow → Red. The active state glows and each taken transition pulses; the trace log is the exact run $\\delta(\\delta(\\delta(s_0, e_1), e_2), \\dots)$.'
				},
				{
					label: 'Try to fire an event with no matching transition.',
					detail:
						'Nothing happens — and that *nothing* is meaningful. A well-formed machine simply has no arrow for an impossible input; the token holds.'
				},
				{
					label: 'Diagnose the state that cannot make progress.',
					detail:
						'Inject the disturbance, drive the token around the cycle, and identify the first state whose exit never becomes enabled. Name the liveness failure from the trace.'
				}
			]
		}
	},
	{
		id: 'qec',
		index: '08',
		title: 'Quantum Error Correction',
		domain: 'Quantum',
		tier: 'Frontier',
		model: 'stabilizer parity + syndrome decoder',
		tagline: 'Protect a qubit you are forbidden to read by measuring only disagreement.',
		summary:
			'The 3-qubit bit-flip code: one logical qubit is spread across three physical qubits, a bit-flip error is injected on any line, and two ancilla qubits extract a syndrome that names the culprit — without ever measuring the data. A majority-vote correction restores the logical state and the fidelity returns to one.',
		formula:
			'|0\\rangle_L = |000\\rangle,\\ |1\\rangle_L = |111\\rangle \\;\\cdot\\; s = (q_0{\\oplus}q_1,\\ q_1{\\oplus}q_2)',
		inventory: [
			'logical qubit → 3 physical',
			'injectable X error',
			'2 ancilla syndrome bits',
			'majority-vote decoder'
		],
		boundaries: [
			'corrects any single bit-flip',
			'syndrome ∈ {00,01,10,11}',
			'logical fidelity 0/1'
		],
		fault: 'syndrome decoder miswired',
		pedagogy: {
			aha: 'You can protect a qubit you are not even allowed to look at — by measuring only whether the copies *disagree*, never what they say.',
			principle:
				'Measuring a qubit destroys its superposition, so the classical trick of "read it and fix it" is off the table. The bit-flip code sidesteps this beautifully. Encode $\\alpha|0\\rangle + \\beta|1\\rangle$ as $\\alpha|000\\rangle + \\beta|111\\rangle$ — the amplitudes are untouched, just spread across three qubits. Now measure two **parities**: $s_0 = q_0 \\oplus q_1$ and $s_1 = q_1 \\oplus q_2$. A parity reveals whether two qubits *differ*, never their actual values, so the delicate $\\alpha, \\beta$ survive. Yet the syndrome $(s_0, s_1)$ points straight at the flipped qubit: $10$ means $q_0$, $11$ means $q_1$, $01$ means $q_2$, $00$ means clean. Flip it back and the logical state is exactly restored. This is the whole reason scalable quantum computing is believed possible.',
			steps: [
				{
					label: 'Inject a bit-flip on any one line.',
					detail:
						'Pick $q_0$, $q_1$, or $q_2$. The physical state is now corrupted — but you are forbidden from reading the data to find out how.'
				},
				{
					label: 'Read the syndrome, not the data.',
					detail:
						'The two parity bits light up a unique pattern that names the guilty qubit while learning nothing about $\\alpha, \\beta$. Watch the logical fidelity snap back to $1$ after correction.'
				},
				{
					label: 'Diagnose a correction that targets the wrong rail.',
					detail:
						'Inject the disturbance, record the syndrome, and compare the indicated rail with the applied correction. Infer the broken map from the residual error.'
				}
			]
		}
	},
	{
		id: 'wien',
		index: '09',
		title: 'Wien-Bridge Oscillator',
		domain: 'Active analog',
		tier: 'Advanced',
		model: 'second-order loop with amplitude limiting',
		tagline: 'An amplifier with just enough positive feedback sings a pure tone out of noise.',
		summary:
			'A non-inverting op-amp wrapped in a Wien RC network. When the loop gain crosses unity at exactly one frequency, thermal noise is amplified into a clean sinusoid; a nonlinear gain limiter parks the amplitude on a stable limit cycle. The phase portrait shows the oscillation being born — a Hopf bifurcation you can trigger with a knob.',
		formula: 'f_0 = \\dfrac{1}{2\\pi RC} \\;\\cdot\\; A\\beta = 1 \\text{ (Barkhausen), gain } = 3',
		inventory: [
			'op-amp gain stage',
			'series + shunt RC bridge',
			'R_f / R_g gain setting',
			'amplitude-limiting element'
		],
		boundaries: ['gain 2.8 – 3.2', 'f₀ from RC', 'Hopf onset at gain = 3'],
		fault: 'gain-set resistor open (latch-up)',
		pedagogy: {
			aha: 'Feed an amplifier a whisper of its own output — in phase, at one special frequency — and it will build a pure tone from nothing but noise.',
			principle:
				'The Barkhausen criterion is deceptively simple: for sustained oscillation the signal must travel around the loop and come back **exactly in phase and exactly the same size**, i.e. loop gain $A\\beta = 1$. The Wien network passes only one frequency $f_0 = \\frac{1}{2\\pi RC}$ with zero phase shift and a $\\frac{1}{3}$ attenuation, so the amplifier must supply a gain of exactly $3$ to close the loop there and nowhere else. Set the gain a hair above $3$ and any noise at $f_0$ grows exponentially; a gentle nonlinearity then pulls it back, and the amplitude settles onto a **limit cycle**. Cross the gain through $3$ and you have crossed a Hopf bifurcation — a fixed point becoming a stable oscillation, drawn live in the phase portrait.',
			steps: [
				{
					label: 'Raise the gain from below 3.',
					detail:
						'Under $3$, disturbances decay — the output dies to silence. That is a stable fixed point.'
				},
				{
					label: 'Cross gain = 3 and watch the tone ignite.',
					detail:
						'Just past $3$, the phase portrait blooms from a point into a closed loop: oscillation born from noise. This birth-of-a-cycle is the Hopf bifurcation.'
				},
				{
					label: 'Diagnose why a pure tone clips against the rails.',
					detail:
						'Inject the disturbance and distinguish a stable limit cycle from saturation. Use the loop-gain evidence to locate the missing amplitude control.'
				}
			]
		}
	},
	{
		id: 'lfsr',
		index: '10',
		title: 'Maximal-Length LFSR',
		domain: 'Sequential digital',
		tier: 'Advanced',
		model: 'clocked shift register over GF(2)',
		tagline:
			'Four flip-flops and one XOR make a stream that looks random but repeats after exactly 15.',
		summary:
			'A 4-bit Fibonacci linear-feedback shift register with taps at stages 3 and 4 — the primitive polynomial x⁴ + x³ + 1. Each clock edge shifts the register and feeds back the XOR of the tapped bits. The result cycles through all 15 non-zero states before repeating: a deterministic sequence wearing the disguise of randomness.',
		formula: 'x^4 + x^3 + 1 \\;\\cdot\\; \\text{period} = 2^n - 1 = 15',
		inventory: [
			'shared clock',
			'4× D flip-flop chain',
			'XOR feedback taps 3,4',
			'serial m-sequence output'
		],
		boundaries: ['period 2⁴ − 1 = 15', 'all-zero state forbidden', 'primitive polynomial taps'],
		fault: 'feedback tap moved (short cycle)',
		pedagogy: {
			aha: 'A handful of flip-flops and a single XOR generate a stream that passes for random — yet is perfectly deterministic and repeats after exactly $2^n - 1$ steps.',
			principle:
				'Each clock edge, the register shifts one place and a new bit enters from the left: the XOR of a chosen set of **taps**. Over the field $\\text{GF}(2)$ this is just repeated multiplication, and if the tap positions correspond to a *primitive polynomial* — here $x^4 + x^3 + 1$ — the register visits **every** non-zero 4-bit state before returning home. That is $2^4 - 1 = 15$ states in a fixed but scrambled order: a maximal-length sequence. It looks statistically random (equal 0s and 1s, flat autocorrelation) which is why LFSRs sit inside CRCs, spread-spectrum radios, and cheap noise sources — yet knowing the taps and one state predicts all of it forever. The all-zero state is the one trap: it maps to itself, a dead register.',
			steps: [
				{
					label: 'Single-step the clock and read the state.',
					detail:
						'Each edge produces a new 4-bit pattern. Write them down — you will pass through all 15 non-zero values with no repeats until the cycle closes.'
				},
				{
					label: 'Confirm the period is exactly 15.',
					detail:
						'The sequence returns to its start after $2^4 - 1$ clocks. Fewer flip-flops would give $2^n - 1$; the maximal length is the payoff of primitive taps.'
				},
				{
					label: 'Diagnose a sequence that repeats too soon.',
					detail:
						'Inject the disturbance, count clocks until the first repeated state, and use the shortened cycle to infer which recurrence lost its primitive structure.'
				}
			]
		}
	},
	{
		id: 'grover',
		index: '11',
		title: 'Grover 3-Qubit Search',
		domain: 'Quantum',
		tier: 'Frontier',
		model: 'amplitude amplification over 8 states',
		tagline: 'Rotate the whole haystack toward the needle — √N queries, not N.',
		summary:
			'Grover’s algorithm searching an 8-item space with 3 qubits. Uniform superposition, then repeated rounds of oracle (phase-flip the target) and diffusion (invert about the mean) rotate the state vector toward the marked item. Real 8-amplitude linear algebra drives a live bar chart; after the optimal ⌊π√8/4⌋ = 2 rounds the target probability peaks near 94%.',
		formula:
			'|s\\rangle \\to (D\\,U_f)^k|s\\rangle,\\quad k \\approx \\dfrac{\\pi}{4}\\sqrt{N} \\;\\cdot\\; N = 8',
		inventory: [
			'3-qubit uniform superposition',
			'oracle U_f (phase flip)',
			'diffusion 2|s⟩⟨s| − I',
			'8-state amplitude readout'
		],
		boundaries: ['N = 8 search space', 'optimal k = 2 rounds', 'peak P(target) ≈ 0.945'],
		fault: 'oracle marks the wrong state',
		pedagogy: {
			aha: 'You cannot find the needle faster by looking harder — but you can rotate the entire haystack until the needle is all that remains.',
			principle:
				'Classically, finding one marked item among $N$ takes about $N/2$ guesses; there is no cleverer way to check an unstructured list. Grover’s insight is geometric. Put all $N = 8$ states in equal superposition $|s\\rangle$, then repeat two reflections. The **oracle** $U_f$ flips the *sign* of the target’s amplitude only — a phase nudge you cannot see by measuring. The **diffusion** operator $2|s\\rangle\\langle s| - I$ reflects every amplitude about their mean, which converts that hidden sign into a *taller bar*. Each round rotates the state vector by a fixed angle toward the target, so the target’s probability grows like $\\sin^2\\!\\big((2k{+}1)\\theta\\big)$. After the optimal $k \\approx \\frac{\\pi}{4}\\sqrt N = 2$ rounds it peaks near $94\\%$ — a quadratic $\\sqrt N$ speedup you can watch happen bar by bar. Run too many rounds and it rotates *past* the target and back down.',
			steps: [
				{
					label: 'Choose a target and apply one Grover round.',
					detail:
						'The oracle flips the target’s sign; diffusion turns that into height. One round already lifts the target bar well above the uniform $\\tfrac{1}{8}$.'
				},
				{
					label: 'Apply the second round — the optimum.',
					detail:
						'For $N = 8$ the optimal count is $k = 2$. The target probability peaks near $0.945$. This is $\\sqrt N$ scaling made visible: two rounds, not four guesses.'
				},
				{
					label: 'Diagnose why the requested target is not amplified.',
					detail:
						'Separate two hypotheses with evidence: a third round rotates past the correct target, while a disturbed oracle makes a different bar grow after the optimal two rounds.'
				}
			]
		}
	}
];

interface LearningDesignRaw {
	readonly curriculum: SimulationCurriculum;
	readonly actions: readonly PedagogyAction[];
	readonly prediction: {
		readonly prompt: string;
		readonly choices: readonly {
			readonly id: string;
			readonly label: string;
			readonly correct: boolean;
			readonly feedback: string;
		}[];
	};
	readonly diagnosisPrompt: string;
}

function action(
	selector: string,
	event: PedagogyActionEvent,
	instruction: string,
	occurrences = 1,
	kind: PedagogyAction['kind'] = 'control',
	outcome?: string
): PedagogyAction {
	return outcome === undefined
		? { selector, event, instruction, occurrences, kind }
		: { selector, event, instruction, occurrences, kind, outcome };
}

function sequenceAction(
	sequence: readonly string[],
	event: PedagogyActionEvent,
	instruction: string,
	kind: PedagogyAction['kind'] = 'control'
): PedagogyAction {
	if (sequence.length === 0) throw new Error('A pedagogy action sequence cannot be empty.');
	return {
		selector: sequence.join(', '),
		sequence,
		event,
		instruction,
		occurrences: sequence.length,
		kind
	};
}

/**
 * Productive-failure prompts and the prerequisite graph live beside, but not
 * inside, the circuit descriptions. This keeps the physics copy reviewable and
 * makes omission detectable: the build below rejects any lab with no design.
 */
const LEARNING_DESIGN: Readonly<Record<string, LearningDesignRaw>> = {
	adder: {
		curriculum: {
			order: 1,
			prerequisites: [],
			objective: 'Trace a carry dependency through a combinational gate network.'
		},
		actions: [
			sequenceAction(
				['[data-lab-input="a"][type="number"]', '[data-lab-input="b"][type="number"]'],
				'input',
				'enter an A value, then a B value'
			),
			action(
				'[data-lab-input="carryIn"]',
				'change',
				'toggle the carry-in control after entering all ones'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden carry disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt: 'Before running $11111111_2 + 1_2$: which part of the result can settle first?',
			choices: [
				{
					id: 'ripple-up',
					label: 'The low bit settles first; the decision ripples upward.',
					correct: true,
					feedback:
						'Yes. Each higher cell waits for $C_i$, so the dependency travels from the least significant bit toward $C_{out}$.'
				},
				{
					id: 'all-at-once',
					label: 'All nine result bits settle at the same instant.',
					correct: false,
					feedback:
						'That would require carry lookahead. This circuit exposes a serial $C_i\\to C_{i+1}$ dependency, so simultaneous settlement is impossible.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance without reading its label. Compare the expected overflow with the observed sum: which information path stopped carrying evidence forward?'
	},
	rc: {
		curriculum: {
			order: 2,
			prerequisites: [],
			objective: 'Predict how component values move a first-order pole and attenuation.'
		},
		actions: [
			action(
				'input[aria-label^="Stimulus frequency"]',
				'change',
				'sweep the stimulus-frequency control across the cutoff',
				1,
				'control',
				'frequency-above-cutoff'
			),
			action(
				'input[aria-label="Capacitance"]',
				'change',
				'change the capacitance control and compare the cutoff'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden filter disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt: 'Keep $R$ fixed and increase $C$. What happens to the cutoff $f_c$?',
			choices: [
				{
					id: 'cutoff-falls',
					label: '$f_c$ falls, so attenuation begins at a lower frequency.',
					correct: true,
					feedback:
						'Correct: $f_c=1/(2\\pi RC)$. A larger charge reservoir takes longer to respond, moving the pole downward.'
				},
				{
					id: 'cutoff-rises',
					label: '$f_c$ rises, so more high-frequency signal passes.',
					correct: false,
					feedback:
						'The denominator grows with $C$, so this prediction has the direction reversed. Test it against the moving cutoff marker.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance, then sweep well above the old cutoff. Does the output still show a pole, and which branch would explain the changed frequency response?'
	},
	bell: {
		curriculum: {
			order: 3,
			prerequisites: [],
			objective:
				'Distinguish an entangled Bell state from a classical mixture using outcomes and CHSH.'
		},
		actions: [
			action('button.btn-solid', 'click', 'collect two independent 64-shot samples', 2),
			action('button.btn-solid', 'click', 'collect another sample and inspect the CHSH witness'),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden preparation disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'After $H$ and CNOT prepare $|\\Phi^+\\rangle$, which outcomes can a $Z$-basis measurement produce?',
			choices: [
				{
					id: 'correlated-pair',
					label: 'Only $00$ and $11$, with approximately equal frequency.',
					correct: true,
					feedback:
						'Exactly. The amplitudes of $|01\\rangle$ and $|10\\rangle$ are zero; sampling reveals perfect same-bit correlation.'
				},
				{
					id: 'four-uniform',
					label: 'All four bit strings with equal probability.',
					correct: false,
					feedback:
						'That describes two independent superpositions. The CNOT removes the cross outcomes by correlating the two rails.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the preparation, sample again, and use both the histogram and $S$ value to identify which operation stopped creating non-classical correlation.'
	},
	timer: {
		curriculum: {
			order: 4,
			prerequisites: ['rc'],
			objective: 'Relate RC charge thresholds to oscillator frequency and duty cycle.'
		},
		actions: [
			action('input[aria-label="R A"]', 'change', 'change R_A and inspect the capacitor trace'),
			action('input[aria-label="R B"]', 'change', 'change R_B and inspect the duty cycle'),
			action(
				'.mode-row [role="radio"]:last-child',
				'click',
				'switch to monostable mode before firing a one-shot'
			)
		],
		prediction: {
			prompt: 'Increase $R_B$ while $R_A$ and $C$ stay fixed. What changes first?',
			choices: [
				{
					id: 'slower-symmetric',
					label: 'The oscillator slows and its duty cycle moves closer to $50\\%$.',
					correct: true,
					feedback:
						'Yes. $R_B$ lengthens both paths and makes their times more alike; $R_A$ remains only in the charge path, so exact $50\\%$ is still unreachable.'
				},
				{
					id: 'faster-higher-duty',
					label: 'The oscillator speeds up and spends a larger fraction high.',
					correct: false,
					feedback:
						'Increasing $R_B$ lengthens the RC time constant. It also reduces the relative influence of $R_A$, moving duty downward toward—not away from—$50\\%$.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the threshold network and watch $V_C$. Which missing threshold crossing best explains the output becoming motionless?'
	},
	teleport: {
		curriculum: {
			order: 5,
			prerequisites: ['bell'],
			objective:
				'Explain why entanglement and two classical bits are both necessary for teleportation.'
		},
		actions: [
			sequenceAction(
				['input[aria-label="Theta"]', 'input[aria-label="Phi"]'],
				'change',
				'set θ, then set φ on the Bloch sphere'
			),
			action(
				'button[title="Step forward"]',
				'click',
				'advance through all five remaining protocol stages',
				5
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden communication disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'Alice completes her Bell measurement but Bob receives no correction bits. What happens to fidelity?',
			choices: [
				{
					id: 'fidelity-drops',
					label: 'It drops because Bob cannot undo the measurement-dependent rotation.',
					correct: true,
					feedback:
						'Correct. Entanglement transfers the state only up to one of four Pauli frames; $m_1,m_2$ tell Bob which frame to undo.'
				},
				{
					id: 'fidelity-stays-one',
					label: 'It remains $1$ because entanglement already carried the complete state.',
					correct: false,
					feedback:
						'Entanglement alone cannot signal or select Bob’s Pauli frame. If this were true, teleportation would permit faster-than-light communication.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb one communication path, step to the end, and compare the measurement bits with Bob’s corrections. Which required dependency is absent?'
	},
	buck: {
		curriculum: {
			order: 6,
			prerequisites: ['rc'],
			objective: 'Predict averaged buck-converter output and recognize conduction-mode boundaries.'
		},
		actions: [
			action(
				'input[min="0.05"][max="0.95"]',
				'change',
				'change the duty-cycle control and compare output voltage'
			),
			action(
				'input[min="1"][max="30"]',
				'change',
				'change load resistance until the conduction classifier changes',
				1,
				'control',
				'conduction-left-ccm'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden power-stage disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'In continuous conduction, increase $D$ while $V_{in}$ stays fixed. What should $v_o$ do?',
			choices: [
				{
					id: 'output-rises',
					label: 'It rises approximately in proportion to $D$.',
					correct: true,
					feedback:
						'Yes. Inductor volt-second balance gives $v_o\\approx D V_{in}$ in the ideal continuous-conduction regime.'
				},
				{
					id: 'output-fixed',
					label: 'It remains fixed because the $LC$ network rejects PWM changes.',
					correct: false,
					feedback:
						'The filter rejects switching ripple, not the PWM average. Changing duty changes the average energy delivered each cycle.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the power stage and compare duty command, switch-node activity, and $v_o$. Where does commanded energy stop entering the $LC$ network?'
	},

	statechart: {
		curriculum: {
			order: 7,
			prerequisites: ['adder'],
			objective: 'Predict guarded state transitions and identify a liveness failure.'
		},
		actions: [
			action(
				'.button-row button.btn-solid',
				'click',
				'fire three timer events to complete one state cycle',
				3
			),
			action(
				'.button-row button.btn-solid',
				'click',
				'fire the next event and inspect whether an edge is enabled'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden guard disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'An event arrives with no enabled transition from the current state. What must a deterministic machine do?',
			choices: [
				{
					id: 'hold-state',
					label: 'Hold the current state.',
					correct: true,
					feedback:
						'Correct. With no matching edge, $\\delta(s,e)$ produces no transition; inventing a destination would make the model non-deterministic.'
				},
				{
					id: 'reset',
					label: 'Jump automatically to the initial state.',
					correct: false,
					feedback:
						'A reset requires an explicit transition or reset event. No enabled edge means the active-state token stays where it is.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb one guard, drive the token around the cycle, and locate the state whose exit can no longer become enabled.'
	},
	qec: {
		curriculum: {
			order: 8,
			prerequisites: ['bell'],
			objective:
				'Infer a single-qubit bit flip from syndrome parity without reading the logical state.'
		},
		actions: [
			action('.inject-row button', 'click', 'inject one bit flip on a physical qubit'),
			action(
				'.stack .button-row button.btn-solid',
				'click',
				'extract the syndrome and apply correction'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden decoder disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt: 'What information do the two syndrome measurements reveal?',
			choices: [
				{
					id: 'disagreement-only',
					label: 'Which physical qubits disagree, not the logical amplitudes.',
					correct: true,
					feedback:
						'Exactly. Stabilizer parity identifies the error location while preserving the unknown $\\alpha$ and $\\beta$.'
				},
				{
					id: 'logical-value',
					label: 'Whether the encoded logical qubit is $|0\\rangle$ or $|1\\rangle$.',
					correct: false,
					feedback:
						'That measurement would collapse the protected superposition. The syndrome deliberately extracts only relational parity.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the correction map, inject one error, and compare syndrome with the corrected rail. Which mapping sends correction to the wrong qubit?'
	},
	wien: {
		curriculum: {
			order: 9,
			prerequisites: ['rc'],
			objective: 'Use loop gain and phase to predict oscillator startup or decay.'
		},
		actions: [
			action('input[aria-label="Gain"]', 'change', 'set gain below three and inspect decay'),
			action(
				'input[aria-label="Gain"]',
				'change',
				'move gain across three and inspect the phase portrait'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden gain-path disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt: 'Set amplifier gain just below $3$. What happens to a small disturbance at $f_0$?',
			choices: [
				{
					id: 'decays',
					label: 'It decays to silence.',
					correct: true,
					feedback:
						'Correct. The Wien network returns one third, so gain below $3$ makes $A\\beta<1$ and every trip around the loop shrinks.'
				},
				{
					id: 'grows',
					label: 'It grows into a stable sinusoid.',
					correct: false,
					feedback:
						'Growth requires loop gain above unity. Below the Barkhausen threshold, noise loses amplitude on every circulation.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the gain path and distinguish a bounded limit cycle from rail clipping. Which loop condition is no longer regulated?'
	},
	lfsr: {
		curriculum: {
			order: 10,
			prerequisites: ['adder'],
			objective: 'Connect primitive feedback taps to the period of an LFSR sequence.'
		},
		actions: [
			action(
				'.button-row button:nth-of-type(2)',
				'click',
				'single-step the LFSR and read the register'
			),
			action(
				'.button-row button:nth-of-type(2)',
				'click',
				'step through the remaining fourteen non-zero states',
				14
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden feedback disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'Move one feedback tap away from the primitive polynomial. Must the period remain $15$?',
			choices: [
				{
					id: 'period-can-shorten',
					label: 'No. The state graph can split into shorter cycles.',
					correct: true,
					feedback:
						'Correct. Maximal period is a property of primitive taps, not merely of having four flip-flops.'
				},
				{
					id: 'period-always-fifteen',
					label: 'Yes. Any nonzero four-bit register has period $2^4-1$.',
					correct: false,
					feedback:
						'$2^n-1$ is an upper bound reached only by a primitive feedback polynomial. Other taps partition the states into shorter loops.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the feedback network, record repeats, and infer from the shortened cycle which recurrence no longer spans all non-zero states.'
	},
	grover: {
		curriculum: {
			order: 11,
			prerequisites: ['bell'],
			objective: 'Explain Grover search as amplitude rotation and identify over-rotation.'
		},
		actions: [
			action('.qubits button', 'click', 'choose a marked target state'),
			action(
				'.timeline button[aria-label="Next step"]',
				'click',
				'advance through two complete oracle-and-diffusion rounds',
				6
			),
			action(
				'.timeline button[aria-label="Next step"]',
				'click',
				'advance one more round and inspect over-rotation',
				3
			)
		],
		prediction: {
			prompt:
				'For $N=8$, apply a third Grover round after the optimal two. What happens to target probability?',
			choices: [
				{
					id: 'probability-falls',
					label: 'It falls because the state rotates past the target.',
					correct: true,
					feedback:
						'Correct. Grover amplification is a rotation, not monotonic accumulation; too many iterations move amplitude away again.'
				},
				{
					id: 'probability-rises',
					label: 'It keeps rising toward $100\\%$.',
					correct: false,
					feedback:
						'The rotation angle is fixed. Once the target direction is passed, another reflection pair lowers its amplitude.'
				}
			]
		},
		diagnosisPrompt:
			'Disturb the oracle, run two rounds, and compare the requested target with the amplified bar. Which state did the phase flip actually mark?'
	}
};

/**
 * Detail-page copies add explicit LaTeX boundaries around technical notation.
 * Catalogue text stays plain and compact; only the opened simulation pays for
 * these KaTeX spans, and no client-side math renderer is shipped.
 */
interface DetailMathCopy {
	readonly summary?: string;
	readonly inventory?: readonly string[];
	readonly boundaries?: readonly string[];
}

const DETAIL_MATH_COPY: Readonly<Record<string, DetailMathCopy>> = {
	adder: {
		inventory: [
			'$8\\times$ full-adder cell',
			'$16\\times$ XOR + $16\\times$ AND',
			'$8\\times$ OR carry merge',
			'$A/B/C_{in}$ + Sum ports'
		],
		boundaries: [
			'$8$-bit operands · $0$–$255$',
			'sum $0$–$511$ with carry-out',
			'per-gate propagation delay'
		]
	},
	rc: {
		summary:
			'A first-order shunt-capacitor filter. The cutoff and the $|H(j\\omega)|$ magnitude are derived live; the output wire fades its opacity and stretches its dash pattern to visualise physical damping, and both channels drive the oscilloscope.',
		inventory: [
			'input source node',
			'series resistor $R$',
			'shunt capacitor $C$',
			'reference ground'
		],
		boundaries: [
			'$R: 100\\ \\Omega$–$1\\ \\mathrm{M\\Omega}$',
			'$C: 1\\ \\mathrm{nF}$–$10\\ \\mathrm{\\mu F}$',
			'sweep $10\\ \\mathrm{Hz}$–$100\\ \\mathrm{kHz}$'
		]
	},
	bell: {
		summary:
			'$H$ on $q_0$ followed by $\\operatorname{CNOT}(q_0\\to q_1)$. Toggling the initialization ports selects which Bell pair is prepared; amplitudes and the correlation index are derived, and a measure button accumulates real Born-rule shots.',
		inventory: [
			'$2\\times$ qubit register line',
			'Hadamard gate',
			'CNOT control/target',
			'measurement ports'
		],
		boundaries: [
			'$4$ Bell states',
			'amplitudes $\\pm 1/\\sqrt{2}$',
			'CHSH witness $S\\in[0,2\\sqrt{2}]$'
		]
	},
	timer: {
		summary:
			'The timing capacitor integrates between $\\tfrac{1}{3}V_{cc}$ and $\\tfrac{2}{3}V_{cc}$. The timing-branch stroke weight scales with instantaneous $V_C$, and the LED node flashes in sync with the calculated frequency (time-scaled for visibility).',
		inventory: [
			'8-pin 555 IC block',
			'$R_A + R_B$ timing pair',
			'timing capacitor $C_T$',
			'output LED + limiter'
		],
		boundaries: [
			'$V_{cc}=5\\ \\mathrm V$',
			'threshold $\\tfrac{2}{3}$ · trigger $\\tfrac{1}{3}$',
			'astable + monostable modes'
		]
	},
	teleport: {
		summary:
			'Alice’s state $|\\psi\\rangle$ is parameterised on the Bloch angles. Stepped playback advances the register through entanglement, Bell measurement, and the classically controlled $X^{m_2}/Z^{m_1}$ corrections; hovering any gate reveals its action in Dirac notation.',
		inventory: [
			'$3\\times$ qubit trace $(\\psi,A,B)$',
			'$H$ + CNOT preparation',
			'Bell-basis measurement',
			'$X/Z$ correction gates'
		],
		boundaries: [
			'Bloch $\\theta\\in[0,\\pi],\\ \\phi\\in[0,2\\pi]$',
			'$6$-step protocol',
			'fidelity $F=|\\langle\\psi|\\psi_{out}\\rangle|^2$'
		]
	},
	buck: {
		summary:
			'A synchronous step-down converter with a continuous-time $L$–$C$ state solver and switching-ripple reconstruction. Sweep duty cycle, source voltage, load, inductance, capacitance, and carrier frequency; the laboratory identifies conduction mode, efficiency, ripple, and transient settling in real time.',
		inventory: [
			'PWM feedback controller',
			'PMOS high-side switch',
			'Schottky freewheel diode',
			'$L$–$C$ output network'
		],
		boundaries: [
			'$V_{in}: 5$–$36\\ \\mathrm V$',
			'$f_{sw}: 20$–$500\\ \\mathrm{kHz}$',
			'CCM / BCM / DCM classification'
		]
	},

	statechart: {
		boundaries: ['deterministic $\\delta$', 'one active state', 'guarded, timed transitions']
	},
	qec: {
		inventory: [
			'logical qubit $\\to 3$ physical',
			'injectable $X$ error',
			'$2$ ancilla syndrome bits',
			'majority-vote decoder'
		],
		boundaries: [
			'corrects any single bit-flip',
			'syndrome $\\in\\{00,01,10,11\\}$',
			'logical fidelity $0/1$'
		]
	},
	wien: {
		summary:
			'A non-inverting op-amp wrapped in a Wien $RC$ network. When the loop gain crosses unity at exactly one frequency, thermal noise is amplified into a clean sinusoid; a nonlinear gain limiter parks the amplitude on a stable limit cycle. The phase portrait shows the oscillation being born — a Hopf bifurcation you can trigger with a knob.',
		inventory: [
			'op-amp gain stage',
			'series + shunt $RC$ bridge',
			'$R_f/R_g$ gain setting',
			'amplitude-limiting element'
		],
		boundaries: ['gain $2.8$–$3.2$', '$f_0$ from $RC$', 'Hopf onset at gain $=3$']
	},
	lfsr: {
		summary:
			'A 4-bit Fibonacci linear-feedback shift register with taps at stages 3 and 4 — the primitive polynomial $x^4+x^3+1$. Each clock edge shifts the register and feeds back the XOR of the tapped bits. The result cycles through all 15 non-zero states before repeating: a deterministic sequence wearing the disguise of randomness.',
		inventory: [
			'shared clock',
			'$4\\times$ D flip-flop chain',
			'XOR feedback taps $3,4$',
			'serial m-sequence output'
		],
		boundaries: ['period $2^4-1=15$', 'all-zero state forbidden', 'primitive polynomial taps']
	},
	grover: {
		summary:
			'Grover’s algorithm searching an $8$-item space with $3$ qubits. Uniform superposition, then repeated rounds of oracle (phase-flip the target) and diffusion (invert about the mean) rotate the state vector toward the marked item. Real $8$-amplitude linear algebra drives a live bar chart; after the optimal $\\lfloor\\pi\\sqrt{8}/4\\rfloor=2$ rounds the target probability peaks near $94\\%$.',
		inventory: [
			'$3$-qubit uniform superposition',
			'oracle $U_f$ (phase flip)',
			'diffusion $2|s\\rangle\\langle s|-I$',
			'$8$-state amplitude readout'
		],
		boundaries: [
			'$N=8$ search space',
			'optimal $k=2$ rounds',
			'peak $P(\\mathrm{target})\\approx0.945$'
		]
	}
};

/** Public environment registry with server-rendered, accessible mathematical notation. */
export const SIM_ENVIRONMENTS: readonly SimEnvironment[] = SIM_ENVIRONMENTS_RAW.map(
	(environment): SimEnvironment => {
		const learning = LEARNING_DESIGN[environment.id];
		if (!learning) throw new Error(`Missing learning design for simulation "${environment.id}".`);
		if (learning.actions.length !== environment.pedagogy.steps.length) {
			throw new Error(
				`Learning-action count does not match steps for simulation "${environment.id}".`
			);
		}
		return {
			...environment,
			curriculum: learning.curriculum,
			formulaHtml: renderFormula(environment.formula),
			pedagogy: {
				aha: environment.pedagogy.aha,
				ahaHtml: renderProse(environment.pedagogy.aha),
				principleHtml: renderProse(environment.pedagogy.principle),
				prediction: {
					prompt: learning.prediction.prompt,
					promptHtml: renderProse(learning.prediction.prompt),
					choices: learning.prediction.choices.map((choice) => ({
						id: choice.id,
						label: choice.label,
						labelHtml: renderProse(choice.label),
						correct: choice.correct,
						feedbackHtml: renderProse(choice.feedback)
					}))
				},
				steps: environment.pedagogy.steps.map((step, index) => ({
					label: step.label,
					labelHtml: renderProse(step.label),
					detailHtml: renderProse(step.detail),
					action: learning.actions[index]!
				})),
				diagnosisPrompt: learning.diagnosisPrompt,
				diagnosisPromptHtml: renderProse(learning.diagnosisPrompt)
			}
		};
	}
);

const META_BY_ID = new Map(SIM_ENVIRONMENTS.map((environment) => [environment.id, environment]));
const compiledCache = new Map<string, CompiledSimulation>();

/** List the environment descriptors for the selector — no compilation cost. */
export function listSimulationEnvironments(): readonly SimEnvironment[] {
	return SIM_ENVIRONMENTS;
}

/** True when `id` names a real laboratory environment. */
export function isSimulationId(id: string): boolean {
	return META_BY_ID.has(id);
}

/** Expose immutable source for route tests and downloadable lab fixtures. */
export function getSimulationSource(id: string): string | undefined {
	return SOURCES[id]?.source;
}

/** Compile (once, cached) and return the full document for one environment. */
export function getSimulation(id: string): CompiledSimulation | undefined {
	const cached = compiledCache.get(id);
	if (cached) return cached;

	const meta = META_BY_ID.get(id);
	const spec = SOURCES[id];
	if (!meta || !spec) return undefined;

	const fence = parseSchematicFence(
		`schemd bounds="${spec.width}x${spec.height}" title="${meta.title}"`
	);
	if (!fence) throw new Error(`Unreachable: canonical fence for ${id}.`);

	const compilation = compileSchematic(spec.source, {
		...fence,
		mode: 'full',
		idPrefix: `sim-${id}`
	});
	const detailCopy = DETAIL_MATH_COPY[id];

	const result: CompiledSimulation = {
		...meta,
		svg: compilation.svg,
		components: compilation.metrics.components,
		connections: compilation.metrics.connections,
		summaryHtml: renderProse(detailCopy?.summary ?? meta.summary),
		modelHtml: renderProse(meta.model),
		inventoryHtml: (detailCopy?.inventory ?? meta.inventory).map(renderProse),
		boundariesHtml: (detailCopy?.boundaries ?? meta.boundaries).map(renderProse),
		faultHtml: renderProse(meta.fault)
	};
	compiledCache.set(id, result);
	return result;
}
