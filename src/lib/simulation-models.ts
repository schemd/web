/**
 * Pure, dependency-free reference models for the teaching laboratories.
 *
 * Simulation components import these functions instead of carrying private
 * copies of the physics or logic. That makes the lesson's numerical claims
 * independently testable without mounting a Svelte component or advancing a
 * browser clock.
 */

export interface RippleCarryResult {
	readonly sum: number;
	readonly carry: 0 | 1;
	readonly stages: readonly {
		readonly a: 0 | 1;
		readonly b: 0 | 1;
		readonly carryIn: 0 | 1;
		readonly xor: 0 | 1;
		readonly sum: 0 | 1;
		readonly carryOut: 0 | 1;
	}[];
}

/** Evaluate an unsigned ripple-carry adder one full-adder cell at a time. */
export function rippleCarry(
	a: number,
	b: number,
	carryIn: 0 | 1 = 0,
	bits = 8,
	stuckCarry = false
): RippleCarryResult {
	if (!Number.isInteger(bits) || bits < 1 || bits > 30) {
		throw new RangeError('bits must be an integer from 1 through 30.');
	}
	const mask = 2 ** bits - 1;
	const left = Math.trunc(a) & mask;
	const right = Math.trunc(b) & mask;
	let carry: 0 | 1 = stuckCarry ? 0 : carryIn;
	let sum = 0;
	const stages: RippleCarryResult['stages'][number][] = [];
	for (let bit = 0; bit < bits; bit += 1) {
		const av = ((left >>> bit) & 1) as 0 | 1;
		const bv = ((right >>> bit) & 1) as 0 | 1;
		const xor = (av ^ bv) as 0 | 1;
		const sumBit = (xor ^ carry) as 0 | 1;
		const carryOut = (stuckCarry ? 0 : (av & bv) | (xor & carry)) as 0 | 1;
		stages.push({ a: av, b: bv, carryIn: carry, xor, sum: sumBit, carryOut });
		sum |= sumBit << bit;
		carry = carryOut;
	}
	return { sum, carry, stages };
}

export type Basis2 = '00' | '01' | '10' | '11';
export type BellAmplitudes = Readonly<Record<Basis2, number>>;
const BASIS_2 = ['00', '01', '10', '11'] as const;

/** State after preparation (0), H(q0) (1), or CNOT(q0→q1) (2+). */
export function bellAmplitudesAtStage(
	q0: 0 | 1,
	q1: 0 | 1,
	stage: number,
	brokenEntangler = false
): BellAmplitudes {
	if (!Number.isInteger(stage) || stage < 0)
		throw new RangeError('Bell stage must be non-negative.');
	if (stage === 0) {
		return {
			'00': q0 === 0 && q1 === 0 ? 1 : 0,
			'01': q0 === 0 && q1 === 1 ? 1 : 0,
			'10': q0 === 1 && q1 === 0 ? 1 : 0,
			'11': q0 === 1 && q1 === 1 ? 1 : 0
		};
	}
	const afterH: Record<Basis2, number> = { '00': 0, '01': 0, '10': 0, '11': 0 };
	const amplitude = 1 / Math.SQRT2;
	const sign = q0 === 1 ? -1 : 1;
	afterH[q1 === 0 ? '00' : '01'] = amplitude;
	afterH[q1 === 0 ? '10' : '11'] = sign * amplitude;
	if (stage === 1 || brokenEntangler) return afterH;
	return bellAmplitudes(q0, q1);
}

/** H(q0) followed by CNOT(q0→q1), or H alone when the entangler is broken. */
export function bellAmplitudes(q0: 0 | 1, q1: 0 | 1, brokenEntangler = false): BellAmplitudes {
	const result: Record<Basis2, number> = { '00': 0, '01': 0, '10': 0, '11': 0 };
	const amplitude = 1 / Math.SQRT2;
	const sign = q0 === 1 ? -1 : 1;
	result[q1 === 0 ? '00' : '01'] = amplitude;
	if (brokenEntangler) result[q1 === 0 ? '10' : '11'] = sign * amplitude;
	else result[q1 === 0 ? '11' : '10'] = sign * amplitude;
	return result;
}

