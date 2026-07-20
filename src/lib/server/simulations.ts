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

export const RC_SOURCE = `// First-order RC low-pass filter using native 0.3 electrical primitives.
source:VIN "V_{in}" at (80, 140) #blue [type=voltage-ac]
resistor:R1 "Resistor, R" at (260, 140) #blue
junction:VOUT_NODE "output node" at (440, 140) #cyan
testpoint:VOUT_PROBE "V_{out}" at (590, 140) #purple
port:VOUT "output" at (760, 140) #emerald
capacitor:C1 "Capacitor, C" at (440, 270) #cyan [orientation=down]
junction:RETURN_NODE "return" at (440, 370) #slate
ground:GND "0 V" at (440, 470) #slate

VIN.positive -> R1.in #blue [line]
R1.out -> VOUT_NODE.node #slate [line marker-end=arrow label="I"]
VOUT_NODE.node -> VOUT_PROBE.node #slate [line]
VOUT_PROBE.node -> VOUT.in #slate [line]
VOUT_NODE.node -> C1.in #cyan [ortho]
C1.out -> RETURN_NODE.node #cyan [line]
VIN.negative -> RETURN_NODE.node #slate [line]
RETURN_NODE.node -> GND.in #slate [line]`;

const BELL_SOURCE = `// Bell-state preparation: H then CNOT
port:Q0 "q_0 = |0⟩" at (80, 90) #blue
port:Q1 "q_1 = |0⟩" at (80, 210) #blue
hadamard:H1 "H" at (280, 90) #cyan
cnot:CX1 "CNOT" at (460, 150) #purple
measure:M0 "M_0" at (640, 90) #emerald
measure:M1 "M_1" at (640, 210) #emerald

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
measure:MZ1 "M_Z" at (720, 80) #amber
measure:MZ2 "M_Z" at (720, 200) #amber
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

VIN.positive -> QH.source #amber [line]
CTRL.gate -> QH.gate #purple [ortho]
QH.drain -> SW.node #amber [line]
SW.node -> L1.in #amber [line]
L1.out -> VOUT_NODE.node #cyan [line marker-end=arrow label="i_L"]
VOUT_NODE.node -> VOUT_PROBE.node #emerald [line]
VOUT_PROBE.node -> CTRL.fb #emerald [ortho]
VOUT_NODE.node -> COUT.in #cyan [ortho]
VOUT_NODE.node -> RLOAD.in #slate [ortho]
SW.node -> D1.cathode #blue [ortho]
D1.anode -> RETURN.node #blue [ortho]
COUT.out -> RETURN.node #cyan [line]
RLOAD.out -> RETURN.node #slate [line]
VIN.negative -> RETURN.node #slate [ortho]
RETURN.node -> GND.in #slate [line]`;

const CHUA_SOURCE = `// Chua double-scroll oscillator with nonlinear negative-resistance element
junction:X_NODE "v_{C1}" at (260, 150) #purple
resistor:R1 "R" at (450, 150) #amber [type=variable]
junction:Y_NODE "v_{C2}" at (640, 150) #cyan
testpoint:X_PROBE "x(t)" at (260, 70) #purple
testpoint:Y_PROBE "y(t)" at (640, 70) #cyan
capacitor:C1 "C_1" at (260, 300) #purple [orientation=down]
capacitor:C2 "C_2" at (640, 300) #cyan [orientation=down]
inductor:L1 "L" at (820, 300) #emerald [orientation=down]
ic:NR "g(v)" at (100, 300) #red [right="sense,sink"]
junction:RETURN "common" at (520, 450) #slate
ground:GND "0 V" at (520, 530) #slate

X_PROBE.node -> X_NODE.node #purple [line]
X_NODE.node -> R1.in #amber [line]
R1.out -> Y_NODE.node #amber [line]
Y_PROBE.node -> Y_NODE.node #cyan [line]
X_NODE.node -> C1.in #purple [ortho]
X_NODE.node -> NR.sense #red [ortho]
NR.sink -> RETURN.node #red [ortho marker-end=arrow label="g(v)"]
Y_NODE.node -> C2.in #cyan [ortho]
Y_NODE.node -> L1.in #emerald [ortho]
C1.out -> RETURN.node #purple [line]
C2.out -> RETURN.node #cyan [line]
L1.out -> RETURN.node #emerald [line]
RETURN.node -> GND.in #slate [line]`;

