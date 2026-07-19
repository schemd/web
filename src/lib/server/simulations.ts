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

/** Render a LaTeX formula to static KaTeX HTML for the sim pages. */
function renderFormula(tex: string): string {
	return katex.renderToString(tex, { throwOnError: false, displayMode: false });
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
}

/** A resolved environment plus its compiled `full`-mode SVG document. */
export interface CompiledSimulation extends SimEnvironment {
	readonly svg: string;
	readonly components: number;
	readonly connections: number;
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
			`A${bit}.out -> X1_${bit}.in1 #blue [line]`,
			`B${bit}.out -> X1_${bit}.in2 #blue [line]`,
			`A${bit}.out -> N1_${bit}.in1 #blue [line]`,
			`B${bit}.out -> N1_${bit}.in2 #blue [line]`,
			`X1_${bit}.out -> X2_${bit}.in1 #cyan [line]`,
			`${carry} -> X2_${bit}.in2 #slate [ortho]`,
			`X1_${bit}.out -> N2_${bit}.in1 #cyan [line]`,
			`${carry} -> N2_${bit}.in2 #slate [ortho]`,
			`N1_${bit}.out -> O1_${bit}.in1 #amber [line]`,
			`N2_${bit}.out -> O1_${bit}.in2 #amber [line]`,
			`X2_${bit}.out -> S${bit}.in #emerald [line]`
		);
	}
	lines.push(`O1_${bits - 1}.out -> COUT.in #purple [ortho]`);
	return { source: lines.join('\n'), width: 1080, height: top + bits * rowHeight + 60 };
}

const RC_SOURCE = `// First-order RC low-pass filter (two-port form).
// Paired terminal arrows measure Vin and Vout against the shared return rail.
initial:VIN_TOP "input high" at (70, 120) #slate
initial:VIN_RETURN "input return" at (70, 340) #slate
resistor:R1 "Resistor, R" at (270, 120) #blue
initial:VOUT_NODE "output node" at (460, 120) #slate
capacitor:C1 "Capacitor, C" at (460, 245) #cyan
initial:RETURN_NODE "return node" at (460, 340) #slate
initial:VOUT_TOP "output high" at (740, 120) #slate
initial:VOUT_RETURN "output return" at (740, 340) #slate
ground:GND "0 V" at (460, 420) #slate

VIN_TOP.right -> R1.in #slate [line]
R1.out -> VOUT_NODE.left #slate [line marker-end=arrow label="I"]
VOUT_NODE.right -> VOUT_TOP.left #slate [line]
VOUT_NODE.bottom -> C1.in #cyan [ortho]
C1.out -> RETURN_NODE.top #cyan [ortho]
VIN_RETURN.right -> RETURN_NODE.left #slate [line]
RETURN_NODE.right -> VOUT_RETURN.left #slate [line]
RETURN_NODE.bottom -> GND.in #slate [line]
VIN_RETURN.top -> VIN_TOP.bottom #blue [line marker-start=arrow marker-end=arrow label="V_{in}"]
VOUT_RETURN.top -> VOUT_TOP.bottom #blue [line marker-start=arrow marker-end=arrow label="V_{out}"]`;

const BELL_SOURCE = `// Bell-state preparation: H then CNOT
port:Q0 "q_0 = |0⟩" at (80, 90) #blue
port:Q1 "q_1 = |0⟩" at (80, 210) #blue
hadamard:H1 "H" at (280, 90) #cyan
cnot:CX1 "CNOT" at (460, 150) #purple
port:M0 "meter" at (640, 90) #emerald
port:M1 "meter" at (640, 210) #emerald

Q0.out -> H1.in #blue [line]
H1.out -> CX1.control #cyan [ortho]
Q1.out -> CX1.target #blue [ortho]
CX1.out -> M0.in #purple [ortho]
CX1.out -> M1.in #purple [ortho]`;

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
RA.out -> RB.in #amber [ortho]
RB.out -> CT.in #cyan [ortho]
RB.out -> U1.th #cyan [ortho]
CT.in -> U1.tr #cyan [ortho]
RA.in -> U1.dis #amber [ortho]
U1.q -> LED.anode #emerald [ortho]
LED.cathode -> RL.in #slate [ortho]
U1.gnd -> G1.in #slate [ortho]`;

