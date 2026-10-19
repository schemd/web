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
import { RC_FILTER_BOUNDS, RC_FILTER_SOURCE } from '#lib/diagrams.ts';

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

const TDR_SOURCE = `// Transmission line — a step launched into a lossless line, drawn as its distributed L–C ladder
source:VS "V_s" at (80, 250) #amber [type=voltage-pulse]
resistor:RS "R_s" at (200, 110) #amber
junction:NEAR "near end" at (320, 110) #amber
inductor:L1 "L·dx" at (420, 110) #cyan
junction:N1 "x_1" at (520, 110) #cyan
capacitor:C1 "C·dx" at (520, 250) #cyan [orientation=down]
inductor:L2 "L·dx" at (620, 110) #cyan
junction:N2 "x_2" at (720, 110) #cyan
capacitor:C2 "C·dx" at (720, 250) #cyan [orientation=down]
inductor:L3 "L·dx" at (820, 110) #cyan
junction:FAR "far end" at (920, 110) #emerald
resistor:RL "Z_L" at (1020, 250) #emerald [type=variable orientation=down]
ground:G0 "0 V" at (80, 390) #slate
ground:G1 "0 V" at (520, 390) #slate
ground:G2 "0 V" at (720, 390) #slate
ground:G3 "0 V" at (1020, 390) #slate

VS.positive -> RS.in #amber [ortho]
RS.out -> NEAR.node #amber [line]
NEAR.node -> L1.in #cyan [line]
L1.out -> N1.node #cyan [line]
N1.node -> C1.in #cyan [ortho]
N1.node -> L2.in #cyan [line]
L2.out -> N2.node #cyan [line]
N2.node -> C2.in #cyan [ortho]
N2.node -> L3.in #cyan [line]
L3.out -> FAR.node #emerald [line]
FAR.node -> RL.in #emerald [ortho]
C1.out -> G1.in #slate [line]
C2.out -> G2.in #slate [line]
RL.out -> G3.in #slate [line]
VS.negative -> G0.in #slate [ortho]`;

const PLL_SOURCE = `// Phase-locked loop — phase detector, RC loop filter, voltage-controlled oscillator
source:REF "f_{ref}" at (90, 200) #amber [type=voltage-ac]
xor:PD "PD" at (280, 160) #purple [inputs=2]
resistor:RF "R" at (440, 160) #cyan
junction:VC "v_c" at (570, 160) #cyan
capacitor:CF "C" at (570, 300) #cyan [orientation=down]
ic:VCO "VCO" at (740, 160) #emerald [left="vc" right="osc"]
junction:FOUT "f_{out}" at (900, 160) #emerald
port:OUT "f_{out}" at (1010, 160) #emerald
ground:GND "0 V" at (570, 420) #slate

REF.positive -> PD.in1 #amber [ortho]
PD.out -> RF.in #purple [ortho]
RF.out -> VC.node #cyan [line]
VC.node -> VCO.vc #cyan [ortho]
VC.node -> CF.in #cyan [ortho]
CF.out -> GND.in #slate [ortho]
REF.negative -> GND.in #slate [ortho]
VCO.osc -> FOUT.node #emerald [line]
FOUT.node -> OUT.in #emerald [ortho]
FOUT.node -> PD.in2 #emerald [ortho label="feedback"]`;

const CLASSD_SOURCE = `// Class-D amplifier — comparator PWM, half-bridge switch, LC output filter, speaker
source:AUD "audio" at (70, 150) #cyan [type=voltage-ac]
source:TRI "carrier" at (180, 340) #amber [type=voltage-pulse]
amplifier:CMP "PWM" at (280, 230) #purple [type=comparator]
ic:BRIDGE "bridge" at (460, 230) #purple [left="g" right="sw"]
inductor:LF "L" at (630, 230) #cyan
junction:VO "v_o" at (770, 230) #emerald
capacitor:CF "C" at (770, 360) #cyan [orientation=down]
load:SPK "speaker" at (920, 340) #emerald [type=speaker orientation=down]
ground:GNDS "0 V" at (180, 480) #slate
junction:RTN "return" at (770, 450) #slate
ground:GND "0 V" at (770, 510) #slate

AUD.positive -> CMP.positive #cyan [ortho]
TRI.positive -> CMP.negative #amber [ortho]
CMP.out -> BRIDGE.g #purple [ortho]
BRIDGE.sw -> LF.in #purple [ortho]
LF.out -> VO.node #cyan [line]
VO.node -> CF.in #cyan [ortho]
VO.node -> SPK.in #emerald [ortho]
CF.out -> RTN.node #slate [ortho]
SPK.out -> RTN.node #slate [ortho]
RTN.node -> GND.in #slate [line]
AUD.negative -> GNDS.in #slate [ortho]
TRI.negative -> GNDS.in #slate [ortho]`;

const PID_SOURCE = `// DC motor speed loop — error, parallel P, I and D paths, driver, motor, tachometer feedback
port:SET "ω_{set}" at (70, 240) #amber
ic:ERR "Σ" at (210, 240) #purple [left="sp,fb" right="e"]
ic:KP "K_p" at (400, 70) #purple [left="e" right="u"]
ic:KI "K_i/s" at (400, 240) #purple [left="e" right="u"]
ic:KD "K_d·s" at (400, 410) #purple [left="e" right="u"]
ic:SUM "Σ" at (580, 240) #purple [left="p,i,d" right="u"]
ic:DRV "driver" at (730, 240) #amber [left="u" right="v"]
load:M "motor" at (900, 240) #amber [type=motor]
ic:TACH "tacho" at (900, 500) #emerald [left="fb" right="shaft"]

SET.out -> ERR.sp #amber [ortho]
ERR.e -> KP.e #purple [ortho]
ERR.e -> KI.e #purple [ortho]
ERR.e -> KD.e #purple [ortho]
KP.u -> SUM.p #purple [ortho]
KI.u -> SUM.i #purple [ortho]
KD.u -> SUM.d #purple [ortho]
SUM.u -> DRV.u #purple [line]
DRV.v -> M.in #amber [ortho]
M.out -> TACH.shaft #emerald [ortho label="shaft ω"]
TACH.fb -> ERR.fb #emerald [ortho label="feedback"]`;

