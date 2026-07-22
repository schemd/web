/** One causally ordered frame in a simulation's teaching timeline. */
export interface SimulationStage {
	readonly label: string;
	readonly explanation: string;
	readonly nodes: readonly string[];
	readonly wires: readonly string[];
	/** Input nodes painted only when the simulation marks their value high. */
	readonly highNodes?: readonly string[];
	/** Input wires painted only when their electrical state carries logic 1. */
	readonly highWires?: readonly string[];
}

export const SIMULATION_TIMELINE_EVENT = 'schemd:simulation-stage';

export interface SimulationTimelineDetail {
	readonly simulationId: string;
	readonly step: number;
	readonly delayMs: number;
}

const stage = (
	label: string,
	explanation: string,
	nodes: readonly string[],
	wires: readonly string[],
	high?: { readonly nodes?: readonly string[]; readonly wires?: readonly string[] }
): SimulationStage => ({
	label,
	explanation,
	nodes,
	wires,
	...(high?.nodes ? { highNodes: high.nodes } : {}),
	...(high?.wires ? { highWires: high.wires } : {})
});

const adderStages: readonly SimulationStage[] = [
	stage(
		'Sample A, B, and Cᵢₙ',
		'The input register changes now; no sum output is allowed to jump ahead of the carry front.',
		[],
		[],
		{
			nodes: [
				...Array.from({ length: 8 }, (_, bit) => `A${bit}`),
				...Array.from({ length: 8 }, (_, bit) => `B${bit}`),
				'CIN'
			],
			wires: [
				...Array.from({ length: 8 }, (_, bit) => `A${bit}.out`),
				...Array.from({ length: 8 }, (_, bit) => `B${bit}.out`),
				'CIN.out'
			]
		}
	),
	...Array.from({ length: 8 }, (_, bit) =>
		stage(
			`Resolve bit ${bit}${bit === 0 ? ' (LSB)' : ''}`,
			`A${bit} ⊕ B${bit} combines with the incoming carry; the generated and propagated carries then determine S${bit}.`,
			[`X1_${bit}`, `N1_${bit}`, `X2_${bit}`, `N2_${bit}`, `O1_${bit}`, `S${bit}`],
			[`X1_${bit}.out`, `N1_${bit}.out`, `N2_${bit}.out`, `X2_${bit}.out`, `O1_${bit}.out`]
		)
	),
	stage(
		'Commit Cₒᵤₜ and Σ',
		'Only after the eighth full-adder cell settles is the byte result and final carry committed.',
		['O1_7', 'S7', 'COUT'],
		['O1_7.out', 'X2_7.out']
	)
];

const groverStages: readonly SimulationStage[] = [
	stage(
		'Uniform superposition',
		'Three Hadamards spread one unit of probability evenly across all eight basis states.',
		['H0', 'H1', 'H2'],
		['H0.out', 'H1.out', 'H2.out'],
		{ nodes: ['Q0', 'Q1', 'Q2'], wires: ['Q0.out', 'Q1.out', 'Q2.out'] }
	),
	stage(
		'Round 1 · oracle',
		'Uƒ flips only the marked state’s phase. Its probability is unchanged, but its sign is now different.',
		['ORACLE'],
		['H0.out', 'H1.out', 'H2.out', 'ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2']
	),
	stage(
		'Round 1 · mean',
		'The diffuser computes the mean amplitude—the reflection axis for amplification.',
		['DIFF'],
		['ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2']
	),
	stage(
		'Round 1 · inversion',
		'Inversion about the mean raises the marked amplitude and suppresses the other seven.',
		['DIFF'],
		['ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2', 'DIFF.o0', 'DIFF.o1', 'DIFF.o2']
	),
	stage(
		'Round 2 · oracle',
		'The marked amplitude receives a second phase flip before the final amplification pass.',
		['ORACLE'],
		['H0.out', 'H1.out', 'H2.out', 'ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2']
	),
	stage(
		'Round 2 · mean',
		'A new mean is computed from the already-skewed amplitude distribution.',
		['DIFF'],
		['ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2']
	),
	stage(
		'Round 2 · inversion',
		'The second reflection concentrates almost all probability on the marked state.',
		['DIFF'],
		['ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2', 'DIFF.o0', 'DIFF.o1', 'DIFF.o2']
	),
	stage(
		'Measurement',
		'The register is sampled only after both Grover rounds have transformed the amplitudes.',
		['M0', 'M1', 'M2'],
		['DIFF.o0', 'DIFF.o1', 'DIFF.o2']
	)
];