const PLL_SOURCE = `// Integer-N charge-pump phase-locked loop
clock:REF "f_{ref}" at (70, 120) #blue
ic:PFD "PFD" at (240, 170) #purple [left="ref,fb" right="up,down"]
ic:CP "charge pump" at (430, 170) #amber [left="up,down" right="iout"]
resistor:RLP "R_{loop}" at (600, 140) #amber
junction:VCTRL "V_{ctrl}" at (740, 140) #cyan
capacitor:CLP "C_{loop}" at (740, 300) #cyan [orientation=down]
ic:VCO "VCO" at (900, 140) #emerald [left="vc" right="clk"]
port:OUT "f_{out}" at (1080, 140) #emerald
ic:DIV "÷N" at (900, 340) #blue [left="clk" right="fb"]
junction:RETURN "analog return" at (740, 460) #slate
ground:GND "0 V" at (740, 530) #slate

REF.out -> PFD.ref #blue [line]
PFD.up -> CP.up #purple [line]
PFD.down -> CP.down #purple [ortho]
CP.iout -> RLP.in #amber [line]
RLP.out -> VCTRL.node #cyan [line]
VCTRL.node -> VCO.vc #cyan [line]
VCTRL.node -> CLP.in #cyan [ortho]
CLP.out -> RETURN.node #cyan [line]
VCO.clk -> OUT.in #emerald [line]
VCO.clk -> DIV.clk #emerald [ortho]
DIV.fb -> PFD.fb #blue [ortho marker-end=arrow label="feedback"]
RETURN.node -> GND.in #slate [line]`;

/** Bounds + generated DSL keyed by environment id. */
const SOURCES: Record<string, { source: string; width: number; height: number }> = {
	adder: adderSource(),
	rc: { source: RC_SOURCE, width: 840, height: 540 },
	bell: { source: BELL_SOURCE, width: 760, height: 300 },
	timer: { source: TIMER_SOURCE, width: 700, height: 480 },
	teleport: { source: TELEPORT_SOURCE, width: 1020, height: 400 },
	buck: { source: BUCK_SOURCE, width: 920, height: 640 },
	chua: { source: CHUA_SOURCE, width: 920, height: 660 },
	pll: { source: PLL_SOURCE, width: 1160, height: 660 }
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
		tier: 'Core',
		model: 'event-driven Boolean solver',
		tagline: 'Cascading ripple-carry gate matrix with a live combinational pass.',
		summary:
			'Eight full-adder cells built from XOR/AND/OR primitives. Clicking an input port toggles a bit and dispatches one synchronous logic pass; high nets glow as the carry ripples left to right.',
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
			'zero propagation delay model'
		],
		fault: 'carry chain stuck-at-0'
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
		fault: 'capacitor branch open'
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
		boundaries: ['4 Bell states', 'amplitudes ±1/√2', 'Born-rule sampled correlation'],
		fault: 'CNOT entangler offline'
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
		boundaries: ['V_cc = 5 V', 'threshold ⅔ · trigger ⅓', 'C_T 10 nF – 100 µF'],
		fault: 'THRES shorted to ground'
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
		boundaries: ['Bloch θ ∈ [0, π], φ ∈ [0, 2π]', '6-step protocol', 'classical bits m₁, m₂'],
		fault: 'classical correction link cut'
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
		fault: 'high-side MOSFET gate drive lost'
	},
	{
		id: 'chua',
		index: '07',
		title: 'Chua Double-Scroll Oscillator',
		domain: 'Nonlinear dynamics',
		tier: 'Frontier',
		model: 'RK4 nonlinear ODE integration',
		tagline: 'Tune a physical circuit through fixed points, limit cycles, and deterministic chaos.',
		summary:
			'Two capacitors, one inductor, a coupling resistor, and a piecewise-linear negative-resistance element form the canonical chaotic circuit. A fourth-order solver evolves the three state variables while a live phase portrait exposes orbit folding, attractor symmetry, and sensitivity to initial conditions.',
		formula: '\\dot x = \\alpha(y-x-h(x)),\\quad \\dot y=x-y+z,\\quad \\dot z=-\\beta y',
		inventory: [
			'piecewise-linear Chua diode',
			'C₁ / C₂ energy stores',
			'coupling resistor R',
			'inductor current state'
		],
		boundaries: ['α 7–18', 'β 18–35', 'RK4 · adaptive visual time scale'],
		fault: 'nonlinear negative-resistance branch bypassed'
	},
	{
		id: 'pll',
		index: '08',
		title: 'Adaptive Clock-Recovery PLL',
		domain: 'Control + RF',
		tier: 'Frontier',
		model: 'second-order phase-domain loop',
		tagline: 'Watch an integer-N synthesizer acquire, track, and lose phase lock.',
		summary:
			'A phase/frequency detector, charge pump, passive loop filter, VCO, and programmable divider form a complete frequency-synthesis loop. Change the reference, divide ratio, bandwidth, and damping; the phase-domain solver reveals pull-in, overshoot, control-voltage motion, lock confidence, and cycle slips.',
		formula: 'f_{out}=Nf_{ref},\\quad \\ddot e + 2\\zeta\\omega_n\\dot e + \\omega_n^2e=0',
		inventory: [
			'phase/frequency detector',
			'charge pump + loop filter',
			'voltage-controlled oscillator',
			'programmable ÷N feedback'
		],
		boundaries: ['N 2–64', 'loop bandwidth 0.2–8 kHz', 'lock threshold ±50 ppm'],
		fault: 'reference clock disconnected'
	}
];

/** Public environment registry with dependency-free escaped model notation. */
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

	const result: CompiledSimulation = {
		...meta,
		svg: compilation.svg,
		components: compilation.metrics.components,
		connections: compilation.metrics.connections
	};
	compiledCache.set(id, result);
	return result;
}