const TELEPORT_SOURCE = `// Quantum teleportation protocol register
port:PSI "|ψ⟩" at (70, 80) #purple
port:A "|0⟩" at (70, 200) #blue
port:B "|0⟩" at (70, 320) #blue
hadamard:H1 "H" at (210, 200) #cyan
cnot:CX1 "CNOT" at (340, 260) #blue
cnot:CX2 "CNOT" at (470, 140) #purple
hadamard:H2 "H" at (600, 80) #cyan
qgate:MZ1 "M" at (720, 80) #amber [parameter="Z"]
qgate:MZ2 "M" at (720, 200) #amber [parameter="Z"]
qgate:XC "X^{m_2}" at (720, 320) #emerald
qgate:ZC "Z^{m_1}" at (840, 320) #emerald
port:OUT "|ψ⟩" at (950, 320) #purple

PSI.out -> CX2.control #purple [line]
A.out -> H1.in #blue [line]
H1.out -> CX1.control #cyan [ortho]
B.out -> CX1.target #blue [ortho]
CX1.out -> CX2.target #blue [ortho]
CX2.out -> H2.in #purple [ortho]
H2.out -> MZ1.in #cyan [line]
CX2.out -> MZ2.in #purple [ortho]
CX1.out -> XC.in #blue [ortho]
XC.out -> ZC.in #emerald [line]
ZC.out -> OUT.in #emerald [line]`;

/** Bounds + generated DSL keyed by environment id. */
const SOURCES: Record<string, { source: string; width: number; height: number }> = {
	adder: adderSource(),
	rc: { source: RC_SOURCE, width: 810, height: 500 },
	bell: { source: BELL_SOURCE, width: 760, height: 300 },
	timer: { source: TIMER_SOURCE, width: 700, height: 480 },
	teleport: { source: TELEPORT_SOURCE, width: 1020, height: 400 }
};

/**
 * Public environment registry. The order here is the order the selector paints
 * its cards, and each `index` mirrors that ordering for the terminal chrome.
 */