const SIGMADELTA_SOURCE = `// Sigma-delta modulator — integrate the error, decide one bit, feed the bit back
source:VIN "x" at (80, 170) #cyan [type=voltage-ac]
ic:SUM "Σ" at (240, 150) #cyan [left="x,fb" right="e"]
ic:INT "∫" at (400, 150) #purple [left="e" right="y"]
amplifier:Q "1-bit" at (570, 170) #purple [type=comparator]
flipflop:FF "D" at (740, 170) #amber [type=d]
clock:CLK "f_s" at (600, 330) #amber
ic:DAC "DAC" at (740, 360) #amber [left="v" right="d"]
ic:DEC "decimate" at (950, 170) #emerald [left="bits" right="y"]
port:OUT "y" at (1130, 170) #emerald
ground:GND "0 V" at (470, 300) #slate

VIN.positive -> SUM.x #cyan [ortho]
SUM.e -> INT.e #cyan [line]
INT.y -> Q.positive #purple [ortho]
GND.in -> Q.negative #slate [ortho]
VIN.negative -> GND.in #slate [ortho]
Q.out -> FF.d #purple [ortho]
CLK.out -> FF.clock #amber [ortho]
FF.q -> DEC.bits #amber [ortho]
FF.q -> DAC.d #amber [ortho]
DAC.v -> SUM.fb #amber [ortho label="feedback"]
DEC.y -> OUT.in #emerald [line]`;

const UART_SOURCE = `// UART link — transmitter frames a byte, one wire carries it, receiver samples mid-bit
port:BYTE "byte" at (70, 150) #blue
clock:TCLK "baud_{tx}" at (70, 290) #amber
ic:TX "UART TX" at (260, 190) #purple [left="data,clk" right="tx"]
testpoint:LINE "line" at (470, 190) #cyan
ic:RX "UART RX" at (700, 190) #purple [left="rx,clk" right="data,err"]
clock:RCLK "baud_{rx}" at (520, 320) #amber
port:DATA "byte" at (930, 160) #emerald
port:ERR "error" at (930, 240) #f2555a

BYTE.out -> TX.data #blue [ortho]
TCLK.out -> TX.clk #amber [ortho]
TX.tx -> LINE.node #cyan [ortho]
LINE.node -> RX.rx #cyan [ortho]
RCLK.out -> RX.clk #amber [ortho]
RX.data -> DATA.in #emerald [ortho]
RX.err -> ERR.in #f2555a [ortho]`;

