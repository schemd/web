import type { PropagationFrame } from './sim-dom';

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

/** A stage whose authored notation was pre-rendered by the route server. */
export interface RenderedSimulationStage extends SimulationStage {
	readonly labelHtml: string;
	readonly explanationHtml: string;
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
			/* Gate outputs are `out1` in the AST: `@schemd/core` 0.4 reports the
			   canonical terminal an alias addresses, and `data-wire-source` follows it. */
			[`X1_${bit}.out1`, `N1_${bit}.out1`, `N2_${bit}.out1`, `X2_${bit}.out1`, `O1_${bit}.out1`]
		)
	),
	stage(
		'Commit Cₒᵤₜ and Σ',
		'Only after the eighth full-adder cell settles is the byte result and final carry committed.',
		['O1_7', 'S7', 'COUT'],
		['O1_7.out1', 'X2_7.out1']
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
		'Round 3 · oracle',
		'The deliberately extra oracle pass starts rotating the state beyond the optimal two-round stopping point.',
		['ORACLE'],
		['H0.out', 'H1.out', 'H2.out', 'ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2']
	),
	stage(
		'Round 3 · mean',
		'The reflection axis has moved with the amplified distribution; another pass no longer points toward certainty.',
		['DIFF'],
		['ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2']
	),
	stage(
		'Round 3 · over-rotation',
		'The third inversion rotates amplitude away from the marked state, exposing why Grover iterations must stop near the optimum.',
		['DIFF'],
		['ORACLE.o0', 'ORACLE.o1', 'ORACLE.o2', 'DIFF.o0', 'DIFF.o1', 'DIFF.o2']
	),
	stage(
		'Measurement',
		'The register is sampled after the deliberately over-rotated third round so its lower success probability is observable.',
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
			['H1.out', 'Q1.out', 'CX1.out1', 'CX1.out2']
		),
		stage(
			'Measure correlation',
			'The individual bits are random, while their parity is perfectly correlated.',
			['M0', 'M1'],
			['CX1.out1', 'CX1.out2']
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
			'The output is high during the charge interval; after the upper threshold trips, it goes low while the discharge transistor returns Cₜ toward ⅓ Vcc.',
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
			['A.out', 'B.out', 'H1.out', 'CX1.out1', 'CX1.out2']
		),
		stage(
			'Bell-basis transform',
			'The unknown state interferes with Alice’s entangled qubit before measurement.',
			['CX2', 'H2'],
			['PSI.out', 'CX1.out1', 'CX2.out1', 'CX2.out2', 'H2.out']
		),
		stage(
			'Send two classical bits',
			'Alice’s measurements contain the correction recipe, not a copy of ψ.',
			['MZ1', 'MZ2'],
			['H2.out', 'CX2.out2']
		),
		stage(
			'Apply conditional corrections',
			'Bob applies X and Z conditioned on the two measurement bits.',
			['XC', 'ZC'],
			['CX1.out2', 'XC.out', 'ZC.out']
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
			'Form the feedback bit',
			'Before the edge, the selected Q3 and Q4 taps XOR to establish the next D input.',
			['Q3', 'Q4', 'FB'],
			['Q3.q', 'Q4.q', 'FB.out1']
		),
		stage(
			'Clock the register',
			'One clock edge samples the prepared feedback and all four D inputs simultaneously.',
			['CLK', 'FB'],
			['FB.out1', 'CLK.out']
		),
		stage(
			'Commit all four stages',
			'Q1 accepts feedback while Q2, Q3, and Q4 accept the previous neighboring bits on the same edge—not as a serial ripple.',
			['Q1', 'Q2', 'Q3', 'Q4'],
			['FB.out1', 'Q1.q', 'Q2.q', 'Q3.q', 'Q4.q', 'CLK.out']
		),
		stage(
			'Emit the sequence bit',
			'Q4 is observed as one symbol of the maximal-length repeating sequence.',
			['OUT'],
			['Q4.q']
		)
	],
	grover: groverStages,
	tdr: [
		stage(
			'Launch the step',
			'The source sees only the line impedance Z₀, so it launches V₁ = Vs·Z₀/(Rs + Z₀) whatever the load is.',
			['VS', 'RS', 'NEAR'],
			['VS.positive', 'RS.out']
		),
		stage(
			'Travel down the line',
			'The front charges each section of distributed capacitance through its inductance, one delay per line length.',
			['L1', 'N1', 'C1', 'L2', 'N2', 'C2', 'L3'],
			['NEAR.node', 'L1.out', 'N1.node', 'L2.out', 'N2.node', 'L3.out']
		),
		stage(
			'Meet the load',
			'At the far end the load reflects the fraction Γ of the arriving wave; a matched load reflects nothing.',
			['FAR', 'RL'],
			['FAR.node', 'RL.out']
		),
		stage(
			'Echo toward the source',
			'The reflection travels back and reaches the near end at twice the delay, where the source reflects Γ of it again.',
			['L3', 'N2', 'L2', 'N1', 'L1', 'NEAR'],
			['L3.out', 'N2.node', 'L2.out', 'N1.node', 'L1.out']
		),
		stage(
			'Settle at the divider',
			'After enough round trips the echoes die away and the line settles at the DC divider of Rs and the load.',
			['VS', 'RS', 'RL', 'G0', 'G1', 'G2', 'G3'],
			['VS.positive', 'RS.out', 'FAR.node', 'RL.out', 'VS.negative', 'C1.out', 'C2.out']
		)
	],
	pll: [
		stage(
			'Compare the phases',
			'The detector multiplies the reference by the fed-back VCO output; its average is proportional to the sine of the phase error.',
			['REF', 'PD'],
			['REF.positive', 'FOUT.node']
		),
		stage(
			'Filter the error',
			'The RC loop filter averages the detector output into a control voltage, removing the double-frequency ripple.',
			['RF', 'VC', 'CF', 'GND'],
			['PD.out1', 'RF.out', 'CF.out']
		),
		stage(
			'Retune the VCO',
			'The control voltage moves the VCO away from its free-running frequency by Kv volts-to-hertz.',
			['VCO'],
			['VC.node']
		),
		stage(
			'Feed the output back',
			'The VCO output returns to the detector, closing the loop: a frequency error becomes a growing phase error.',
			['FOUT', 'PD'],
			['VCO.osc', 'FOUT.node']
		),
		stage(
			'Hold a constant phase offset',
			'In lock the phase error stops changing, and its constant value supplies exactly the control voltage the VCO needs.',
			['PD', 'VCO', 'OUT'],
			['REF.positive', 'PD.out1', 'VC.node', 'VCO.osc']
		)
	],
	classd: [
		stage(
			'Compare audio with the carrier',
			'The comparator outputs high while the audio exceeds the triangle carrier, so the duty cycle follows the audio.',
			['AUD', 'TRI', 'CMP'],
			['AUD.positive', 'TRI.positive']
		),
		stage(
			'Switch the bridge',
			'The half-bridge copies the PWM wave at full supply: its transistors are only ever fully on or fully off.',
			['BRIDGE'],
			['CMP.out']
		),
		stage(
			'Filter the carrier',
			'L and C form a second-order low-pass that passes the audio and shunts the carrier to the return.',
			['LF', 'VO', 'CF', 'RTN'],
			['BRIDGE.sw', 'LF.out', 'CF.out']
		),
		stage(
			'Drive the speaker',
			'What reaches the speaker is the audio plus whatever carrier residual the filter let through.',
			['SPK', 'GND'],
			['VO.node', 'SPK.out', 'RTN.node']
		)
	],
	pid: [
		stage(
			'Form the error',
			'The summing junction subtracts the measured speed from the setpoint; everything downstream reacts to this error.',
			['SET', 'ERR'],
			['SET.out', 'TACH.fb']
		),
		stage(
			'Weigh present, past, and trend',
			'Kp scales the error now, Ki its accumulated history, and Kd its rate of change, in three parallel paths.',
			['KP', 'KI', 'KD'],
			['ERR.e']
		),
		stage(
			'Sum and drive',
			'The three contributions add into one command, which the driver delivers until it saturates at its supply.',
			['SUM', 'DRV'],
			['KP.u', 'KI.u', 'KD.u', 'SUM.u']
		),
		stage(
			'Turn the motor',
			'Drive voltage accelerates the rotor against its inertia, friction, and any load torque.',
			['M'],
			['DRV.v']
		),
		stage(
			'Measure the speed',
			'The tachometer reports the shaft speed back to the summing junction, closing the loop.',
			['TACH', 'ERR'],
			['M.out', 'TACH.fb']
		)
	],
	sigmadelta: [
		stage(
			'Subtract the last bit',
			'The summing node takes the input minus the one-bit DAC output: the error of everything sent so far.',
			['VIN', 'SUM'],
			['VIN.positive', 'DAC.v']
		),
		stage(
			'Accumulate the error',
			'The integrator remembers the running debt between the input and the bits; this memory is what shapes the noise.',
			['INT'],
			['SUM.e']
		),
		stage(
			'Decide one bit',
			'On each clock the quantizer outputs +1 or −1 by the integrator’s sign, and the flip-flop holds it for one period.',
			['Q', 'FF', 'CLK'],
			['INT.y', 'Q.out', 'CLK.out', 'GND.in']
		),
		stage(
			'Feed the bit back',
			'The DAC turns the bit back into ±1 so the next error accounts for it.',
			['DAC'],
			['FF.q']
		),
		stage(
			'Average the bitstream',
			'The decimator low-pass filters the fast bitstream and keeps every OSR-th sample: the shaped noise is filtered away.',
			['DEC', 'OUT'],
			['FF.q', 'DEC.y']
		)
	],
	uart: [
		stage(
			'Load the byte',
			'The transmitter adds a start bit, the data bits least significant first, optional parity, and a stop bit.',
			['BYTE', 'TX'],
			['BYTE.out']
		),
		stage(
			'Send the start edge',
			'The idle-high line falls for the start bit; that single edge is the only timing the receiver gets.',
			['TX', 'TCLK', 'LINE'],
			['TX.tx', 'TCLK.out']
		),
		stage(
			'Sample mid-bit by the local clock',
			'The receiver waits half a bit, then samples once per bit time by its own baud clock; any mismatch accumulates.',
			['RX', 'RCLK'],
			['LINE.node', 'RCLK.out']
		),
		stage(
			'Check the stop bit and parity',
			'A low stop bit is a framing error; a parity bit that disagrees with the count of ones is a parity error.',
			['RX', 'ERR'],
			['RX.err']
		),
		stage(
			'Deliver the byte',
			'The reassembled data bits leave the receiver as one byte, correct only if every sample landed in its own bit.',
			['DATA'],
			['RX.data']
		)
	],
	kickback: [
		stage(
			'Prepare control and target',
			'The control starts in |0⟩ and the target in the chosen state; an eigenstate of the phase gate is what makes kickback clean.',
			['C0', 'T0'],
			['C0.out', 'T0.out']
		),
		stage(
			'Put the control in superposition',
			'H turns the control into |+⟩, so both branches of the controlled gate are present at once.',
			['H1'],
			['H1.out']
		),
		stage(
			'Apply the controlled phase',
			'CP multiplies only |11⟩ by the phase; with the target in |1⟩ that phase lands on the control’s relative phase.',
			['CP'],
			['H1.out', 'T0.out', 'CP.out1', 'CP.out2']
		),
		stage(
			'Interfere the control',
			'The second H turns the control’s relative phase into a measurable population difference.',
			['H2'],
			['CP.out1', 'H2.out']
		),
		stage(
			'Measure the control',
			'P(1) = sin²(φ/2) for an eigenstate target; anything else entangles the qubits and washes out the fringe.',
			['M', 'TOUT'],
			['H2.out', 'CP.out2']
		)
	]
};