/** Expectation of M(a)⊗M(b), where M(θ)=cos(θ)Z+sin(θ)X. */
export function bellCorrelator(amplitudes: BellAmplitudes, thetaA: number, thetaB: number): number {
	const operatorA = [
		[Math.cos(thetaA), Math.sin(thetaA)],
		[Math.sin(thetaA), -Math.cos(thetaA)]
	] as const;
	const operatorB = [
		[Math.cos(thetaB), Math.sin(thetaB)],
		[Math.sin(thetaB), -Math.cos(thetaB)]
	] as const;
	const state = BASIS_2.map((basis) => amplitudes[basis]);
	let expectation = 0;
	for (let i = 0; i < 2; i += 1)
		for (let j = 0; j < 2; j += 1)
			for (let k = 0; k < 2; k += 1)
				for (let l = 0; l < 2; l += 1)
					expectation +=
						state[i * 2 + j]! * operatorA[i]![k]! * operatorB[j]![l]! * state[k * 2 + l]!;
	return expectation;
}

/**
 * Maximum CHSH witness attainable by a real pure two-qubit state.
 *
 * For |ψ⟩=a|00⟩+b|01⟩+c|10⟩+d|11⟩, concurrence is
 * C=2|ad-bc| and the Horodecki bound is S_max=2√(1+C²). This adapts the
 * measurement basis to the selected Bell state instead of incorrectly using
 * the Φ⁺ settings for the entire Bell family.
 */
export function bellChsh(amplitudes: BellAmplitudes): number {
	const concurrence =
		2 * Math.abs(amplitudes['00'] * amplitudes['11'] - amplitudes['01'] * amplitudes['10']);
	return 2 * Math.sqrt(1 + concurrence * concurrence);
}

export interface RcResponse {
	readonly cutoff: number;
	readonly magnitude: number;
	readonly phase: number;
	readonly attenuationDb: number;
}

/** First-order low-pass response H(jω)=1/(1+jωRC). */
export function rcLowPass(
	resistance: number,
	capacitance: number,
	frequency: number,
	openCapacitor = false
): RcResponse {
	if (resistance <= 0 || capacitance <= 0 || frequency < 0) {
		throw new RangeError('R and C must be positive and frequency cannot be negative.');
	}
	if (openCapacitor) {
		return { cutoff: Number.POSITIVE_INFINITY, magnitude: 1, phase: 0, attenuationDb: 0 };
	}
	const cutoff = 1 / (2 * Math.PI * resistance * capacitance);
	const ratio = frequency / cutoff;
	const magnitude = 1 / Math.sqrt(1 + ratio * ratio);
	return {
		cutoff,
		magnitude,
		phase: -Math.atan(ratio),
		attenuationDb: 20 * Math.log10(magnitude)
	};
}

export interface AstableTimer {
	readonly frequency: number;
	readonly duty: number;
	readonly period: number;
	readonly pulseWidth: number;
}

export interface AstableTimerWaveform {
	/** Capacitor voltage divided by Vcc, bounded by the 555 thresholds. */
	readonly capacitorRatio: number;
	readonly charging: boolean;
	readonly outputHigh: boolean;
}

/** Ideal NE555 astable and monostable timing equations. */
export function timer555(
	ra: number,
	rb: number,
	capacitance: number,
	thresholdShort = false
): AstableTimer {
	if (ra <= 0 || rb <= 0 || capacitance <= 0) {
		throw new RangeError('Timer resistances and capacitance must be positive.');
	}
	const frequency = thresholdShort ? 0 : 1.44 / ((ra + 2 * rb) * capacitance);
	return {
		frequency,
		duty: (ra + rb) / (ra + 2 * rb),
		period: frequency === 0 ? Number.POSITIVE_INFINITY : 1 / frequency,
		pulseWidth: 1.1 * ra * capacitance
	};
}