/**
 * Explicit causal routes—not geometry guesses. A lab can be visually complex,
 * but its teaching path remains a small immutable table with zero runtime graph
 * traversal. Wire names are compiler-emitted source endpoints.
 */
export const SIMULATION_TIMELINES: Readonly<Record<string, readonly SimulationStage[]>> = {
	adder: adderStages,
	rc: [
		stage(
			'Apply Vᵢₙ',
			'The source establishes the stimulus and the return reference.',
			['VIN'],
			['VIN.positive', 'VIN.negative']
		),
		stage(
			'Drive current through R',
			'R limits current; its voltage drop grows as the capacitor demands more charge.',
			['R1'],
			['VIN.positive', 'R1.out']
		),
		stage(
			'Charge the capacitor',
			'Current divides at the output node and charges C. The RC time constant sets how quickly Vout can follow.',
			['VOUT', 'C1', 'GND'],
			['R1.out', 'VOUT.node', 'C1.out']
		),
		stage(
			'Observe Vₒᵤₜ',
			'The probe sees the attenuated, phase-shifted output only after the storage node responds.',
			['OUT', 'GND'],
			['VOUT.node', 'C1.out', 'VIN.negative']
		)
	],
	bell: [
		stage('Prepare |00⟩', 'Both qubits begin separable and deterministic.', [], [], {
			nodes: ['Q0', 'Q1'],
			wires: ['Q0.out', 'Q1.out']
		}),
		stage('Hadamard q₀', 'H places q₀ in a balanced superposition.', ['H1'], ['Q0.out', 'H1.out']),
		stage(
			'Entangle with CNOT',
			'q₀ controls q₁; the pair becomes one correlated Bell state.',
			['CX1'],
			['H1.out', 'Q1.out', 'CX1.out']
		),
		stage(
			'Measure correlation',
			'The individual bits are random, while their parity is perfectly correlated.',
			['M0', 'M1'],
			['CX1.out']
		)
	],
	timer: [
		stage(
			'Bias the timing ladder',
			'Vcc drives RA and the timing network.',
			['VCC', 'RA'],
			['VCC.out', 'RA.out']
		),
		stage(
			'Charge Cₜ',
			'Current through RB raises the timing capacitor toward the upper threshold.',
			['RB', 'CT'],
			['RA.out', 'RB.out', 'CT.in']
		),
		stage(
			'Trip the 555 comparators',
			'Threshold and trigger inputs switch the internal latch at ⅓ and ⅔ Vcc.',
			['U1'],
			['RB.out', 'CT.in']
		),
		stage(
			'Drive and discharge',
			'The output lights the LED while the discharge transistor resets the capacitor for the next cycle.',
			['LED', 'RL', 'G1'],
			['U1.q', 'LED.cathode']
		)
	],
	teleport: [
		stage(
			'Prepare ψ and ancillas',
			'The unknown state and two |0⟩ ancillas enter on separate rails.',
			['PSI', 'A', 'B'],
			['PSI.out', 'A.out', 'B.out']
		),
		stage(
			'Create the Bell resource',
			'H and CNOT entangle Alice’s and Bob’s resource qubits.',
			['H1', 'CX1'],
			['A.out', 'B.out', 'H1.out', 'CX1.out']
		),
		stage(
			'Bell-basis transform',
			'The unknown state interferes with Alice’s entangled qubit before measurement.',
			['CX2', 'H2'],
			['PSI.out', 'CX1.out', 'CX2.out', 'H2.out']
		),
		stage(
			'Send two classical bits',
			'Alice’s measurements contain the correction recipe, not a copy of ψ.',
			['MZ1', 'MZ2'],
			['H2.out', 'CX2.out']
		),
		stage(
			'Apply conditional corrections',
			'Bob applies X and Z conditioned on the two measurement bits.',
			['XC', 'ZC'],
			['CX1.out', 'XC.out', 'ZC.out']
		),
		stage(
			'Recover |ψ⟩',
			'The output qubit now has the original state; the input itself was destroyed by measurement.',
			['OUT'],
			['ZC.out']
		)
	],
	buck: [
		stage(
			'Sample demand',
			'The controller compares feedback against the regulation target.',
			['VIN', 'CTRL'],
			['VIN.positive', 'VOUT_PROBE.node']
		),
		stage(
			'Switch the power node',
			'PWM drives QH; the switch node alternates between source and freewheel paths.',
			['QH', 'SW', 'D1'],
			['CTRL.gate', 'QH.drain', 'SW.node']
		),
		stage(
			'Store energy in L',
			'Inductor current cannot jump, so each pulse changes it by a finite slope.',
			['L1'],
			['SW.node', 'L1.out']
		),
		stage(
			'Filter into the load',
			'Cout absorbs ripple while the load draws the average inductor current.',
			['VOUT_NODE', 'COUT', 'RLOAD', 'RETURN'],
			['L1.out', 'VOUT_NODE.node', 'COUT.out', 'RLOAD.out']
		),
		stage(
			'Close the loop',
			'The output probe returns the measured rail to the PWM controller.',
			['VOUT_PROBE', 'CTRL', 'GND'],
			['VOUT_NODE.node', 'VOUT_PROBE.node', 'RETURN.node']
		)
	],
	chua: [
		stage(
			'Seed the nonlinear node',
			'A tiny initial imbalance is presented to Chua’s negative-resistance element.',
			['NR', 'X_NODE', 'X_PROBE'],
			['NR.sink', 'X_PROBE.node']
		),
		stage(
			'Exchange through R',
			'The coupling resistor transfers energy between the two capacitor voltages.',
			['R1', 'Y_NODE', 'Y_PROBE'],
			['X_NODE.node', 'R1.out', 'Y_PROBE.node']
		),
		stage(
			'Store state in C₁ and C₂',
			'The two capacitor voltages form two dimensions of the oscillator state.',
			['C1', 'C2'],
			['X_NODE.node', 'Y_NODE.node', 'C1.out', 'C2.out']
		),
		stage(
			'Rotate through L',
			'Inductor current supplies the third state variable and folds the trajectory back through the nonlinearity.',
			['L1', 'RETURN', 'GND'],
			['Y_NODE.node', 'L1.out', 'RETURN.node']
		)
	],
	pll: [
		stage(
			'Compare phases',
			'The PFD compares reference and divided feedback edges.',
			['REF', 'PFD'],
			['REF.out', 'DIV.fb']
		),
		stage(
			'Pump phase error',
			'UP/DOWN pulses become signed charge-pump current.',
			['CP'],
			['PFD.up', 'PFD.down', 'CP.iout']
		),
		stage(
			'Filter into Vctrl',
			'R and C remove pulse ripple while retaining the correction voltage.',
			['RLP', 'VCTRL', 'CLP'],
			['CP.iout', 'RLP.out', 'VCTRL.node', 'CLP.out']
		),
		stage(
			'Tune the VCO',
			'The control voltage changes oscillator frequency and phase.',
			['VCO', 'OUT'],
			['VCTRL.node', 'VCO.clk']
		),
		stage(
			'Divide and close the loop',
			'÷N returns a comparable feedback clock; lock means repeated phase error approaches zero.',
			['DIV', 'PFD'],
			['VCO.clk', 'DIV.fb']
		)
	],
	statechart: [
		stage(
			'Enter the machine',
			'Power-on follows the initial transition into Red.',
			['START', 'RED'],
			['START.right']
		),
		stage(
			'Red → Green',
			'After Tred, the guarded transition moves control to Green.',
			['RED', 'GREEN'],
			['RED.right']
		),
		stage(
			'Green → Yellow',
			'After Tgreen, the active state advances to Yellow.',
			['GREEN', 'YELLOW'],
			['GREEN.bottom']
		),
		stage(
			'Yellow → Red',
			'The short warning interval completes the safe cycle.',
			['YELLOW', 'RED'],
			['YELLOW.left']
		)
	],
	qec: [
		stage('Prepare |ψ⟩', 'One logical qubit enters the encoder.', ['PSI'], ['PSI.out']),
		stage(
			'Encode redundancy',
			'The logical value is distributed across three physical qubits.',
			['ENC'],
			['PSI.out', 'ENC.o0', 'ENC.o1', 'ENC.o2']
		),
		stage(
			'Cross the noisy channel',
			'A possible bit flip changes one physical rail without revealing ψ.',
			['ERR'],
			['ENC.o0', 'ENC.o1', 'ENC.o2', 'ERR.o0', 'ERR.o1', 'ERR.o2']
		),
		stage(
			'Extract the syndrome',
			'Parity checks locate the error while preserving the logical amplitudes.',
			['SYN'],
			['ERR.o0', 'ERR.o1', 'ERR.o2', 'SYN.s0', 'SYN.s1']
		),
		stage(
			'Correct the identified rail',
			'The syndrome conditionally flips the damaged physical bit.',
			['COR'],
			['SYN.o0', 'SYN.o1', 'SYN.o2', 'SYN.s0', 'SYN.s1', 'COR.d']
		),
		stage('Recover |ψ⟩', 'Decoding returns the protected logical state.', ['MOUT'], ['COR.d'])
	],
	wien: [
		stage(
			'Amplify a perturbation',
			'Noise at the op-amp input is the seed; loop gain decides whether it grows.',
			['U1', 'VOUT'],
			['U1.out', 'VOUT.node']
		),
		stage(
			'Select one frequency',
			'The series RC path passes the zero-phase Wien frequency preferentially.',
			['RS', 'CS', 'VP'],
			['VOUT.node', 'RS.out', 'CS.out']
		),
		stage(
			'Attenuate and phase-balance',
			'The shunt RC branch makes the positive-feedback factor exactly 1/3 at resonance.',
			['RP', 'CP', 'GND'],
			['VP.node', 'RP.out', 'CP.out']
		),
		stage(
			'Stabilize loop gain',
			'The negative-feedback divider holds amplifier gain near three.',
			['RF', 'VN', 'RG', 'U1'],
			['VOUT.node', 'RF.out', 'VN.node', 'RG.out']
		),
		stage(
			'Sustain Vₒ',
			'At unity loop gain and zero phase, the selected sinusoid persists.',
			['VOUT', 'OUT'],
			['U1.out', 'VOUT.node']
		)
	],
	lfsr: [
		stage(
			'Clock the register',
			'One clock edge samples every D input simultaneously.',
			['CLK'],
			['CLK.out']
		),
		stage(
			'Form the feedback bit',
			'The selected Q3 and Q4 taps XOR to produce the next entering bit.',
			['Q3', 'Q4', 'FB'],
			['Q3.q', 'Q4.q', 'FB.out']
		),
		stage(
			'Load Q1',
			'The feedback bit enters the first flip-flop.',
			['Q1'],
			['FB.out', 'CLK.out', 'Q1.q']
		),
		stage(
			'Shift through Q2',
			'The previous Q1 value advances one stage.',
			['Q2'],
			['Q1.q', 'CLK.out', 'Q2.q']
		),
		stage(
			'Shift through Q3',
			'The previous Q2 value advances and becomes a feedback tap.',
			['Q3'],
			['Q2.q', 'CLK.out', 'Q3.q']
		),
		stage(
			'Shift through Q4',
			'The previous Q3 value reaches the final stage and output tap.',
			['Q4'],
			['Q3.q', 'CLK.out', 'Q4.q']
		),
		stage(
			'Emit the sequence bit',
			'Q4 is observed as one symbol of the maximal-length repeating sequence.',
			['OUT'],
			['Q4.q']
		)
	],
	grover: groverStages
};

export function timelineFor(simulationId: string): readonly SimulationStage[] {
	return SIMULATION_TIMELINES[simulationId] ?? [];
}

/**
 * Fold every stage up to `step` into the persistent causal path. Sets preserve
 * authored order and deduplicate converging routes, so playback never performs
 * DOM traversal and Previous can deterministically rewind the latch.
 */
export function cumulativeFrame(
	stages: readonly SimulationStage[],
	step: number
): SimulationStage | undefined {
	const current = stages[step];
	if (!current) return undefined;
	const nodes = new Set<string>();
	const wires = new Set<string>();
	const highNodes = new Set<string>();
	const highWires = new Set<string>();
	for (let index = 0; index <= step; index += 1) {
		const frame = stages[index];
		if (!frame) continue;
		for (const id of frame.nodes) nodes.add(id);
		for (const source of frame.wires) wires.add(source);
		for (const id of frame.highNodes ?? []) highNodes.add(id);
		for (const source of frame.highWires ?? []) highWires.add(source);
	}
	return {
		label: current.label,
		explanation: current.explanation,
		nodes: [...nodes],
		wires: [...wires],
		highNodes: [...highNodes],
		highWires: [...highWires]
	};
}
