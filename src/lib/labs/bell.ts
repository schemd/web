import type { LabManifest } from '../lab-manifest';

/**
 * Bell-state preparation, as a manifest.
 *
 * The quantum case the specification named as the fourth shape-proving lab, and
 * it needed no new schema: `bellAmplitudesAtStage` already takes the timeline
 * stage, so scrubbing the transport walks preparation → Hadamard → entangler →
 * measurement instead of replaying a finished run. Every binding is a plain
 * boolean gate on a stage the model has reached.
 */
export const bellLab: LabManifest = {
	id: 'bell',
	title: 'Bell-State Entanglement',
	domain: 'quantum',
	model: 'bell',
	formula: '|\\Phi^+\\rangle = \\dfrac{|00\\rangle + |11\\rangle}{\\sqrt{2}}',
	source: `// Bell-state preparation: H then CNOT
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
CX1.out2 -> M1.in #purple [line]`,
	inputs: [
		{ kind: 'toggle', key: 'q0', label: 'q₀ starts at |1⟩', initial: false },
		{ kind: 'toggle', key: 'q1', label: 'q₁ starts at |1⟩', initial: false }
	],
	bindings: [
		{ signal: 'q0', node: 'Q0', wire: 'Q0.out' },
		{ signal: 'q1', node: 'Q1', wire: 'Q1.out' },
		{ signal: 'hadamard', node: 'H1', wire: 'H1.out' },
		{ signal: 'entangled', node: 'CX1', wire: 'CX1.out1' },
		{ signal: 'entangled', wire: 'CX1.out2' },
		{ signal: 'measured', node: 'M0' },
		{ signal: 'measured', node: 'M1' }
	],
	faults: [
		{
			key: 'brokenEntangler',
			label: 'detune the two-qubit gate',
			reveal:
				'The CNOT no longer entangles. Each qubit still measures at random, so nothing looks wrong one wire at a time — but the CHSH value drops to the classical bound, because the correlation is gone.'
		}
	],
	instruments: [
		{ kind: 'readout', label: 'CHSH', signal: 'chsh', format: 'fixed2' },
		{ kind: 'readout', label: 'P(00)', signal: 'p00', format: 'percent' },
		{ kind: 'readout', label: 'P(11)', signal: 'p11', format: 'percent' },
		{ kind: 'scope', label: 'entanglement', signal: 'entangled' }
	]
};
