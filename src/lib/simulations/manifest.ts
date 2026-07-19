export const SUPPORTED_SIMULATION_VERSION = 'v0.2.1' as const;

export type SimulationId =
	'digital-adder' | 'bell-state' | 'rc-low-pass' | '555-astable' | 'quantum-teleportation';

export interface SimulationDefinition {
	readonly id: SimulationId;
	readonly domain: string;
	readonly title: string;
	readonly summary: string;
	readonly idea: string;
	readonly bounds: { readonly width: number; readonly height: number };
	readonly source: string;
	readonly docsPath: string;
}

export interface PublicSimulationDefinition {
	readonly id: SimulationId;
	readonly domain: string;
	readonly title: string;
	readonly summary: string;
	readonly idea: string;
	readonly docsPath: string;
}

export interface SimulationVersion {
	readonly id: typeof SUPPORTED_SIMULATION_VERSION;
	readonly packageVersion: '0.2.1';
	readonly label: '@schemd/core 0.2.1';
}

export const SIMULATION_VERSION: SimulationVersion = Object.freeze({
	id: SUPPORTED_SIMULATION_VERSION,
	packageVersion: '0.2.1',
	label: '@schemd/core 0.2.1'
});

export const SIMULATIONS = Object.freeze([
	Object.freeze({
		id: 'digital-adder',
		domain: 'Digital logic',
		title: 'Ripple-carry adder',
		summary: 'Follow one carry bit as two unsigned bytes pass through eight full-adder stages.',
		idea: 'A ripple-carry adder is locally simple: each bit consumes A, B, and carry-in, then produces sum and carry-out.',
		bounds: { width: 960, height: 420 },
		docsPath: '/docs/v0.2.1/component-reference#logic-gates',
		source: `port:A "A_i" at (70, 100) #blue
port:B "B_i" at (70, 310) #blue
xor:X1 "A_i xor B_i" at (310, 160) #cyan [inputs=2 outputs=1]
port:CIN "C_{in}" at (310, 330) #purple
xor:SUM "S_i" at (590, 160) #cyan [inputs=2 outputs=1]
and:CARRY "C_{out}" at (590, 320) #amber [inputs=2 outputs=1]
port:S "Sum" at (880, 160) #emerald
port:COUT "Carry" at (880, 320) #emerald

A.out -> X1.in1 #blue [bezier]
B.out -> X1.in2 #blue [bezier]
X1.out -> SUM.in1 #cyan [line]
CIN.out -> SUM.in2 #purple [ortho]
SUM.out -> S.in #emerald [line marker-end=arrow]
X1.out -> CARRY.in1 #cyan [ortho]
CIN.out -> CARRY.in2 #purple [ortho]
CARRY.out -> COUT.in #amber [line marker-end=arrow]`
	}),
	Object.freeze({
		id: 'bell-state',
		domain: 'Quantum circuits',
		title: 'Bell-state preparation',
		summary:
			'Step from |00⟩ through superposition to a correlated Bell pair, then sample a valid measurement.',
		idea: 'A Hadamard creates two amplitudes; CNOT correlates the target so only 00 and 11 remain possible.',
		bounds: { width: 980, height: 420 },
		docsPath: '/docs/v0.2.1/component-reference#quantum-gates',
		source: `port:Q0 "|0〉_{q0}" at (80, 110) #blue
port:Q1 "|0〉_{q1}" at (80, 310) #blue
hadamard:H1 "H" at (330, 110) #purple
cnot:CX "Entangle" at (590, 210) #cyan
port:M0 "Measure q0" at (900, 110) #emerald
port:M1 "Measure q1" at (900, 310) #emerald

Q0.out -> H1.in #blue [line]
H1.out -> CX.control #purple [bezier]
Q1.out -> CX.target #blue [bezier]
CX.control -> M0.in #emerald [bezier]
CX.target -> M1.in #emerald [bezier]`
	}),
	Object.freeze({
		id: 'rc-low-pass',
		domain: 'Analog circuits',
		title: 'RC low-pass response',
		summary:
			'Sweep five decades of frequency and inspect ideal gain, phase, output voltage, and cutoff.',
		idea: 'A first-order RC low-pass attenuates increasingly above fc = 1 / (2πRC) and approaches −90° phase.',
		bounds: { width: 920, height: 420 },
		docsPath: '/docs/v0.2.1/component-reference#passives',
		source: `port:VIN "V_{in}" at (80, 130) #blue
resistor:R1 "R = 10 k\\Omega" at (320, 130) #amber
capacitor:C1 "C = 100 nF" at (560, 285) #cyan
port:VOUT "V_{out}" at (820, 130) #emerald
ground:GND "Ground" at (720, 345) #slate

VIN.out -> R1.in #blue [line]
R1.out -> VOUT.in #emerald [line marker-end=arrow]
R1.out -> C1.in #amber [ortho]
C1.out -> GND.in #slate [ortho]`
	}),
	Object.freeze({
		id: '555-astable',
		domain: 'Mixed signal',
		title: 'NE555 astable timing',
		summary:
			'Change the two resistors and timing capacitor, then inspect frequency, charge time, and duty cycle.',
		idea: 'The capacitor charges through R1 + R2 and discharges through R2, so the high interval is always longer in this basic topology.',
		bounds: { width: 1200, height: 660 },
		docsPath: '/docs/v0.2.1/component-reference#integrated-circuits',
		source: `port:VCC "+5V rail" at (100, 100) #blue
resistor:R1 "R_1 = 10 k\\Omega" at (310, 100) #amber
resistor:R2 "R_2 = 47 k\\Omega" at (510, 240) #amber
capacitor:C1 "C_1 = 10 \\muF" at (510, 480) #cyan
ic:U1 "NE555" at (760, 280) #purple [left="GND,TRIG,THRESH,CTRL" right="VCC,DISCH,OUT,RESET"]
resistor:ROUT "R_{LED} = 330 \\Omega" at (980, 360) #amber
diode:LED1 "Pulse LED" at (1110, 360) #emerald [type=led]
ground:GND "Signal ground" at (760, 560) #slate [style=signal]

VCC.out -> R1.in #blue [ortho]
VCC.out -> U1.VCC #blue [ortho]
VCC.out -> U1.RESET #blue [ortho]
R1.out -> U1.DISCH #amber [ortho]
R1.out -> R2.in #amber [ortho]
R2.out -> U1.TRIG #cyan [ortho]
R2.out -> U1.THRESH #cyan [ortho]
R2.out -> C1.in #cyan [ortho]
C1.out -> GND.in #slate [ortho]
U1.GND -> GND.in #slate [ortho]
U1.OUT -> ROUT.in #emerald [line]
ROUT.out -> LED1.anode #emerald [line]
LED1.cathode -> GND.in #slate [ortho]`
	}),
	Object.freeze({
		id: 'quantum-teleportation',
		domain: 'Quantum protocols',
		title: 'Quantum state teleportation',
		summary:
			'Trace a real-amplitude message qubit through Bell encoding, measurement, and Pauli recovery.',
		idea: 'Teleportation transfers a state using prior entanglement and two classical bits; it does not transmit matter or exceed light speed.',
		bounds: { width: 1500, height: 600 },
		docsPath: '/docs/v0.2.1/component-reference#quantum-gates',
		source: `port:PSI "|\\psi〉_A" at (70, 100) #purple
port:ANC0 "|0〉_A" at (70, 300) #blue
port:ANC1 "|0〉_B" at (70, 500) #blue
hadamard:HENT "H_{Bell}" at (290, 300) #purple
cnot:CXENT "Bell pair" at (510, 400) #cyan
cnot:CXMSG "Encode" at (760, 210) #cyan
hadamard:HMSG "H_{message}" at (980, 100) #purple
port:MZ "m_Z" at (1180, 100) #amber
port:MX "m_X" at (980, 300) #amber
qgate:XREC "X recovery" at (1020, 480) #cyan [parameter="m_X"]
qgate:ZREC "Z recovery" at (1230, 480) #cyan [parameter="m_Z"]
port:OUT "|\\psi〉_B" at (1430, 480) #emerald

ANC0.out -> HENT.in #blue [bezier]
HENT.out -> CXENT.control #purple [bezier]
ANC1.out -> CXENT.target #blue [bezier]
PSI.out -> CXMSG.control #purple [bezier]
CXENT.control -> CXMSG.target #purple [bezier]
CXMSG.control -> HMSG.in #purple [bezier]
HMSG.out -> MZ.in #purple [line]
CXMSG.target -> MX.in #purple [bezier]
CXENT.target -> XREC.in #cyan [bezier]
XREC.out -> ZREC.in #cyan [line]
ZREC.out -> OUT.in #emerald [line]
MZ.out -> ZREC.in #amber [ortho]
MX.out -> XREC.in #amber [ortho]`
	})
] as const satisfies readonly SimulationDefinition[]);

export function getSimulation(id: string): SimulationDefinition | undefined {
	return SIMULATIONS.find((simulation) => simulation.id === id);
}

export function publicSimulation(definition: SimulationDefinition): PublicSimulationDefinition {
	return {
		id: definition.id,
		domain: definition.domain,
		title: definition.title,
		summary: definition.summary,
		idea: definition.idea,
		docsPath: definition.docsPath
	};
}
