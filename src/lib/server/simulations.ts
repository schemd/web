/**
 * Simulation-lab schematic sources, compiled once per process in `full` mode
 * so every node, port, and wire carries the compiler's delegation attributes.
 * The client never draws a schematic — it only toggles the state classes
 * (`is-active`, `is-degraded`, `is-selected`) that `@schemd/core` styles.
 *
 * This module is the single source of truth for both the environment selector
 * (`/simulate/[version]`) and each standalone laboratory
 * (`/simulate/[version]/[env]`): the selector reads {@link SIM_ENVIRONMENTS}
 * metadata without paying for a compile, while a laboratory route resolves the
 * one compiled document it needs through {@link getSimulation}.
 */
import { compileSchematic, parseSchematicFence } from '@schemd/core';

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
	/** The governing equation, written for the monospace readout. */
	readonly formula: string;
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

/** Generate the 8-bit ripple-carry adder DSL programmatically. */
function adderSource(): { source: string; width: number; height: number } {
	const lines: string[] = ['// 8-bit ripple-carry adder — generated declarations'];
	const columnWidth = 300;
	const bits = 8;
	lines.push(`port:CIN "C_{in}" at (70, 340) #slate`);
	for (let bit = 0; bit < bits; bit += 1) {
		const x = 70 + bit * columnWidth;
		lines.push(
			`port:A${bit} "A_${bit}" at (${x}, 60) #blue`,
			`port:B${bit} "B_${bit}" at (${x}, 140) #blue`,
			`xor:X1_${bit} "X" at (${x + 110}, 100) #cyan`,
			`and:N1_${bit} "A" at (${x + 110}, 240) #amber`,
			`xor:X2_${bit} "X" at (${x + 210}, 140) #cyan`,
			`and:N2_${bit} "A" at (${x + 110}, 330) #amber`,
			`or:O1_${bit} "O" at (${x + 210}, 285) #purple`,
			`port:S${bit} "S_${bit}" at (${x + 290}, 60) #emerald`
		);
	}
	lines.push(`port:COUT "C_{out}" at (${70 + bits * columnWidth + 40}, 285) #emerald`);
	for (let bit = 0; bit < bits; bit += 1) {
		const carry = bit === 0 ? 'CIN.out' : `O1_${bit - 1}.out`;
		lines.push(
			`A${bit}.out -> X1_${bit}.in1 #blue [line]`,
			`B${bit}.out -> X1_${bit}.in2 #blue [line]`,
			`A${bit}.out -> N1_${bit}.in1 #blue [line]`,
			`B${bit}.out -> N1_${bit}.in2 #blue [line]`,
			`X1_${bit}.out -> X2_${bit}.in1 #cyan [line]`,
			`${carry} -> X2_${bit}.in2 #slate [line]`,
			`X1_${bit}.out -> N2_${bit}.in1 #cyan [line]`,
			`${carry} -> N2_${bit}.in2 #slate [line]`,
			`N1_${bit}.out -> O1_${bit}.in1 #amber [line]`,
			`N2_${bit}.out -> O1_${bit}.in2 #amber [line]`,
			`X2_${bit}.out -> S${bit}.in #emerald [line]`
		);
	}
	lines.push(`O1_${bits - 1}.out -> COUT.in #purple [line]`);
	return { source: lines.join('\n'), width: 70 + bits * columnWidth + 110, height: 420 };
}

const RC_SOURCE = `// First-order RC low-pass filter
port:VIN "V_{in}" at (60, 110) #blue
resistor:R1 "R" at (240, 110) #amber
capacitor:C1 "C" at (420, 210) #cyan
port:VOUT "V_{out}" at (620, 110) #emerald
ground:G1 "0 V" at (420, 320) #slate

VIN.out -> R1.in #blue [ortho]
R1.out -> VOUT.in #emerald [ortho]
R1.out -> C1.in #cyan [ortho]
C1.out -> G1.in #slate [ortho]`;

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
	rc: { source: RC_SOURCE, width: 720, height: 400 },
	bell: { source: BELL_SOURCE, width: 760, height: 300 },
	timer: { source: TIMER_SOURCE, width: 700, height: 480 },
	teleport: { source: TELEPORT_SOURCE, width: 1020, height: 400 }
};

/**
 * Public environment registry. The order here is the order the selector paints
 * its cards, and each `index` mirrors that ordering for the terminal chrome.
 */
export const SIM_ENVIRONMENTS: readonly SimEnvironment[] = [
	{
		id: 'adder',
		index: '01',
		title: '8-Bit Digital Adder',
		domain: 'Digital',
		tagline: 'Cascading ripple-carry gate matrix with a live combinational pass.',
		summary:
			'Eight full-adder cells built from XOR/AND/OR primitives. Clicking an input port toggles a bit and dispatches one synchronous logic pass; high nets glow as the carry ripples left to right.',
		formula: 'Sᵢ = Aᵢ ⊕ Bᵢ ⊕ Cᵢ · Cᵢ₊₁ = AᵢBᵢ + Cᵢ(Aᵢ ⊕ Bᵢ)',
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
		formula: 'f_c = 1 / (2πRC) · |H(jω)| = 1/√(1 + (f/f_c)²)',
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
		formula: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2 · ⟨Z⊗Z⟩ ∈ [−1, +1]',
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
		formula: 'f = 1.44 / ((R_A + 2R_B)·C) · D = (R_A + R_B)/(R_A + 2R_B)',
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
		formula: '|ψ⟩ = α|0⟩ + β|1⟩ · α = cos(θ/2), β = e^{iφ} sin(θ/2)',
		inventory: ['3× qubit trace (ψ, A, B)', 'H + CNOT preparation', 'Bell-basis measurement', 'X/Z correction gates'],
		boundaries: ['Bloch θ ∈ [0, π], φ ∈ [0, 2π]', '6-step protocol', 'classical bits m₁, m₂'],
		fault: 'classical correction link cut'
	}
];

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