/**
 * Exact normalized NE555 capacitor waveform for one astable cycle.
 *
 * Charging follows `1-(2/3)e^{-t/((RA+RB)C)}` and discharge follows
 * `(2/3)e^{-t/(RB C)}`. Expressing time as cycle phase cancels C while
 * preserving the physical exponential and the RA/RB duty split; callers may
 * therefore slow only the presentation clock without falsifying the waveform.
 */
export function timer555AstableWaveform(
	phase: number,
	ra: number,
	rb: number
): AstableTimerWaveform {
	if (!Number.isFinite(phase) || ra <= 0 || rb <= 0) {
		throw new RangeError('Timer phase must be finite and resistances must be positive.');
	}
	const cycle = ((phase % 1) + 1) % 1;
	const duty = (ra + rb) / (ra + 2 * rb);
	if (cycle < duty) {
		const segment = cycle / duty;
		return {
			capacitorRatio: 1 - (2 / 3) * Math.exp(-Math.LN2 * segment),
			charging: true,
			outputHigh: true
		};
	}
	const segment = (cycle - duty) / (1 - duty);
	return {
		capacitorRatio: (2 / 3) * Math.exp(-Math.LN2 * segment),
		charging: false,
		outputHigh: false
	};
}

/** Slow only high-frequency presentation; never accelerate physical time. */
export function timer555PresentationFrequency(frequency: number, ceiling = 1.5): number {
	if (!Number.isFinite(frequency) || frequency < 0 || !Number.isFinite(ceiling) || ceiling <= 0) {
		throw new RangeError('Timer presentation frequencies must be finite and non-negative.');
	}
	return Math.min(frequency, ceiling);
}

/** Monostable charge law Vc/Vcc = 1-e^(-t/RC). */
export function timer555MonostableCapacitor(
	elapsedSeconds: number,
	ra: number,
	capacitance: number
): number {
	if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0 || ra <= 0 || capacitance <= 0) {
		throw new RangeError('Monostable elapsed time cannot be negative and R/C must be positive.');
	}
	return 1 - Math.exp(-elapsedSeconds / (ra * capacitance));
}

export interface BuckMetrics {
	readonly idealOutput: number;
	readonly loadCurrent: number;
	readonly rippleCurrent: number;
	readonly rippleVoltage: number;
	readonly efficiency: number;
}

/** Averaged continuous-conduction estimates used by the buck-converter lab. */
export function buckMetrics(input: {
	readonly vin: number;
	readonly duty: number;
	readonly load: number;
	readonly inductance: number;
	readonly capacitance: number;
	readonly frequency: number;
	readonly outputVoltage: number;
	readonly inductorCurrent: number;
	readonly gateLost?: boolean;
}): BuckMetrics {
	const { vin, load, inductance, capacitance, frequency, outputVoltage, inductorCurrent } = input;
	if ([vin, load, inductance, capacitance, frequency].some((value) => value <= 0)) {
		throw new RangeError('Buck parameters must be positive.');
	}
	const duty = input.gateLost ? 0 : Math.max(0, Math.min(1, input.duty));
	const idealOutput = vin * duty;
	const rippleCurrent = Math.max(0, ((vin - outputVoltage) * duty) / (inductance * frequency));
	const rippleVoltage = rippleCurrent / (8 * capacitance * frequency);
	const outputPower = (outputVoltage * outputVoltage) / load;
	const copperLoss = inductorCurrent * inductorCurrent * 0.085;
	const switchLoss = vin * Math.max(inductorCurrent, 0) * 32e-9 * frequency;
	return {
		idealOutput,
		loadCurrent: outputVoltage / load,
		rippleCurrent,
		rippleVoltage,
		efficiency:
			input.gateLost || outputVoltage < 0.05
				? 0
				: outputPower / Math.max(outputPower + copperLoss + switchLoss, 1e-9)
	};
}