const SIM_ENVIRONMENTS_RAW: readonly Omit<SimEnvironment, 'formulaHtml'>[] = [
	{
		id: 'adder',
		index: '01',
		title: '8-Bit Digital Adder',
		domain: 'Digital',
		tagline: 'Cascading ripple-carry gate matrix with a live combinational pass.',
		summary:
			'Eight full-adder cells built from XOR/AND/OR primitives. Clicking an input port toggles a bit and dispatches one synchronous logic pass; high nets glow as the carry ripples left to right.',
		formula: 'S_i = A_i \\oplus B_i \\oplus C_i \\;\\cdot\\; C_{i+1} = A_iB_i + C_i(A_i \\oplus B_i)',
		inventory: ['8× full-adder cell', '16× XOR + 16× AND', '8× OR carry merge', 'A/B/Cᵢₙ + Sum ports'],
		boundaries: ['8-bit operands · 0–255', 'sum 0–511 with carry-out', 'zero propagation delay model'],
		fault: 'carry chain stuck-at-0'
	},
	{
		id: 'rc',
		index: '02',
		title: 'Dynamic RC Low-Pass Filter',
		domain: 'Analog',
		tagline: 'Sweep R, C, and frequency; watch the pole attenuate the output trace.',
		summary:
			'A first-order shunt-capacitor filter. The cutoff and the |H(jω)| magnitude are derived live; the output wire fades its opacity and stretches its dash pattern to visualise physical damping, and both channels drive the oscilloscope.',
		formula: 'f_c = \\dfrac{1}{2\\pi RC} \\;\\cdot\\; |H(j\\omega)| = \\dfrac{1}{\\sqrt{1 + (f/f_c)^2}}',
		inventory: ['input source node', 'series resistor R', 'shunt capacitor C', 'reference ground'],
		boundaries: ['R 100 Ω – 1 MΩ', 'C 1 nF – 10 µF', 'sweep 10 Hz – 100 kHz'],
		fault: 'capacitor branch open'
	},
	{
		id: 'bell',
		index: '03',
		title: 'Bell-State Entanglement Visualizer',
		domain: 'Quantum',
		tagline: 'Prepare the four Bell states; sample the ⟨Z⊗Z⟩ correlation.',
		summary:
			'H on q₀ followed by CNOT(q₀→q₁). Toggling the initialization ports selects which Bell pair is prepared; amplitudes and the correlation index are derived, and a measure button accumulates real Born-rule shots.',
		formula: '|\\Phi^+\\rangle = \\dfrac{|00\\rangle + |11\\rangle}{\\sqrt{2}} \\;\\cdot\\; \\langle Z \\otimes Z \\rangle \\in [-1, +1]',
		inventory: ['2× qubit register line', 'Hadamard gate', 'CNOT control/target', 'measurement ports'],
		boundaries: ['4 Bell states', 'amplitudes ±1/√2', 'Born-rule sampled correlation'],
		fault: 'CNOT entangler offline'
	},
	{
		id: 'timer',
		index: '04',
		title: '555 Astable Multivibrator',
		domain: 'Mixed-signal',
		tagline: 'A real charge/discharge loop clocking an output LED.',
		summary:
			'The timing capacitor integrates between ⅓·V_cc and ⅔·V_cc. The timing-branch stroke weight scales with instantaneous V_C, and the LED node flashes in sync with the calculated frequency (time-scaled for visibility).',
		formula: 'f = \\dfrac{1.44}{(R_A + 2R_B)\\,C} \\;\\cdot\\; D = \\dfrac{R_A + R_B}{R_A + 2R_B}',
		inventory: ['8-pin 555 IC block', 'R_A + R_B timing pair', 'timing capacitor C_T', 'output LED + limiter'],
		boundaries: ['V_cc = 5 V', 'threshold ⅔ · trigger ⅓', 'C_T 10 nF – 100 µF'],
		fault: 'THRES shorted to ground'
	},
	{
		id: 'teleport',
		index: '05',
		title: 'Quantum Teleportation Protocol',
		domain: 'Advanced quantum',
		tagline: 'Step a three-qubit register through the full teleportation script.',
		summary:
			'Alice’s state |ψ⟩ is parameterised on the Bloch angles. Stepped playback advances the register through entanglement, Bell measurement, and the classically controlled X^{m₂}/Z^{m₁} corrections; hovering any gate reveals its action in Dirac notation.',
		formula: '|\\psi\\rangle = \\alpha|0\\rangle + \\beta|1\\rangle \\;\\cdot\\; \\alpha = \\cos\\tfrac{\\theta}{2},\\ \\beta = e^{i\\phi}\\sin\\tfrac{\\theta}{2}',
		inventory: ['3× qubit trace (ψ, A, B)', 'H + CNOT preparation', 'Bell-basis measurement', 'X/Z correction gates'],
		boundaries: ['Bloch θ ∈ [0, π], φ ∈ [0, 2π]', '6-step protocol', 'classical bits m₁, m₂'],
		fault: 'classical correction link cut'
	}
];

/**
 * Public environment registry with each formula pre-rendered to KaTeX HTML.
 * The order here is the order the selector paints its cards.
 */
export const SIM_ENVIRONMENTS: readonly SimEnvironment[] = SIM_ENVIRONMENTS_RAW.map(
	(environment) => ({ ...environment, formulaHtml: renderFormula(environment.formula) })
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

/** Compile (once, cached) and return the full document for one environment. */
export function getSimulation(id: string): CompiledSimulation | undefined {
	const cached = compiledCache.get(id);
	if (cached) return cached;

	const meta = META_BY_ID.get(id);
	const spec = SOURCES[id];
	if (!meta || !spec) return undefined;

	const fence = parseSchematicFence(`schemd bounds="${spec.width}x${spec.height}" title="${meta.title}"`);
	if (!fence) throw new Error(`Unreachable: canonical fence for ${id}.`);

	const compilation = compileSchematic(spec.source, {
		...fence,
		mode: 'full',
		idPrefix: `sim-${id}`
	});

	const result: CompiledSimulation = {
		...meta,
		svg: compilation.svg,
		components: compilation.metrics.components,
		connections: compilation.metrics.connections
	};
	compiledCache.set(id, result);
	return result;
}