const KICKBACK_SOURCE = `// Phase kickback — H, a controlled phase onto an eigenstate, H, measure the control
prepare:C0 "|0⟩" at (80, 140) #purple
prepare:T0 "|1⟩" at (80, 230) #cyan
hadamard:H1 "H" at (240, 140) #purple
cphase:CP "P(φ)" at (440, 185) #amber
hadamard:H2 "H" at (640, 140) #purple
measure:M "M" at (820, 140) #emerald
port:TOUT "target" at (820, 230) #cyan

C0.out -> H1.in #purple [line]
H1.out -> CP.in1 #purple [ortho]
T0.out -> CP.in2 #cyan [ortho]
CP.out1 -> H2.in #purple [ortho]
H2.out -> M.in #emerald [line]
CP.out2 -> TOUT.in #cyan [ortho]`;

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
	grover: { source: GROVER_SOURCE, width: 1240, height: 460 },
	tdr: { source: TDR_SOURCE, width: 1100, height: 470 },
	pll: { source: PLL_SOURCE, width: 1080, height: 500 },
	classd: { source: CLASSD_SOURCE, width: 1040, height: 580 },
	pid: { source: PID_SOURCE, width: 1040, height: 580 },
	sigmadelta: { source: SIGMADELTA_SOURCE, width: 1240, height: 480 },
	uart: { source: UART_SOURCE, width: 1040, height: 420 },
	kickback: { source: KICKBACK_SOURCE, width: 940, height: 360 }
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
	},
	{
		id: 'tdr',
		index: '12',
		title: 'Transmission-Line Reflections',
		domain: 'Signal integrity',
		tier: 'Advanced',
		model: 'lattice (bounce) diagram of a lossless line',
		tagline: 'Launch a step down a cable and watch the far end answer back.',
		summary:
			'A step behind a source resistance enters a lossless line, drawn as its distributed L–C ladder. Each end reflects a fraction Γ of every arriving wave; the lattice sum gives the voltage at every point and instant, so the probes read a real time-domain reflectometer.',
		formula: '\\Gamma = \\dfrac{Z - Z_0}{Z + Z_0} \\;\\cdot\\; V_1 = V_s\\,\\dfrac{Z_0}{R_s + Z_0}',
		inventory: [
			'step source + R_s',
			'3-section L–C ladder (Z₀, t_d)',
			'load Z_L',
			'near/far probes'
		],
		boundaries: ['Z_L 5 Ω – 5 kΩ', 'Z₀ 25 – 150 Ω', 'time 0 – 10 t_d'],
		fault: 'load connector open',
		pedagogy: {
			aha: 'A wire is not instant. For one trip of the line the source cannot know what is at the far end — and the reflection is the far end’s answer.',
			principle:
				'Long enough wires stop behaving like a single node. A step enters the line seeing only its characteristic impedance $Z_0 = \\sqrt{L/C}$, so it launches $V_1 = V_s\\,\\frac{Z_0}{R_s+Z_0}$ whatever the load is. One delay $t_d$ later the wave reaches the load, which reflects the fraction $\\Gamma_L = \\frac{Z_L - Z_0}{Z_L + Z_0}$ back toward the source; there $\\Gamma_S$ reflects it again. An open end ($\\Gamma = +1$) doubles the voltage, a short ($\\Gamma = -1$) cancels it, and a **matched** load ($Z_L = Z_0$, $\\Gamma = 0$) swallows the wave so the line behaves as if it went on forever. The near-end trace is a map of the line: each step is an echo, and its time tells you how far away the mismatch is.',
			steps: [
				{
					label: 'Sweep the load and read the echo.',
					detail:
						'Drag $Z_L$ above and below $Z_0$. The near-end probe shows a second step at $2t_d$ whose sign follows $\\Gamma_L$: up for a high load, down for a low one.'
				},
				{
					label: 'Match the load to the line.',
					detail:
						'With $Z_L = Z_0$ the far end absorbs the wave on arrival: no echo, and the near end settles at $V_1$ in a single step. This is why fast buses are terminated.'
				},
				{
					label: 'Diagnose a far end that answers wrongly.',
					detail:
						'Inject the disturbance and read the echo’s sign and size. Work out $\\Gamma_L$ from the near-end step, then infer what the load must now look like.'
				}
			]
		}
	},
	{
		id: 'pll',
		index: '13',
		title: 'Phase-Locked Loop',
		domain: 'Active analog',
		tier: 'Advanced',
		model: 'nonlinear phase-error dynamics',
		tagline: 'An oscillator that listens: it tunes itself until its phase stops slipping.',
		summary:
			'A sinusoidal phase detector compares the reference with the VCO, a first-order RC loop filter smooths the error into a control voltage, and the VCO retunes. The phase error and control voltage are integrated live, so acquisition, lock, and cycle slipping all appear on the scope and in the phase portrait.',
		formula:
			'\\dot\\theta_e = \\omega_{ref} - (\\omega_0 + K_v v_c) \\;\\cdot\\; \\tau\\,\\dot v_c = K_d \\sin\\theta_e - v_c',
		inventory: [
			'reference oscillator',
			'XOR phase detector',
			'RC loop filter',
			'VCO with feedback'
		],
		boundaries: ['f_ref, f₀ 8 – 12 kHz', 'hold range ±K_vK_d = ±1.2 kHz', 'τ = RC 0.05 – 2 ms'],
		fault: 'loop filter shorted to ground',
		pedagogy: {
			aha: 'Lock is not equal frequencies by luck — it is the loop holding a constant phase error, because a constant error is exactly the voltage the VCO needs.',
			principle:
				'The detector outputs $K_d\\sin\\theta_e$, the filter averages it into $v_c$, and the VCO runs at $\\omega_0 + K_v v_c$. If the reference sits above the free-running frequency, the VCO needs a positive control voltage to keep up, and the only way to make one is a **steady phase lead**: $\\sin\\theta_e = \\frac{\\omega_{ref}-\\omega_0}{K_vK_d}$. That is why a locked loop shows a fixed offset between the two waves, not zero. Push the detuning past the hold range $|\\omega_{ref}-\\omega_0| < K_vK_d$ and no phase can produce enough voltage: the error grows without bound and the loop **slips cycles**, which the phase portrait shows as an orbit instead of a point.',
			steps: [
				{
					label: 'Retune the reference and watch the loop follow.',
					detail:
						'Move $f_{ref}$ inside the hold range. The VCO frequency chases it, rings once or twice through the loop filter, and settles with a new, constant phase offset.'
				},
				{
					label: 'Push the reference beyond the hold range.',
					detail:
						'Detune past $K_vK_d$. The phase error now runs away, $v_c$ beats instead of settling, and the portrait traces a closed orbit: cycle slipping.'
				},
				{
					label: 'Diagnose a loop that never pulls in.',
					detail:
						'Inject the disturbance and compare the control voltage with the detector output. Ask which block stopped turning phase error into a tuning voltage.'
				}
			]
		}
	},
	{
		id: 'classd',
		index: '14',
		title: 'Class-D Amplifier You Can Hear',
		domain: 'Power electronics',
		tier: 'Advanced',
		model: 'natural-sampling PWM + 2nd-order LC filter',
		tagline: 'Chop audio into a square wave, then filter the music back out — and listen to both.',
		summary:
			'A comparator turns the audio and a triangle carrier into a two-level PWM wave, a half-bridge switches it at full power, and a Butterworth LC filter recovers the audio. The filter’s gain at the audio and carrier frequencies is computed live, and the Listen button plays the actual signal so the carrier whine is audible when the filter fails to remove it.',
		formula:
			'|H(f)| = \\dfrac{1}{\\sqrt{(1 - r^2)^2 + 2r^2}},\\; r = \\dfrac{f}{f_c} \\;\\cdot\\; f_c = \\dfrac{1}{2\\pi\\sqrt{LC}}',
		inventory: [
			'audio + triangle carrier',
			'PWM comparator',
			'half-bridge switch',
			'LC filter + speaker'
		],
		boundaries: [
			'audio 100 Hz – 2 kHz',
			'carrier 4 – 20 kHz (slowed into earshot)',
			'f_c 0.5 – 50 kHz'
		],
		fault: 'output filter capacitor open',
		pedagogy: {
			aha: 'The transistors only ever know two states — fully on or fully off — and the music lives in how long each one lasts.',
			principle:
				'A linear amplifier wastes power by holding its transistors half-on. A class-D stage never does: the comparator outputs $+1$ while the audio exceeds a triangle carrier and $-1$ otherwise, so the **duty cycle** follows the audio. The switched wave carries the audio at low frequency plus the carrier and its harmonics high above it. A second-order $LC$ low-pass with $f_c = \\frac{1}{2\\pi\\sqrt{LC}}$ passes the first and attenuates the second by about $40\\,\\mathrm{dB}$ per decade. Put $f_c$ well above the audio and well below the carrier and the speaker hears music; let the carrier through and it hears a whine. Real amplifiers switch at hundreds of kilohertz; this one is slowed into earshot so you can hear exactly what the filter removes.',
			steps: [
				{
					label: 'Lower the filter cutoff below the carrier.',
					detail:
						'Increase $C$ until $f_c$ sits between the audio and the carrier. The carrier residual falls by $40\\,\\mathrm{dB}$ per decade of separation; press Listen to hear the whine fade.'
				},
				{
					label: 'Move the carrier closer to the audio.',
					detail:
						'Slow the carrier down. With less room between the two, no single cutoff can pass the audio and block the carrier: the cleanliness readout drops.'
				},
				{
					label: 'Diagnose an amplifier that whines.',
					detail:
						'Inject the disturbance and compare the PWM and output probes. The output now looks like the switched wave: which part of the filter stopped shunting the carrier?'
				}
			]
		}
	},
	{
		id: 'pid',
		index: '15',
		title: 'PID Motor Speed Control',
		domain: 'Control systems',
		tier: 'Advanced',
		model: 'discrete PID + first-order DC motor with saturation',
		tagline: 'Tune three gains until the motor arrives fast, without overshoot, and stays there.',
		summary:
			'A speed loop around a DC motor with inertia, friction, and a saturating driver. The controller sums proportional, integral, and derivative paths with conditional-integration anti-windup; each change re-simulates the full step response, including a load step halfway through, and reports overshoot, settling time, and steady-state error.',
		formula:
			'u = K_p e + K_i\\!\\int e\\,dt + K_d\\,\\dfrac{de}{dt} \\;\\cdot\\; J\\dot\\omega = K u - b\\,\\omega - \\tau_L',
		inventory: [
			'setpoint ω_set',
			'parallel K_p, K_i/s, K_d·s paths',
			'saturating driver',
			'motor + tachometer'
		],
		boundaries: ['K_p 0 – 10', 'K_i 0 – 20', 'K_d 0 – 0.5', 'driver limit ±12 V'],
		fault: 'tachometer feedback inverted',
		pedagogy: {
			aha: 'Each gain answers a different question: P asks how far off you are, I asks how long you have been off, and D asks how fast you are closing in.',
			principle:
				'The error $e = \\omega_{set} - \\omega$ drives three paths. **Proportional** $K_pe$ pushes harder the further off you are, but a motor fighting friction needs a steady push, and a P-only loop can only make one by keeping some error: a steady-state offset. **Integral** $K_i\\int e\\,dt$ keeps adding while any error remains, so it removes that offset, at the price of overshoot if it accumulates too eagerly. **Derivative** $K_d\\,\\dot e$ reacts to how fast the error is shrinking and brakes the approach. The driver saturates at its supply, so an integrator that keeps adding while the output is pinned **winds up**; this controller stops integrating then, which is the anti-windup the lab shows.',
			steps: [
				{
					label: 'Raise the proportional gain and read the offset.',
					detail:
						'With $K_i = 0$, more $K_p$ makes the rise faster and the offset smaller, but never zero: friction needs a push, and P only pushes while there is error.'
				},
				{
					label: 'Add integral action to remove the offset.',
					detail:
						'Raise $K_i$. The steady-state error goes to zero, even after the load step, but too much integral overshoots and rings. Then add $K_d$ to damp it.'
				},
				{
					label: 'Diagnose a loop that runs away.',
					detail:
						'Inject the disturbance and watch the actuator trace. If more gain makes things worse rather than better, ask which way the controller now believes the error points.'
				}
			]
		}
	},
	{
		id: 'sigmadelta',
		index: '16',
		title: 'Sigma-Delta Converter',
		domain: 'Mixed-signal',
		tier: 'Frontier',
		model: '1st/2nd-order ΔΣ modulator + FFT',
		tagline: 'One bit, sampled fast, can carry sixteen — if you push the noise somewhere else.',
		summary:
			'A sine passes through one or two integrators, a one-bit quantizer, and a one-bit DAC in feedback. A 4096-sample FFT of the bitstream shows the quantization noise shaped up and out of the signal band, and the in-band SNR and effective number of bits follow the order and oversampling ratio.',
		formula:
			'Y(z) = X(z) + (1 - z^{-1})^L E(z) \\;\\cdot\\; \\mathrm{ENOB} = \\dfrac{\\mathrm{SNR} - 1.76}{6.02}',
		inventory: [
			'input sine',
			'summing node + integrator',
			'1-bit quantizer, clocked',
			'feedback DAC + decimator'
		],
		boundaries: ['amplitude 0.05 – 0.7', 'OSR 8 – 128', 'order 1 or 2'],
		fault: 'integrator leaks charge',
		pedagogy: {
			aha: 'A one-bit converter is terribly wrong at every instant — but it is wrong in a way that averages out, and the error is pushed to frequencies you are about to throw away.',
			principle:
				'A one-bit quantizer can only say $+1$ or $-1$, an error as large as the signal. The loop fixes it in time rather than in amplitude: the integrator accumulates the difference between the input and every bit already sent, and the next bit is chosen to pay that debt back. Over many samples the **density of ones** tracks the input. In frequency terms the error is multiplied by $(1 - z^{-1})^L$, which is near zero at low frequency and large near $f_s/2$: **noise shaping**. Oversample by $\\mathrm{OSR}$, filter away everything above the signal band, and each doubling of OSR buys about $3(2L+1)\\,\\mathrm{dB}$; a second integrator ($L = 2$) makes that slope much steeper.',
			steps: [
				{
					label: 'Switch to a second-order loop.',
					detail:
						'Compare the spectra: the noise floor near the signal band drops and rises more steeply toward $f_s/2$. The in-band SNR and ENOB climb.'
				},
				{
					label: 'Raise the oversampling ratio.',
					detail:
						'A higher OSR narrows the shaded signal band into the quiet region of the shaped noise. Watch the gain per doubling: about $9\\,\\mathrm{dB}$ for $L=1$ and $15\\,\\mathrm{dB}$ for $L=2$.'
				},
				{
					label: 'Diagnose a converter that lost its resolution.',
					detail:
						'Inject the disturbance and read the low-frequency end of the spectrum. Shaped noise should fall toward DC; ask which block stopped remembering the debt.'
				}
			]
		}
	},
	{
		id: 'uart',
		index: '17',
		title: 'UART Logic Analyzer',
		domain: 'Sequential digital',
		tier: 'Core',
		model: 'asynchronous framing + mid-bit sampling',
		tagline: 'No shared clock: the receiver times every bit from one falling edge.',
		summary:
			'A transmitter frames a byte with a start bit, eight data bits LSB first, optional parity, and a stop bit. The receiver has its own baud clock: it syncs on the start edge and samples the middle of each bit by its own count, so clock mismatch accumulates across the frame and corrupts the last bits first. A logic analyzer shows the line and every sampling instant.',
		formula:
			't_k = \\left(k + \\tfrac12\\right) T_{bit}(1 + \\varepsilon) \\;\\cdot\\; |\\varepsilon| \\lesssim \\dfrac{1}{2N_{bits}}',
		inventory: [
			'byte + TX shift register',
			'single serial line',
			'RX with independent baud clock',
			'data + error outputs'
		],
		boundaries: ['8 data bits, LSB first', 'parity none/even/odd', 'clock error ±10 %'],
		fault: 'TX line polarity inverted',
		pedagogy: {
			aha: 'The receiver only hears the start edge. After that it is counting in the dark, and a few percent of clock error is enough to land in the wrong bit.',
			principle:
				'A UART line idles high. A **start bit** pulls it low; that falling edge is the receiver’s only timing reference. It then waits half a bit and samples, and again every $T_{bit}$ by its own clock, through eight data bits (least significant first), an optional **parity** bit, and a **stop bit** that must read high. If the receiver’s clock is off by $\\varepsilon$, its $k$-th sample lands at $(k + \\frac12)T_{bit}(1+\\varepsilon)$: the error grows with every bit, and once it exceeds half a bit the sample reads a neighbour. With ten bits per frame that allows roughly $|\\varepsilon| < 5\\%$; real links budget about $2\\%$ to share between both ends.',
			steps: [
				{
					label: 'Detune the receiver clock until bits slip.',
					detail:
						'Drag the clock error. The sample ticks drift across the frame, the last bits go first, and eventually the stop bit is read low: a framing error.'
				},
				{
					label: 'Turn on even parity.',
					detail:
						'Parity adds one bit that makes the count of ones even. A single slipped bit now raises a parity error, even when the stop bit still happens to read high.'
				},
				{
					label: 'Diagnose a link that never frames.',
					detail:
						'Inject the disturbance with zero clock error. Read the idle level and the start bit on the analyzer: what would the receiver have to assume to decode this line?'
				}
			]
		}
	},
	{
		id: 'kickback',
		index: '18',
		title: 'Phase Kickback',
		domain: 'Quantum',
		tier: 'Advanced',
		model: 'two-qubit state vector + reduced Bloch vector',
		tagline: 'The gate acts on the target, yet the control is the one that changes.',
		summary:
			'The control qubit is put in superposition, a controlled-phase gate acts on the target, and a final Hadamard reads the control. When the target is an eigenstate of the phase gate, its eigenphase moves onto the control intact; any other target entangles with the control and shortens its Bloch vector. Exact 4-amplitude linear algebra drives the Bloch view and the measurement histogram.',
		formula:
			'\\tfrac{1}{\\sqrt2}(|0\\rangle + |1\\rangle)|1\\rangle \\xrightarrow{CP(\\varphi)} \\tfrac{1}{\\sqrt2}(|0\\rangle + e^{i\\varphi}|1\\rangle)|1\\rangle \\;\\cdot\\; P(1) = \\sin^2\\tfrac{\\varphi}{2}',
		inventory: [
			'control + target qubits',
			'2× Hadamard on the control',
			'controlled-phase CP(φ)',
			'control measurement'
		],
		boundaries: ['φ ∈ [0, 2π]', 'targets |0⟩, |1⟩, |+⟩, |−⟩', 'purity |r| ∈ [0, 1]'],
		fault: 'target prepared off its eigenstate',
		pedagogy: {
			aha: 'A controlled gate is symmetric about which qubit “owns” the phase: if the target is an eigenstate, the phase lands on the control instead.',
			principle:
				'A controlled-phase gate multiplies only $|11\\rangle$ by $e^{i\\varphi}$. Put the control in $|+\\rangle$ and the target in $|1\\rangle$, an **eigenstate** of the phase gate, and the state factorises: $\\tfrac{1}{\\sqrt2}(|0\\rangle + e^{i\\varphi}|1\\rangle)\\otimes|1\\rangle$. The target is untouched, and the phase has been **kicked back** onto the control’s relative phase, where the final Hadamard turns it into a measurable probability $P(1) = \\sin^2\\frac{\\varphi}{2}$. This is the engine of phase estimation and of Grover’s oracle. If the target is not an eigenstate, the two qubits entangle instead: the control’s Bloch vector shrinks toward the centre and the clean interference fringe washes out.',
			steps: [
				{
					label: 'Sweep the phase angle and read the control.',
					detail:
						'With the target in $|1\\rangle$, the control’s Bloch vector turns around the equator by exactly $\\varphi$, and $P(1)$ follows $\\sin^2\\frac{\\varphi}{2}$ from $0$ to $1$.'
				},
				{
					label: 'Prepare the target in |+⟩ instead.',
					detail:
						'Now the target is not an eigenstate. The Bloch vector shortens: purity falls below $1$, and the control has become entangled with the target instead of simply rotating.'
				},
				{
					label: 'Diagnose a fringe that has lost contrast.',
					detail:
						'Inject the disturbance with the target set to $|1\\rangle$. Compare the Bloch vector’s length with the ideal case, and infer what the target must really be.'
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
			order: 12,
			prerequisites: ['kickback'],
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
	},
	tdr: {
		curriculum: {
			order: 13,
			prerequisites: ['rc'],
			objective: 'Read a reflection coefficient from a near-end echo and terminate a line.'
		},
		actions: [
			action(
				'input[aria-label^="Load impedance"]',
				'change',
				'sweep the load impedance and compare the near-end echo'
			),
			action('button[data-preset="match-load"]', 'click', 'match the load to the line impedance'),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden line disturbance and inspect the changed echo',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'A $50\\ \\Omega$ line ends in an open circuit. When the step first reaches the far end, what does the far-end voltage do?',
			choices: [
				{
					id: 'far-end-doubles',
					label: 'It jumps to twice the launched step, $2V_1$.',
					correct: true,
					feedback:
						'Right. An open end has $\\Gamma_L = +1$: the reflected wave equals the incident one and the two add at the end.'
				},
				{
					id: 'far-end-launched',
					label: 'It rises to the launched step $V_1$ and stays there.',
					correct: false,
					feedback:
						'That is the matched case, $\\Gamma_L = 0$. An open end reflects everything, so the far end sees incident plus reflected wave.'
				},
				{
					id: 'far-end-instant',
					label: 'Nothing happens until the source has charged the whole line.',
					correct: false,
					feedback:
						'The front travels at a finite speed and reaches the far end after one delay $t_d$; the far end reacts the moment it arrives.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance, then measure the near-end echo at $2t_d$. From its size, compute $\\Gamma_L$ and say what impedance the far end now presents.'
	},
	pll: {
		curriculum: {
			order: 15,
			prerequisites: ['wien'],
			objective: 'Explain lock as a steady phase error and find the hold range of a PLL.'
		},
		actions: [
			action(
				'input[aria-label^="Reference frequency"]',
				'change',
				'retune the reference frequency and watch the loop reacquire'
			),
			action('button[data-preset="detune"]', 'click', 'detune the reference beyond the hold range'),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden loop disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'The loop is locked to a reference $500\\ \\mathrm{Hz}$ above the VCO’s free-running frequency. What is the steady phase error $\\theta_e$?',
			choices: [
				{
					id: 'nonzero-offset',
					label: 'A constant, non-zero offset that supplies the control voltage.',
					correct: true,
					feedback:
						'Yes. The VCO needs $v_c = \\Delta\\omega / K_v$, and the detector can only produce it with $\\sin\\theta_e = \\Delta\\omega/(K_vK_d)$.'
				},
				{
					id: 'zero-error',
					label: 'Exactly zero; lock means the waves line up.',
					correct: false,
					feedback:
						'With $\\theta_e = 0$ the detector outputs zero, so $v_c$ would decay and the VCO would fall back to $\\omega_0$. Lock with detuning needs a phase offset.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance and compare the detector output with the control voltage. Does the phase error still reach the VCO, and where is the signal lost?'
	},
	classd: {
		curriculum: {
			order: 17,
			prerequisites: ['buck'],
			objective: 'Place an LC cutoff between the audio band and the PWM carrier.'
		},
		actions: [
			action(
				'input[aria-label^="Filter capacitance"]',
				'change',
				'change the filter capacitance and compare the carrier residual'
			),
			action(
				'input[aria-label^="Carrier frequency"]',
				'change',
				'move the carrier frequency and compare the cleanliness'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden output disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'You double the filter capacitance $C$. What happens to the carrier residual at the speaker?',
			choices: [
				{
					id: 'residual-falls',
					label:
						'It falls, because $f_c$ drops by $\\sqrt2$ and the carrier sits further into the stopband.',
					correct: true,
					feedback:
						'Correct. $f_c \\propto 1/\\sqrt{LC}$, and a second-order filter attenuates about $40\\,\\mathrm{dB}$ per decade above $f_c$.'
				},
				{
					id: 'residual-rises',
					label: 'It rises, because a bigger capacitor stores more ripple.',
					correct: false,
					feedback:
						'A larger shunt capacitor has lower impedance at the carrier frequency, so it shunts more of the carrier to ground, not less.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance, then compare the PWM probe with the output probe and listen. Which element must have stopped attenuating the carrier?'
	},
	pid: {
		curriculum: {
			order: 16,
			prerequisites: ['buck'],
			objective: 'Tune P, I, and D for a fast, offset-free step response without windup.'
		},
		actions: [
			action(
				'input[aria-label^="Proportional gain"]',
				'change',
				'raise the proportional gain and read the steady-state offset'
			),
			action(
				'input[aria-label^="Integral gain"]',
				'change',
				'add integral gain and confirm the offset disappears'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden loop disturbance and inspect the changed evidence',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'With only proportional control ($K_i = K_d = 0$), the motor must overcome friction. Where does its speed settle?',
			choices: [
				{
					id: 'below-setpoint',
					label: 'Below the setpoint: a P loop needs some error to keep pushing.',
					correct: true,
					feedback:
						'Yes. The steady drive is $K_pe$, so a non-zero drive needs a non-zero error. Integral action removes it.'
				},
				{
					id: 'at-setpoint',
					label: 'Exactly at the setpoint, once it has stopped oscillating.',
					correct: false,
					feedback:
						'At the setpoint $e = 0$, so $K_pe = 0$ and nothing opposes friction. The motor slows until the error is large enough to hold it.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance, then watch the actuator trace after the step. Does more drive move the measured speed toward or away from the setpoint, and what does that say about the feedback path?'
	},
	sigmadelta: {
		curriculum: {
			order: 18,
			prerequisites: ['timer'],
			objective: 'Relate modulator order and oversampling to noise shaping and ENOB.'
		},
		actions: [
			action('button[data-order="2"]', 'click', 'switch the modulator to a second-order loop'),
			action(
				'input[aria-label^="Oversampling ratio"]',
				'change',
				'raise the oversampling ratio and compare the in-band SNR'
			),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden modulator disturbance and inspect the changed spectrum',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'A one-bit modulator’s quantization error is as large as the signal. Where does a sigma-delta loop put most of that error?',
			choices: [
				{
					id: 'pushed-high',
					label: 'At high frequencies, far above the signal band.',
					correct: true,
					feedback:
						'Right. The loop filters the error by $(1-z^{-1})^L$, a high-pass shape, so a low-pass decimator removes most of it.'
				},
				{
					id: 'spread-flat',
					label: 'Spread evenly across all frequencies, like plain quantization.',
					correct: false,
					feedback:
						'That is an open-loop quantizer. Feedback through the integrator shapes the error spectrum instead of leaving it white.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance and inspect the spectrum near DC. Shaped noise should fall toward zero frequency: which part of the loop no longer accumulates the error?'
	},
	uart: {
		curriculum: {
			order: 14,
			prerequisites: ['lfsr'],
			objective: 'Explain asynchronous framing and the clock tolerance of mid-bit sampling.'
		},
		actions: [
			action(
				'input[aria-label^="Receiver clock error"]',
				'change',
				'detune the receiver clock until the samples slip'
			),
			action('button[data-parity="even"]', 'click', 'turn on even parity'),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden line disturbance and inspect the analyzer',
				1,
				'fault'
			)
		],
		prediction: {
			prompt: 'The receiver’s clock runs $4\\%$ fast. Which bits of the frame are most at risk?',
			choices: [
				{
					id: 'last-bits',
					label: 'The last ones — the error accumulates from the start edge.',
					correct: true,
					feedback:
						'Yes. The sample for bit $k$ is off by about $(k+\\tfrac12)\\varepsilon$ bit times, so the stop bit sees the largest drift.'
				},
				{
					id: 'first-bits',
					label: 'The first ones — the receiver has not locked on yet.',
					correct: false,
					feedback:
						'The start edge resynchronises the receiver exactly, so the first samples are the most accurate. Drift grows from there.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance with zero clock error, then read the idle level and the start bit on the analyzer. What has changed about the line itself?'
	},
	kickback: {
		curriculum: {
			order: 11,
			prerequisites: ['bell'],
			objective: 'Show that an eigenstate target moves a controlled phase onto the control.'
		},
		actions: [
			action(
				'input[aria-label^="Controlled phase angle"]',
				'change',
				'sweep the controlled phase angle and read the control'
			),
			action('button[data-target="plus"]', 'click', 'prepare the target in the plus state'),
			action(
				'.fault-switch [role="switch"]',
				'change',
				'inject the hidden preparation disturbance and inspect the Bloch vector',
				1,
				'fault'
			)
		],
		prediction: {
			prompt:
				'The target is $|1\\rangle$ and $\\varphi = \\pi$. After the final Hadamard, what does measuring the control give?',
			choices: [
				{
					id: 'always-one',
					label: 'Always $1$: the phase flipped the control from $|+\\rangle$ to $|-\\rangle$.',
					correct: true,
					feedback:
						'Correct. $e^{i\\pi} = -1$ kicks back as a sign on $|1\\rangle$, turning $|+\\rangle$ into $|-\\rangle$, which $H$ maps to $|1\\rangle$.'
				},
				{
					id: 'always-zero',
					label: 'Always $0$: the gate only acted on the target.',
					correct: false,
					feedback:
						'The target is an eigenstate, so it is unchanged, but the eigenphase lands on the control. That is the kickback.'
				},
				{
					id: 'fifty-fifty',
					label: 'Fifty-fifty, because the control was in superposition.',
					correct: false,
					feedback:
						'The final Hadamard interferes the two branches. With a relative phase of $\\pi$ they interfere completely, giving a certain outcome.'
				}
			]
		},
		diagnosisPrompt:
			'Inject the disturbance with the target set to $|1\\rangle$. Compare the Bloch vector’s length and the fringe contrast with the ideal case: what must the target really be?'
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
	},
	tdr: {
		summary:
			'A step behind a source resistance $R_s$ enters a lossless line of impedance $Z_0=\\sqrt{L/C}$, drawn as its distributed $L$–$C$ ladder. Each end reflects a fraction $\\Gamma$ of every arriving wave; the lattice sum gives $V(x,t)$ at every point and instant, so the probes read a real time-domain reflectometer.',
		inventory: [
			'step source $V_s$ + $R_s$',
			'$3$-section $L$–$C$ ladder $(Z_0,\\ t_d)$',
			'load $Z_L$',
			'near / far probes'
		],
		boundaries: [
			'$Z_L: 5\\ \\Omega$–$5\\ \\mathrm{k\\Omega}$',
			'$Z_0: 25$–$150\\ \\Omega$',
			'$t: 0$–$10\\,t_d$'
		]
	},
	pll: {
		summary:
			'A sinusoidal phase detector compares the reference with the VCO, a first-order $RC$ loop filter smooths the error into $v_c$, and the VCO retunes to $\\omega_0+K_vv_c$. The state $(\\theta_e, v_c)$ is integrated live, so acquisition, lock, and cycle slipping all appear on the scope and in the phase portrait.',
		inventory: [
			'reference oscillator $f_{ref}$',
			'XOR phase detector $K_d\\sin\\theta_e$',
			'$RC$ loop filter',
			'VCO $\\omega_0+K_vv_c$'
		],
		boundaries: [
			'$f_{ref},\\ f_0: 8$–$12\\ \\mathrm{kHz}$',
			'hold range $\\pm K_vK_d=\\pm1.2\\ \\mathrm{kHz}$',
			'$\\tau=RC: 0.05$–$2\\ \\mathrm{ms}$'
		]
	},
	classd: {
		summary:
			'A comparator turns the audio and a triangle carrier into a two-level PWM wave, a half-bridge switches it, and a Butterworth $LC$ filter with $f_c=1/(2\\pi\\sqrt{LC})$ recovers the audio. The filter gain at the audio and carrier frequencies is computed live, and Listen plays the actual signal, so the carrier whine is audible when the filter fails to remove it.',
		inventory: [
			'audio + triangle carrier',
			'PWM comparator',
			'half-bridge switch',
			'$LC$ filter + speaker'
		],
		boundaries: [
			'audio $100\\ \\mathrm{Hz}$–$2\\ \\mathrm{kHz}$',
			'carrier $4$–$20\\ \\mathrm{kHz}$ (slowed into earshot)',
			'$f_c: 0.5$–$50\\ \\mathrm{kHz}$'
		]
	},
	pid: {
		summary:
			'A speed loop around a DC motor with inertia $J$, friction $b$, and a driver that saturates at $\\pm12\\ \\mathrm V$. The controller sums $K_pe$, $K_i\\int e\\,dt$, and $K_d\\dot e$ with conditional-integration anti-windup; each change re-simulates the full step response, including a load step halfway through.',
		inventory: [
			'setpoint $\\omega_{set}$',
			'parallel $K_p,\\ K_i/s,\\ K_d s$ paths',
			'saturating driver',
			'motor + tachometer'
		],
		boundaries: [
			'$K_p: 0$–$10$',
			'$K_i: 0$–$20$',
			'$K_d: 0$–$0.5$',
			'driver limit $\\pm12\\ \\mathrm V$'
		]
	},
	sigmadelta: {
		summary:
			'A sine passes through one or two integrators, a one-bit quantizer, and a one-bit DAC in feedback. A $4096$-sample FFT of the bitstream shows the quantization noise shaped by $(1-z^{-1})^L$ out of the signal band, and the in-band SNR and ENOB follow the order $L$ and oversampling ratio.',
		inventory: [
			'input sine $x$',
			'summing node + integrator',
			'$1$-bit quantizer, clocked at $f_s$',
			'feedback DAC + decimator'
		],
		boundaries: ['amplitude $0.05$–$0.7$', '$\\mathrm{OSR}: 8$–$128$', 'order $L\\in\\{1,2\\}$']
	},
	uart: {
		summary:
			'A transmitter frames a byte with a start bit, eight data bits LSB first, optional parity, and a stop bit. The receiver syncs on the start edge and samples at $(k+\\tfrac12)T_{bit}(1+\\varepsilon)$ by its own clock, so a clock error $\\varepsilon$ accumulates across the frame and corrupts the last bits first.',
		inventory: [
			'byte + TX shift register',
			'single serial line',
			'RX with independent baud clock',
			'data + error outputs'
		],
		boundaries: ['$8$ data bits, LSB first', 'parity none / even / odd', 'clock error $\\pm10\\%$']
	},
	kickback: {
		summary:
			'$H$ puts the control in $|+\\rangle$, $CP(\\varphi)$ acts on the target, and a second $H$ reads the control. For an eigenstate target the eigenphase moves onto the control and $P(1)=\\sin^2(\\varphi/2)$; any other target entangles with the control and shortens its Bloch vector. Exact $4$-amplitude linear algebra drives the Bloch view and the histogram.',
		inventory: [
			'control + target qubits',
			'$2\\times$ Hadamard on the control',
			'controlled phase $CP(\\varphi)$',
			'control measurement'
		],
		boundaries: [
			'$\\varphi\\in[0,2\\pi]$',
			'targets $|0\\rangle,|1\\rangle,|+\\rangle,|-\\rangle$',
			'purity $|\\vec r|\\in[0,1]$'
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