export type GroverPhase = 'super' | 'oracle' | 'mean' | 'diffuse' | 'measure';

/** Integer iteration count that maximizes Grover success before over-rotation. */
export function groverOptimalRounds(items = 8): number {
	if (!Number.isInteger(items) || items < 2) throw new RangeError('items must be an integer ≥ 2.');
	const rotation = Math.asin(1 / Math.sqrt(items));
	return Math.max(0, Math.round(Math.PI / (4 * rotation) - 0.5));
}

/**
 * Build an explicit Grover phase schedule.
 *
 * `rounds` is a required part of the experiment, not an implicit optimum: the
 * teaching lab deliberately asks for one round beyond the optimum so learners
 * can observe that amplitude amplification is a rotation, not accumulation.
 */
export function groverPhases(
	items = 8,
	rounds = groverOptimalRounds(items)
): readonly GroverPhase[] {
	groverOptimalRounds(items);
	if (!Number.isInteger(rounds) || rounds < 0) {
		throw new RangeError('rounds must be a non-negative integer.');
	}
	const phases: GroverPhase[] = ['super'];
	for (let round = 0; round < rounds; round += 1) phases.push('oracle', 'mean', 'diffuse');
	phases.push('measure');
	return phases;
}

/** Replay Grover phases through the requested inclusive phase index. */
export function groverState(
	target: number,
	phaseIndex: number,
	items = 8,
	wrongOracle = false,
	rounds = groverOptimalRounds(items)
): { readonly amplitudes: readonly number[]; readonly mean?: number; readonly phase: GroverPhase } {
	if (!Number.isInteger(target) || target < 0 || target >= items) {
		throw new RangeError('target must address an item in the search space.');
	}
	const phases = groverPhases(items, rounds);
	if (!Number.isInteger(phaseIndex) || phaseIndex < 0 || phaseIndex >= phases.length) {
		throw new RangeError('phaseIndex is outside the Grover schedule.');
	}
	const marked = wrongOracle ? target ^ 1 : target;
	if (marked >= items) throw new RangeError('wrong-oracle perturbation exceeds the search space.');
	let amplitudes = Array.from({ length: items }, () => 1 / Math.sqrt(items));
	for (let index = 1; index <= phaseIndex; index += 1) {
		const phase = phases[index]!;
		if (phase === 'oracle')
			amplitudes = amplitudes.map((value, i) => (i === marked ? -value : value));
		if (phase === 'diffuse') {
			const mean = amplitudes.reduce((total, value) => total + value, 0) / items;
			amplitudes = amplitudes.map((value) => 2 * mean - value);
		}
	}
	const phase = phases[phaseIndex]!;
	return {
		amplitudes,
		...(phase === 'mean'
			? { mean: amplitudes.reduce((total, value) => total + value, 0) / items }
			: {}),
		phase
	};
}

export type LfsrBits = readonly [0 | 1, 0 | 1, 0 | 1, 0 | 1];

export function lfsrFeedback(bits: LfsrBits, movedTap = false): 0 | 1 {
	return (movedTap ? bits[1] ^ bits[3] : bits[2] ^ bits[3]) as 0 | 1;
}

export function lfsrStep(bits: LfsrBits, movedTap = false): LfsrBits {
	return [lfsrFeedback(bits, movedTap), bits[0], bits[1], bits[2]];
}

/** Return the first period from a non-zero seed, or zero for the locked all-zero state. */
export function lfsrPeriod(seed: LfsrBits, movedTap = false): number {
	if (seed.every((bit) => bit === 0)) return 0;
	let state = seed;
	const ceiling = 2 ** state.length;
	for (let period = 1; period <= ceiling; period += 1) {
		state = lfsrStep(state, movedTap);
		if (state.every((bit, index) => bit === seed[index])) return period;
	}
	throw new Error('LFSR failed to return to its seed within the finite state space.');
}