export function timelineFor(simulationId: string): readonly SimulationStage[] {
	return SIMULATION_TIMELINES[simulationId] ?? [];
}

/**
 * Fold every stage up to `step` into the persistent causal path. Sets preserve
 * authored order and deduplicate converging routes, so playback never performs
 * DOM traversal and Previous can deterministically rewind the latch.
 */
/**
 * Split one step of a run into the front that is arriving and the trail behind it.
 *
 * {@link cumulativeFrame} answers "everything reached by now", which is the right
 * question for the trail and the wrong one for the front: painted as a single
 * tier it ends every run with the whole drawing lit, and a uniformly lit drawing
 * carries no direction — which is why propagation read as not working at all.
 * The active stage is returned alone, with the cumulative frame of every
 * *earlier* stage as the settled tier. Step 0 has no trail, and says so with
 * `undefined` rather than an empty tier nothing distinguishes from one.
 */
export function travellingFrame(
	stages: readonly SimulationStage[],
	step: number
): PropagationFrame | undefined {
	const active = stages[step];
	if (!active) return undefined;
	const settled = step > 0 ? cumulativeFrame(stages, step - 1) : undefined;
	return {
		nodes: active.nodes,
		wires: active.wires,
		highNodes: active.highNodes,
		highWires: active.highWires,
		settledNodes: settled?.nodes,
		settledWires: settled?.wires,
		settledHighNodes: settled?.highNodes,
		settledHighWires: settled?.highWires
	};
}

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