export type QecError = readonly [0 | 1, 0 | 1, 0 | 1];
export type QecSyndrome = readonly [0 | 1, 0 | 1];

export function qecSyndrome(error: QecError): QecSyndrome {
	return [(error[0] ^ error[1]) as 0 | 1, (error[1] ^ error[2]) as 0 | 1];
}

export function qecAccused([s0, s1]: QecSyndrome, miswiredDecoder = false): 0 | 1 | 2 | undefined {
	if (s0 === 0 && s1 === 0) return undefined;
	if (s0 === 1 && s1 === 1) return 1;
	if (s0 === 1) return miswiredDecoder ? 2 : 0;
	return miswiredDecoder ? 0 : 2;
}

export function qecResidual(
	error: QecError,
	corrected: boolean,
	miswiredDecoder = false
): QecError {
	if (!corrected) return error;
	const accused = qecAccused(qecSyndrome(error), miswiredDecoder);
	return error.map(
		(bit, index) => (bit ^ (index === accused ? 1 : 0)) as 0 | 1
	) as unknown as QecError;
}

export function qecFidelity(error: QecError, corrected: boolean, miswiredDecoder = false): 0 | 1 {
	return qecResidual(error, corrected, miswiredDecoder).every((bit) => bit === 0) ? 1 : 0;
}

export interface TeleportState {
	readonly alpha: number;
	readonly betaMagnitude: number;
	readonly betaReal: number;
	readonly betaImaginary: number;
	readonly p0: number;
	readonly p1: number;
}

export function teleportState(theta: number, phi: number): TeleportState {
	const alpha = Math.cos(theta / 2);
	const betaMagnitude = Math.sin(theta / 2);
	return {
		alpha,
		betaMagnitude,
		betaReal: betaMagnitude * Math.cos(phi),
		betaImaginary: betaMagnitude * Math.sin(phi),
		p0: alpha * alpha,
		p1: betaMagnitude * betaMagnitude
	};
}

/** Fidelity when Bob loses the classical correction bits. */
export function teleportFidelity(
	state: TeleportState,
	m1: 0 | 1,
	m2: 0 | 1,
	lostClassicalBit = false
): number {
	if (!lostClassicalBit || (m1 === 0 && m2 === 0)) return 1;
	if (m1 === 1 && m2 === 0) return (state.alpha ** 2 - state.betaMagnitude ** 2) ** 2;
	if (m1 === 0 && m2 === 1) return (2 * state.alpha * state.betaReal) ** 2;
	return (2 * state.alpha * state.betaImaginary) ** 2;
}

export type TrafficState = 'RED' | 'GREEN' | 'YELLOW';

export function nextTrafficState(current: TrafficState, invertedGuard = false): TrafficState {
	if (current === 'RED') return 'GREEN';
	if (current === 'GREEN') return 'YELLOW';
	if (invertedGuard) return 'YELLOW';
	return 'RED';
}

export function wienFrequency(resistance: number, capacitance: number): number {
	if (resistance <= 0 || capacitance <= 0) {
		throw new RangeError('Wien bridge R and C must be positive.');
	}
	return 1 / (2 * Math.PI * resistance * capacitance);
}

export function wienDamping(gain: number, openGainResistor = false): number {
	return openGainResistor ? 9 : (gain - 3) * 6;
}

export function wienRegime(mu: number, openGainResistor = false): string {
	if (openGainResistor) return 'CLIPPING (rail latch)';
	if (mu < -0.02) return 'DECAYING → silence';
	if (Math.abs(mu) <= 0.02) return 'MARGINAL (Barkhausen)';
	return 'OSCILLATING (limit cycle)';
}
